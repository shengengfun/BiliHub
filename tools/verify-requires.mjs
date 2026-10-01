// 校验 CJS 模块之间「用到但没导出」的调用
//
// 起因：ipc.cjs 里调用 http.request(...)，而 http.cjs 的 module.exports 里漏了 request，
// 只有真正跑到那行才会炸，构建和类型检查都发现不了。
// 这个脚本静态比对「本地 require 进来的模块 + 调用到的成员」与「该模块实际导出」。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const TARGETS = [
  'packages/core/src/main/ipc.cjs',
  'packages/core/src/main/auth.cjs',
  'packages/core/src/main/download.cjs',
  'packages/core/src/main/updater.cjs',
  'packages/core/src/main/modules.cjs',
  'packages/core/src/main/plugins.cjs',
  'electron/main.cjs',
  'electron/preload.cjs',
]

function exportsOf(file) {
  const source = fs.readFileSync(file, 'utf8')
  const names = new Set()
  for (const match of source.matchAll(/module\.exports\s*=\s*\{/g)) {
    // 从 `{` 开始按大括号配对取出字面量，再按顶层逗号切分
    let depth = 1
    let index = match.index + match[0].length
    const start = index
    while (index < source.length && depth > 0) {
      const char = source[index]
      if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      index += 1
    }
    const literal = source.slice(start, index - 1)
    let level = 0
    let current = ''
    const entries = []
    for (const char of literal) {
      if ('{([<'.includes(char)) level += 1
      else if ('})]>'.includes(char)) level -= 1
      if (char === ',' && level === 0) {
        entries.push(current)
        current = ''
        continue
      }
      current += char
    }
    entries.push(current)

    for (const raw of entries) {
      const entry = raw.trim()
      if (!entry || entry.startsWith('//')) continue
      // 支持 `name`、`name: value`、`name(args) {}`、`...rest` 四种写法
      const shorthand = entry.match(/^\.{0,3}\s*([A-Za-z_$][\w$]*)\s*(?::|\(|\s|$)/)
      if (shorthand) names.add(shorthand[1])
    }
  }
  for (const match of source.matchAll(/module\.exports\.(\w+)\s*=/g)) names.add(match[1])
  return names
}

/** 收出 require 进来的局部名 -> 目标文件 */
function localsOf(file) {
  const source = fs.readFileSync(file, 'utf8')
  const locals = new Map()
  for (const match of source.matchAll(/const\s+(\w+)\s*=\s*require\((['"])(.+?)\2\)/g)) {
    const [, local, , spec] = match
    if (!spec.startsWith('.')) continue
    const resolved = path.resolve(path.dirname(file), spec)
    for (const candidate of [resolved, `${resolved}.cjs`, `${resolved}.js`]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        locals.set(local, candidate)
        break
      }
    }
  }
  return locals
}

const problems = []

for (const relative of TARGETS) {
  const file = path.join(root, relative)
  if (!fs.existsSync(file)) continue
  const source = fs.readFileSync(file, 'utf8')
  const locals = localsOf(file)
  // 去掉 require 行本身，否则 './auth.cjs' 里的 .cjs 会被当成成员访问
  const body = source.replace(/^\s*const\s+\w+\s*=\s*require\([^)]*\).*$/gm, '')

  for (const [local, target] of locals) {
    const available = exportsOf(target)
    const used = new Set()
    const pattern = new RegExp(`\\b${local}\\.(\\w+)\\s*\\(`, 'g')
    for (const match of body.matchAll(pattern)) used.add(match[1])
    // 也要检查 `local.x ?? y` 这种取值式引用
    const valuePattern = new RegExp(`\\b${local}\\.(\\w+)\\b(?!\\s*\\()`, 'g')
    for (const match of body.matchAll(valuePattern)) used.add(match[1])

    for (const name of used) {
      if (!available.has(name)) {
        problems.push(`${relative} 使用了 ${local}.${name}()，但 ${path.relative(root, target)} 没有导出 ${name}`)
      }
    }
  }
}

if (problems.length) {
  console.error('发现未导出的调用：')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(`require/export 校验通过，检查了 ${TARGETS.length} 个文件。`)

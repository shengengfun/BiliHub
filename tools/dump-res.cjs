// 扫描解包后的 res 目录，导出颜色与尺寸常量
const fs = require('node:fs')
const path = require('node:path')
const { decodeFile } = require('./axml-lib.cjs')

const root = process.argv[2]
const colors = new Map()
const dimens = new Map()

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) { walk(full); continue }
    if (!entry.name.endsWith('.xml')) continue
    let decoded
    try { decoded = decodeFile(full) } catch { continue }
    for (const element of decoded.elements) {
      if (element.tag !== 'color' && element.tag !== 'dimen') continue
      const name = element.attributes.find((a) => a.name === 'name')?.value
      const value = element.attributes.find((a) => a.name !== 'name')?.value
      if (!name || value === undefined) continue
      if (element.tag === 'color') colors.set(name, value)
      else dimens.set(name, value)
    }
  }
}

walk(root)

const out = process.argv[3]
const lines = []
lines.push(`# 颜色常量 (${colors.size})`)
for (const [name, value] of [...colors].sort()) lines.push(`${name} = ${value}`)
lines.push('', `# 尺寸常量 (${dimens.size})`)
for (const [name, value] of [...dimens].sort()) lines.push(`${name} = ${value}`)
fs.writeFileSync(out, lines.join('\n'), 'utf8')
console.log('colors', colors.size, 'dimens', dimens.size, '->', out)

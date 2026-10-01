#!/usr/bin/env node
/**
 * EVS VMP 签名（guide 3.11）
 *
 * Widevine 只认经过 castlabs EVS VMP 签名的可执行文件，且顺序不可颠倒：
 *   1. electron-builder 产出 exe（这一步顺带完成代码签名）
 *   2. node scripts/sign-vmp.mjs
 *   3. 上传产物
 *
 * 前置：pip install castlabs-evs && python -m castlabs_evs.account signup
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const releaseDir = path.resolve(process.argv[2] ?? 'release')
const python = process.env.PYTHON ?? 'python'

if (!existsSync(releaseDir)) {
  console.error(`[EVS] 找不到产物目录：${releaseDir}`)
  process.exit(1)
}

/** 只对实际的可执行文件签名：NSIS 安装包本身不签，签它内部解出来的 app exe */
const candidates = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // unpacked 目录里的 exe 才是真正运行的进程
      walk(full)
    } else if (/\.exe$/i.test(entry.name) && !/setup|uninstall/i.test(entry.name)) {
      candidates.push(full)
    }
  }
}
walk(releaseDir)

if (!candidates.length) {
  console.error('[EVS] 未找到可签名的 exe，请先执行 electron-builder')
  process.exit(1)
}

let failed = 0
for (const exe of candidates) {
  const size = (statSync(exe).size / 1024 / 1024).toFixed(1)
  console.log(`[EVS] VMP 签名 ${path.relative(releaseDir, exe)} (${size} MB)`)
  try {
    execFileSync(python, ['-m', 'castlabs_evs.vmp', 'sign-pkg', exe], { stdio: 'inherit' })
    console.log(`[EVS] 完成 ${path.basename(exe)}`)
  } catch (error) {
    failed += 1
    console.error(`[EVS] 失败 ${path.basename(exe)}：${error.shortMessage ?? error.message}`)
    console.error('[EVS] 常见原因：未安装 castlabs-evs、未 signup、或尚未完成代码签名')
  }
}

if (failed) {
  console.error(`[EVS] ${failed}/${candidates.length} 个文件签名失败`)
  process.exit(1)
}
console.log(`[EVS] 全部完成，共 ${candidates.length} 个文件`)

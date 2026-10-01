#!/usr/bin/env node
/**
 * 由设计映射表生成 CSS 变量与文案常量。
 *
 * 输入：specs/tokens.json（由 tools/extract-tokens.py 从 APK 资源表抽取）
 *       specs/design-map.json（语义名 → APK 资源名的映射）
 * 输出：packages/ui/src/tokens.css
 *       packages/ui/src/tokens.js
 *
 * 任何 apk 引用在 tokens.json 里找不到都会直接失败，避免规格与实现悄悄脱节。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const tokens = JSON.parse(readFileSync(path.join(root, 'specs/tokens.json'), 'utf8'))
const map = JSON.parse(readFileSync(path.join(root, 'specs/design-map.json'), 'utf8'))

const problems = []

function resolveColor(entry, key) {
  if (entry.measured) return { value: entry.measured, source: '实测' }
  const value = tokens.colors[entry.apk]
  if (!value) {
    problems.push(`color.${key} 引用了不存在的资源：${entry.apk}`)
    return { value: '#000000', source: `缺失(${entry.apk})` }
  }
  // 资源表里是 #aarrggbb，CSS 用 #rrggbbaa
  const hex = value.replace('#', '')
  const css = hex.length === 8 ? `#${hex.slice(2)}${hex.slice(0, 2)}` : value
  return { value: css, source: entry.apk }
}

function resolveSize(entry, key) {
  if (entry.measured !== undefined) return { value: entry.measured, source: '实测' }
  const value = tokens.dimens[entry.apk]
  if (value === undefined) {
    problems.push(`size.${key} 引用了不存在的资源：${entry.apk}`)
    return { value: 0, source: `缺失(${entry.apk})` }
  }
  return { value: value, source: entry.apk }
}

const TRADITIONAL_TO_SIMPLIFIED = {
  登入: '登录',
  帳號: '账号',
  無法: '无法',
  訊息: '消息',
  哦: '哦',
}

/**
 * APK 里部分资源只带繁体副本（例如 im_commnucatiion_no_login_tip）。
 * 这里做一次有记录的转换，而不是让人手改生成物。
 * design-map.json 里写 `"simplify": true` 才会走这条路径。
 */
function simplify(text) {
  let out = text
  for (const [from, to] of Object.entries(TRADITIONAL_TO_SIMPLIFIED)) out = out.split(from).join(to)
  return out
}

function resolveText(entry, key) {
  const raw = tokens.strings?.[entry.apk]
  if (raw === undefined) {
    problems.push(`text.${key} 引用了不存在的字符串：${entry.apk}`)
    return { value: '', source: `缺失(${entry.apk})`, converted: false }
  }
  if (!entry.simplify) return { value: raw, source: entry.apk, converted: false }
  const value = simplify(raw)
  if (value === raw) {
    problems.push(`text.${key} 标记了 simplify，但 ${entry.apk} 的值没有变化，请检查映射是否需要保留：${raw}`)
  }
  return { value, source: `${entry.apk}（繁体转简体，原文：${raw}）`, converted: value !== raw }
}

const css = ['/* 由 tools/gen-tokens.mjs 生成，请勿手改 —— 改 specs/design-map.json 后重新运行 */', ':root {']
const js = ['// 由 tools/gen-tokens.mjs 生成，请勿手改']

for (const [key, entry] of Object.entries(map.color ?? {})) {
  const { value, source } = resolveColor(entry, key)
  css.push(`  /* ${source}${entry.note ? ` · ${entry.note}` : ''} */`)
  css.push(`  --bh-${key}: ${value};`)
}
for (const [key, entry] of Object.entries(map.size ?? {})) {
  const { value, source } = resolveSize(entry, key)
  const num = Number.isInteger(value) ? value : Number(value.toFixed(2))
  css.push(`  /* ${source}${entry.note ? ` · ${entry.note}` : ''} */`)
  css.push(`  --bh-${key}: ${num}px;`)
}
css.push('}')

const strings = {}
for (const [key, entry] of Object.entries(map.text ?? {})) {
  const { value, source } = resolveText(entry, key)
  strings[key] = value
  js.push(`// ${source}`)
  js.push(`export const ${key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())} = ${JSON.stringify(value)}`)
}

writeFileSync(path.join(root, 'packages/ui/src/tokens.css'), `${css.join('\n')}\n`, 'utf8')
writeFileSync(path.join(root, 'packages/ui/src/tokens.js'), `${js.join('\n')}\n`, 'utf8')

const colorCount = Object.keys(map.color ?? {}).length
const sizeCount = Object.keys(map.size ?? {}).length
const textCount = Object.keys(map.text ?? {}).length

if (problems.length) {
  console.error('生成失败，存在无法解析的引用：')
  for (const item of problems) console.error('  -', item)
  process.exit(1)
}

console.log(`tokens.css: ${colorCount} 个颜色、${sizeCount} 个尺寸`)
console.log(`tokens.js : ${textCount} 条文案`)
console.log('全部引用均可在 APK 资源表中找到来源。')

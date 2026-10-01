// 第三方插件：从 userData/plugins 目录扫描、校验清单、读写启用状态。
const fs = require('node:fs')
const path = require('node:path')
const { app, shell } = require('electron')

const REQUIRED = ['id', 'name', 'version', 'main']

function pluginsDir() {
  return path.join(app.getPath('userData'), 'plugins')
}

function ensureDir() {
  const dir = pluginsDir()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** 校验插件清单，返回 { ok, errors, manifest } */
function validate(manifest) {
  const errors = []
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest.json 不是合法 JSON 对象'], manifest: null }
  for (const key of REQUIRED) {
    if (!manifest[key]) errors.push(`缺少必需字段：${key}`)
  }
  if (manifest.id && !/^[a-z0-9][a-z0-9._-]*$/i.test(manifest.id)) errors.push('id 只能包含字母、数字、点、下划线与短横线')
  if (manifest.permissions && !Array.isArray(manifest.permissions)) errors.push('permissions 必须是数组')
  if (manifest.engines && manifest.engines.bilihub) {
    const [major] = String(manifest.engines.bilihub).replace(/[^\d.]/g, '').split('.')
    if (Number(major) > 1) errors.push(`要求的 BiliHub 版本 (${manifest.engines.bilihub}) 高于当前版本`)
  }
  return { ok: errors.length === 0, errors, manifest }
}

/** 扫描插件目录；损坏的插件也会返回，便于界面提示 */
function list(storage) {
  const dir = ensureDir()
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
  const result = []

  for (const entry of entries) {
    const folder = path.join(dir, entry.name)
    const manifestPath = path.join(folder, 'manifest.json')
    const record = {
      folder: entry.name,
      dir: folder,
      id: entry.name,
      name: entry.name,
      version: '',
      description: '',
      author: '',
      icon: '',
      permissions: [],
      hasSource: false,
      enabled: false,
      valid: false,
      errors: [],
    }

    if (!fs.existsSync(manifestPath)) {
      record.errors.push('缺少 manifest.json')
      result.push(record)
      continue
    }

    let raw
    try {
      raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    } catch (error) {
      record.errors.push(`manifest.json 解析失败：${error.message}`)
      result.push(record)
      continue
    }

    const { ok, errors, manifest } = validate(raw)
    record.errors = errors
    record.valid = ok
    if (manifest) {
      record.id = manifest.id || record.folder
      record.name = manifest.name || record.folder
      record.version = manifest.version || ''
      record.description = manifest.description || ''
      record.author = manifest.author || ''
      record.icon = manifest.icon || ''
      record.permissions = Array.isArray(manifest.permissions) ? manifest.permissions : []
      record.main = manifest.main || 'main.js'
      record.hasSource = fs.existsSync(path.join(folder, record.main))
      if (!record.hasSource && ok) {
        record.valid = false
        record.errors.push(`入口文件不存在：${record.main}`)
      }
    }

    // 启用状态存于设置：plugin:<id>:enabled
    const stored = storage?.get?.(`plugin:${record.id}:enabled`)
    record.enabled = stored === true
    result.push(record)
  }

  return result.sort((a, b) => a.name.localeCompare(b.name))
}

function setEnabled(id, enabled, storage) {
  const target = list(storage).find((plugin) => plugin.id === id)
  if (!target) return { ok: false, error: '插件不存在' }
  if (enabled && !target.valid) return { ok: false, error: `插件不可用：${target.errors.join('；')}` }
  storage?.set?.(`plugin:${id}:enabled`, Boolean(enabled))
  return { ok: true, id, enabled: Boolean(enabled) }
}

/** 读取插件源码，交给渲染进程沙箱执行 */
function readSource(id, storage) {
  const target = list(storage).find((plugin) => plugin.id === id)
  if (!target || !target.hasSource) return null
  return {
    manifest: {
      id: target.id,
      name: target.name,
      version: target.version,
      description: target.description,
      permissions: target.permissions,
    },
    source: fs.readFileSync(path.join(target.dir, target.main), 'utf8'),
  }
}

function reveal() {
  const dir = ensureDir()
  shell.openPath(dir)
  return dir
}

/** 仓库内置的示例插件目录 */
function bundledDir() {
  return path.resolve(__dirname, '../../../../plugins')
}

/**
 * 把仓库内置插件复制到用户插件目录（已存在的目录不覆盖）。
 * @returns {{installed:string[], skipped:string[], error?:string}}
 */
function installBundled() {
  const source = bundledDir()
  if (!fs.existsSync(source)) return { installed: [], skipped: [], error: `内置插件目录不存在：${source}` }

  const target = ensureDir()
  const installed = []
  const skipped = []

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const destination = path.join(target, entry.name)
    if (fs.existsSync(destination)) {
      skipped.push(entry.name)
      continue
    }
    fs.cpSync(path.join(source, entry.name), destination, { recursive: true })
    installed.push(entry.name)
  }
  return { installed, skipped }
}

module.exports = { pluginsDir, list, setEnabled, readSource, reveal, validate, installBundled }

const fs = require('node:fs')
const path = require('node:path')

const registryPath = path.resolve(__dirname, '../../../../registry/modules.json')

function loadRegistry() {
  try {
    return JSON.parse(fs.readFileSync(registryPath, 'utf8')).modules ?? []
  } catch {
    return []
  }
}

function listModules(storage) {
  return loadRegistry().map((module) => ({
    id: module.id,
    name: module.name,
    category: module.category,
    version: module.version,
    description: module.description,
    settings: module.settings ?? [],
    // 启用状态优先取用户设置，其次取注册表默认值，缺省为启用
    enabled: storage?.get?.(`module:${module.id}:enabled`) ?? module.enabled ?? true,
  }))
}

function getModuleSettings(storage, moduleId) {
  const module = loadRegistry().find((item) => item.id === moduleId)
  if (!module) return {}
  const result = {}
  for (const schema of module.settings ?? []) {
    const stored = storage.get(`module:${moduleId}:${schema.key}`)
    result[schema.key] = stored === undefined ? schema.default : stored
  }
  return result
}

function setModuleSetting(storage, moduleId, key, value) {
  storage.set(`module:${moduleId}:${key}`, value)
  return true
}

module.exports = { loadRegistry, listModules, getModuleSettings, setModuleSetting }

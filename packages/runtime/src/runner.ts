import type { RuntimeModule, RuntimeContext, RuntimeStorage } from './types.js'

export function sortModules(modules: RuntimeModule[]): RuntimeModule[] {
  const byId = new Map(modules.map((module) => [module.id, module]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const ordered: RuntimeModule[] = []
  const visit = (module: RuntimeModule) => {
    if (visited.has(module.id)) return
    if (visiting.has(module.id)) throw new Error(`模块依赖循环: ${module.id}`)
    visiting.add(module.id)
    for (const dependency of module.dependencies ?? []) {
      const dependencyModule = byId.get(dependency)
      if (!dependencyModule) throw new Error(`模块依赖不存在: ${module.id} -> ${dependency}`)
      visit(dependencyModule)
    }
    visiting.delete(module.id)
    visited.add(module.id)
    ordered.push(module)
  }
  modules.forEach(visit)
  return ordered
}

export async function runModules(modules: RuntimeModule[], storage: RuntimeStorage, log: RuntimeContext['log'] = console) {
  const loaded: RuntimeModule[] = []
  for (const module of sortModules(modules)) {
    const settings: Record<string, unknown> = {}
    for (const schema of module.settings) settings[schema.key] = (await storage.get(`module:${module.id}:${schema.key}`)) ?? schema.default
    const context: RuntimeContext = {
      settings,
      getSetting: <T>(key: string) => settings[key] as T,
      setSetting: async (key, value) => { settings[key] = value; await storage.set(`module:${module.id}:${key}`, value) },
      log: { info: (...args) => log.info(`[${module.id}]`, ...args), warn: (...args) => log.warn(`[${module.id}]`, ...args), error: (...args) => log.error(`[${module.id}]`, ...args) },
    }
    try { await module.onLoad(context); loaded.push(module) } catch (error) { log.error(`模块加载失败: ${module.name}`, error) }
  }
  return () => loaded.reverse().forEach((module) => module.onUnload())
}
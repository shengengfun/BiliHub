import { runModules } from './runner.js'
import type { RuntimeAdapter, RuntimeModule, RuntimeStorage } from './types.js'

export async function installRuntime(adapter: RuntimeAdapter, modules: RuntimeModule[]) {
  if (typeof window === 'undefined' || window.__bilihubRuntimeInstalled) return () => {}
  window.__bilihubRuntimeInstalled = true
  return runModules(modules, adapter, adapter.storage)
}

declare global { interface Window { __bilihubRuntimeInstalled?: boolean } }
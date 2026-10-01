import { runModules } from './runner.js'
import type { RuntimeModule, RuntimeStorage } from './types.js'

export async function installRuntime(storage: RuntimeStorage, modules: RuntimeModule[]) {
  if (typeof window === 'undefined' || window.__bilihubRuntimeInstalled) return () => {}
  window.__bilihubRuntimeInstalled = true
  return runModules(modules, storage)
}

declare global { interface Window { __bilihubRuntimeInstalled?: boolean } }
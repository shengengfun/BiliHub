import type { PluginManifest, PluginPermission } from '@bilihub/shared'

export interface PluginApi {
  storage: { get<T>(key: string): Promise<T | undefined>; set<T>(key: string, value: T): Promise<void> }
  ui: { toast(message: string): void; injectCSS(css: string): () => void }
  notify(title: string, body: string): void
}

function denied(name: string): never { throw new Error(`插件权限不足: ${name}`) }

export function createPluginSandbox(manifest: PluginManifest, api: PluginApi) {
  const permissions = new Set<PluginPermission>(manifest.permissions)
  const scopedApi: PluginApi = {
    storage: permissions.has('storage') ? api.storage : { get: () => denied('storage'), set: () => denied('storage') },
    ui: { toast: api.ui.toast, injectCSS: permissions.has('ui.page') ? api.ui.injectCSS : () => denied('ui.page') },
    notify: permissions.has('notify') ? api.notify : () => denied('notify'),
  }
  return { run(source: string) { const factory = new Function('BiliShell', 'console', 'window', 'document', 'globalThis', `'use strict'; return (function(){${source}\n})();`); return factory(scopedApi, console, undefined, undefined, undefined) } }
}
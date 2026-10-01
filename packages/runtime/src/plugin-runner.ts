import type { PluginManifest } from '@bilihub/shared'
import { createPluginSandbox, type PluginApi } from './plugin-sandbox.js'

export interface LoadedPlugin { manifest: PluginManifest; dispose: () => void }

export function loadPlugin(manifest: PluginManifest, source: string, api: PluginApi): LoadedPlugin {
  const sandbox = createPluginSandbox(manifest, api)
  const exports = sandbox.run(source) as { activate?: (api: PluginApi) => void; deactivate?: () => void } | undefined
  exports?.activate?.(api)
  return { manifest, dispose: () => exports?.deactivate?.() }
}
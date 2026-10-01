import { DownloadQueue, createSettingsStore, moduleRegistry, platformCapabilities } from './modules'

export function createBiliHubBridge() {
  const settings = createSettingsStore()
  const downloads = new DownloadQueue()
  const plugins = [{ id: 'example-hello', name: '示例插件', version: '1.0.0', enabled: true, permissions: ['storage', 'ui.page', 'notify'] }]
  return {
    modules: moduleRegistry,
    platform: platformCapabilities,
    settings,
    downloads,
    plugins,
    native: window.bilihubNative ?? null,
    plugin: {
      enable(id) { const plugin = plugins.find((item) => item.id === id); if (plugin) plugin.enabled = true },
      disable(id) { const plugin = plugins.find((item) => item.id === id); if (plugin) plugin.enabled = false },
    },
  }
}
const native = typeof window !== 'undefined' ? window.bilihubUI : undefined

const fallbackStorage = {
  get: async (key) => {
    const value = window.localStorage.getItem(`bilihub.${key}`)
    return value === null ? undefined : JSON.parse(value)
  },
  set: async (key, value) => window.localStorage.setItem(`bilihub.${key}`, JSON.stringify(value)),
  delete: async (key) => window.localStorage.removeItem(`bilihub.${key}`),
}

export const api = {
  mode: native ? 'electron' : 'browser',
  storage: native?.storage ?? fallbackStorage,
  platform: async () => (native ? native.platform() : { platform: 'unknown', drm: false, touch: false }),
  listModules: async () => (native ? native.listModules() : []),
  getModuleSettings: async (id) => (native ? native.getModuleSettings(id) : {}),
  setModuleSetting: async (id, key, value) =>
    native ? native.setModuleSetting(id, key, value) : fallbackStorage.set(`module.${id}.${key}`, value),
  listDownloads: async () => (native ? native.listDownloads() : { items: [], stats: {} }),
  pauseDownload: async (id) => native?.pauseDownload(id),
  resumeDownload: async (id) => native?.resumeDownload(id),
  cancelDownload: async (id) => native?.cancelDownload(id),
  listPlugins: async () => (native ? native.listPlugins() : []),
  setPluginEnabled: async (id, enabled) => native?.setPluginEnabled(id, enabled),
  revealPluginFolder: async () => native?.revealPluginFolder(),
  openBilibili: async () => native?.openBilibili(),
  closePanel: async () => native?.closePanel(),
}

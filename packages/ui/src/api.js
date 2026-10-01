const native = typeof window !== 'undefined' ? window.bilihubUI : undefined

const fallbackStorage = {
  get: async (key) => {
    const value = window.localStorage.getItem(`bilihub.${key}`)
    return value === null ? undefined : JSON.parse(value)
  },
  set: async (key, value) => window.localStorage.setItem(`bilihub.${key}`, JSON.stringify(value)),
  delete: async (key) => window.localStorage.removeItem(`bilihub.${key}`),
}

/**
 * 浏览器预览下的下载兜底：把代理 URL 交给 <a download> 触发浏览器下载。
 * 桌面客户端走主进程下载管理器（支持队列与断点续传）。
 */
function browserDownload({ url, title, filename }) {
  const link = document.createElement('a')
  link.href = `/bili-proxy?url=${encodeURIComponent(url)}`
  link.download = filename || title || 'bilihub'
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  return { id: `browser-${Date.now()}`, title: title || filename, status: 'done', percent: 100 }
}

/** 浏览器预览下的网络代理（开发服务器中间件） */
async function proxyGet(url) {
  const response = await fetch(`/bili-proxy?url=${encodeURIComponent(url)}`)
  const text = await response.text()
  try {
    return { status: response.status, data: JSON.parse(text) }
  } catch {
    return { status: response.status, data: null }
  }
}

export const api = {
  mode: native ? 'electron' : 'browser',
  storage: native?.storage ?? fallbackStorage,

  platform: async () => (native ? native.platform() : { platform: 'unknown', drm: false, touch: false }),

  // ---- 模块 ----
  listModules: async () => (native ? native.listModules() : []),
  getModuleSettings: async (id) => (native ? native.getModuleSettings(id) : {}),
  setModuleSetting: async (id, key, value) =>
    native ? native.setModuleSetting(id, key, value) : fallbackStorage.set(`module.${id}.${key}`, value),
  setModuleEnabled: async (id, enabled) =>
    native ? native.setModuleEnabled(id, enabled) : fallbackStorage.set(`module.${id}.enabled`, enabled),

  // ---- 下载 ----
  listDownloads: async () => (native ? native.listDownloads() : { items: [], stats: {} }),
  createDownload: async (options) => (native ? native.createDownload(options) : browserDownload(options)),
  pauseDownload: async (id) => native?.pauseDownload(id),
  resumeDownload: async (id) => native?.resumeDownload(id),
  cancelDownload: async (id) => native?.cancelDownload(id),
  removeDownload: async (id) => native?.removeDownload(id),
  openDownloadFolder: async (id) => (native ? native.openDownloadFolder(id) : undefined),
  downloadsDir: async () => (native ? native.downloadsDir() : ''),
  onDownloadsChanged: (callback) => (native?.onDownloadsChanged ? native.onDownloadsChanged(callback) : () => {}),

  // ---- 插件 ----
  listPlugins: async () => (native ? native.listPlugins() : []),
  setPluginEnabled: async (id, enabled) =>
    native ? native.setPluginEnabled(id, enabled) : { ok: false, error: '仅桌面客户端支持' },
  readPluginSource: async (id) => (native ? native.readPluginSource(id) : null),
  revealPluginFolder: async () => native?.revealPluginFolder(),
  installBundledPlugins: async () =>
    native?.installBundledPlugins ? native.installBundledPlugins() : { installed: [], skipped: [], error: '仅桌面客户端支持' },

  // ---- B 站接口 ----
  biliApi: async (url) => (native ? native.biliApi(url) : proxyGet(url)),
  biliText: async (url) => {
    if (native) return native.biliText(url)
    const response = await fetch(`/bili-proxy?url=${encodeURIComponent(url)}`)
    return response.ok ? response.text() : ''
  },
  biliPost: async (payload) =>
    native?.biliPost ? native.biliPost(payload) : { status: 0, data: { code: -1, message: '仅桌面客户端支持写操作' } },

  // 页面请求捕获：WBI 签名接口统一走这里，复用页面自身发起的请求
  capture: {
    wait: async (pattern, timeoutMs) =>
      native?.capture ? native.capture.wait(pattern, timeoutMs) : { json: null, text: '' },
    cached: async (pattern) => (native?.capture ? native.capture.cached(pattern) : null),
    viaPage: async (options) => (native?.capture ? native.capture.viaPage(options) : { json: null, text: '' }),
    clear: async () => native?.capture?.clear(),
  },

  // 登录依赖 Electron 会话（Cookie 落在 persist:bilihub），浏览器预览不可用
  hasAuth: Boolean(native?.auth),
  auth: {
    status: async () => (native?.auth ? native.auth.status() : { isLogin: false, unsupported: true }),
    login: async () => (native?.auth ? native.auth.login() : { isLogin: false, unsupported: true }),
    logout: async () => (native?.auth ? native.auth.logout() : false),
    diagnose: async () => (native?.auth?.diagnose ? native.auth.diagnose() : null),
    onChange: (callback) => (native?.auth?.onChange ? native.auth.onChange(callback) : () => {}),
  },

  openBilibili: async (url) => native?.openBilibili(url),
  screenshot: async () => native?.screenshot(),
  saveData: async (payload) => (native?.saveData ? native.saveData(payload) : undefined),
  closePanel: async () => native?.closePanel(),

  // 空间资料（含空间装扮）
  spaceProfile: async (mid) => (native?.spaceProfile ? native.spaceProfile(mid) : null),

  // 设置导入导出
  exportSettings: async () => (native?.exportSettings ? native.exportSettings() : { ok: false, error: '仅桌面客户端支持' }),
  importSettings: async (options) => (native?.importSettings ? native.importSettings(options) : { ok: false, error: '仅桌面客户端支持' }),

  // 自动更新（仅打包后的桌面客户端可用）
  update: {
    status: async () => (native?.update ? native.update.status() : { supported: false, packaged: false, status: 'idle' }),
    check: async () => (native?.update ? native.update.check() : { supported: false, packaged: false, status: 'idle' }),
    download: async () => native?.update?.download(),
    install: async () => native?.update?.install(),
    onChange: (callback) => (native?.update?.onChange ? native.update.onChange(callback) : () => {}),
  },
}

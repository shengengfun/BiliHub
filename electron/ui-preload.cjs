const { contextBridge, ipcRenderer } = require('electron')

/** 订阅主进程推送，返回取消订阅函数 */
function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('bilihubUI', {
  platform: () => ipcRenderer.invoke('bilihub:platform'),
  storage: {
    get: (key) => ipcRenderer.invoke('bilihub:storage:get', key),
    set: (key, value) => ipcRenderer.invoke('bilihub:storage:set', key, value),
    delete: (key) => ipcRenderer.invoke('bilihub:storage:delete', key),
  },

  // 模块
  listModules: () => ipcRenderer.invoke('bilihub:modules:list'),
  getModuleSettings: (id) => ipcRenderer.invoke('bilihub:modules:get-settings', id),
  setModuleSetting: (id, key, value) => ipcRenderer.invoke('bilihub:modules:set-setting', id, key, value),
  setModuleEnabled: (id, enabled) => ipcRenderer.invoke('bilihub:modules:set-enabled', id, enabled),

  // 下载
  listDownloads: () => ipcRenderer.invoke('bilihub:download:list'),
  createDownload: (options) => ipcRenderer.invoke('bilihub:download:create', options),
  pauseDownload: (id) => ipcRenderer.invoke('bilihub:download:pause', id),
  resumeDownload: (id) => ipcRenderer.invoke('bilihub:download:resume', id),
  cancelDownload: (id) => ipcRenderer.invoke('bilihub:download:cancel', id),
  removeDownload: (id) => ipcRenderer.invoke('bilihub:download:remove', id),
  openDownloadFolder: (id) => ipcRenderer.invoke('bilihub:download:open-folder', id),
  downloadsDir: () => ipcRenderer.invoke('bilihub:download:dir'),
  onDownloadsChanged: (callback) => subscribe('bilihub:download:changed', callback),

  // 插件
  listPlugins: () => ipcRenderer.invoke('bilihub:plugins:list'),
  setPluginEnabled: (id, enabled) => ipcRenderer.invoke('bilihub:plugins:set-enabled', id, enabled),
  readPluginSource: (id) => ipcRenderer.invoke('bilihub:plugins:source', id),
  revealPluginFolder: () => ipcRenderer.invoke('bilihub:plugins:reveal'),
  installBundledPlugins: () => ipcRenderer.invoke('bilihub:plugins:install-bundled'),

  // B 站接口
  biliApi: (url) => ipcRenderer.invoke('bilihub:bili:api', url),
  biliText: (url) => ipcRenderer.invoke('bilihub:bili:text', url),
  biliPost: (payload) => ipcRenderer.invoke('bilihub:bili:post', payload),

  // 页面请求捕获（不自行实现 WBI 签名）
  capture: {
    wait: (pattern, timeoutMs) => ipcRenderer.invoke('bilihub:capture:wait', pattern, timeoutMs),
    cached: (pattern) => ipcRenderer.invoke('bilihub:capture:cached', pattern),
    viaPage: (options) => ipcRenderer.invoke('bilihub:capture:page', options),
    clear: () => ipcRenderer.invoke('bilihub:capture:clear'),
  },

  // 账号
  auth: {
    status: () => ipcRenderer.invoke('bilihub:auth:status'),
    login: () => ipcRenderer.invoke('bilihub:auth:login'),
    logout: () => ipcRenderer.invoke('bilihub:auth:logout'),
    diagnose: () => ipcRenderer.invoke('bilihub:auth:diagnose'),
    // 主进程登录成功后推送账号信息，面板无需轮询即可立即刷新
    onChange: (callback) => subscribe('bilihub:auth:changed', callback),
  },

  openBilibili: () => ipcRenderer.invoke('bilihub:window:open-bilibili'),
  screenshot: () => ipcRenderer.invoke('bilihub:window:screenshot'),
  saveData: (payload) => ipcRenderer.invoke('bilihub:download:save-data', payload),
  closePanel: () => ipcRenderer.invoke('bilihub:ui:close'),

  // 设置导入导出
  exportSettings: () => ipcRenderer.invoke('bilihub:settings:export'),
  importSettings: (options) => ipcRenderer.invoke('bilihub:settings:import', options),

  // 自动更新
  update: {
    status: () => ipcRenderer.invoke('bilihub:update:status'),
    check: () => ipcRenderer.invoke('bilihub:update:check'),
    download: () => ipcRenderer.invoke('bilihub:update:download'),
    install: () => ipcRenderer.invoke('bilihub:update:install'),
    onChange: (callback) => subscribe('bilihub:update:changed', callback),
  },
})

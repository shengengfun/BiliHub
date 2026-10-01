const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bilihubUI', {
  platform: () => ipcRenderer.invoke('bilihub:platform'),
  storage: {
    get: (key) => ipcRenderer.invoke('bilihub:storage:get', key),
    set: (key, value) => ipcRenderer.invoke('bilihub:storage:set', key, value),
    delete: (key) => ipcRenderer.invoke('bilihub:storage:delete', key),
  },
  listModules: () => ipcRenderer.invoke('bilihub:modules:list'),
  getModuleSettings: (id) => ipcRenderer.invoke('bilihub:modules:get-settings', id),
  setModuleSetting: (id, key, value) => ipcRenderer.invoke('bilihub:modules:set-setting', id, key, value),
  listDownloads: () => ipcRenderer.invoke('bilihub:downloads:list'),
  pauseDownload: (id) => ipcRenderer.invoke('bilihub:downloads:pause', id),
  resumeDownload: (id) => ipcRenderer.invoke('bilihub:downloads:resume', id),
  cancelDownload: (id) => ipcRenderer.invoke('bilihub:downloads:cancel', id),
  listPlugins: () => ipcRenderer.invoke('bilihub:plugins:list'),
  setPluginEnabled: (id, enabled) => ipcRenderer.invoke('bilihub:plugins:set-enabled', id, enabled),
  revealPluginFolder: () => ipcRenderer.invoke('bilihub:plugins:reveal'),
  biliApi: (url) => ipcRenderer.invoke('bilihub:bili:api', url),
  biliText: (url) => ipcRenderer.invoke('bilihub:bili:text', url),
  auth: {
    status: () => ipcRenderer.invoke('bilihub:auth:status'),
    login: () => ipcRenderer.invoke('bilihub:auth:login'),
    logout: () => ipcRenderer.invoke('bilihub:auth:logout'),
    diagnose: () => ipcRenderer.invoke('bilihub:auth:diagnose'),
    // 主进程登录成功后会推送账号信息，面板无需轮询也能立即刷新
    onChange: (callback) => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('bilihub:auth:changed', listener)
      return () => ipcRenderer.removeListener('bilihub:auth:changed', listener)
    },
  },
  openBilibili: () => ipcRenderer.invoke('bilihub:window:open-bilibili'),
  closePanel: () => ipcRenderer.invoke('bilihub:ui:close'),
})

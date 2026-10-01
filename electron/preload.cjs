const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bilihubNative', {
  openBilibili: () => ipcRenderer.invoke('bilihub:window:open-bilibili'),
  screenshot: () => ipcRenderer.invoke('bilihub:window:screenshot'),
  platform: () => ipcRenderer.invoke('bilihub:platform'),
  download: (payload) => ipcRenderer.invoke('bilihub:download', payload),
})
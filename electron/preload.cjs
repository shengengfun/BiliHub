const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bilihubNative', {
  openBilibili: () => ipcRenderer.invoke('bilihub:window:open-bilibili'),
  screenshot: () => ipcRenderer.invoke('bilihub:window:screenshot'),
  platform: () => ipcRenderer.invoke('bilihub:platform'),
  download: (payload) => ipcRenderer.invoke('bilihub:download', payload),
  httpRequest: (options) => ipcRenderer.invoke('bilihub:http:request', options),
  auth: {
    status: () => ipcRenderer.invoke('bilihub:auth:status'),
    login: () => ipcRenderer.invoke('bilihub:auth:login'),
    logout: () => ipcRenderer.invoke('bilihub:auth:logout'),
  },
  openPanel: () => ipcRenderer.invoke('bilihub:ui:open'),
  saveData: (payload) => ipcRenderer.invoke('bilihub:download:save-data', payload),
  storage: {
    get: (key) => ipcRenderer.invoke('bilihub:storage:get', key),
    set: (key, value) => ipcRenderer.invoke('bilihub:storage:set', key, value),
    delete: (key) => ipcRenderer.invoke('bilihub:storage:delete', key),
  },
})

const toolbarStyle = `
  #bilihub-toolbar { position: fixed; right: 24px; bottom: 24px; z-index: 2147483647; display: flex; gap: 6px; padding: 7px; border: 1px solid rgba(255,255,255,.16); border-radius: 9px; background: rgba(20,22,28,.94); box-shadow: 0 8px 30px rgba(0,0,0,.28); backdrop-filter: blur(16px); font: 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  #bilihub-toolbar button { padding: 7px 10px; border: 0; border-radius: 5px; background: transparent; color: #dfe3ea; cursor: pointer; }
  #bilihub-toolbar button:hover, #bilihub-toolbar button.active { background: #fb7299; color: white; }
`

function installToolbar() {
  if (document.getElementById('bilihub-toolbar')) return
  const style = document.createElement('style')
  style.textContent = toolbarStyle
  document.head.appendChild(style)
  const toolbar = document.createElement('div')
  toolbar.id = 'bilihub-toolbar'
  toolbar.innerHTML = '<button data-action="account">登录</button><button data-action="panel">面板</button><button data-action="danmaku">弹幕</button><button data-action="download">下载</button><button data-action="capture">截图</button>'
  toolbar.addEventListener('click', async (event) => {
    const button = event.target.closest('button')
    if (!button) return
    const action = button.dataset.action
    if (action === 'capture') await window.bilihubNative.screenshot()
    if (action === 'download') await window.bilihubNative.download({ filename: `bilihub-${Date.now()}.bin` })
    if (action === 'panel') await window.bilihubNative.openPanel()
    if (action === 'account') {
      const status = await window.bilihubNative.auth.status()
      if (status?.isLogin) {
        const next = await window.bilihubNative.auth.logout()
        button.textContent = next ? '已退出' : '登录'
      } else {
        button.textContent = '登录中…'
        const result = await window.bilihubNative.auth.login()
        button.textContent = result?.isLogin ? (result.name || '已登录') : '登录'
      }
    }
    if (action === 'danmaku') { document.body.classList.toggle('bilihub-danmaku-off'); button.classList.toggle('active') }
  })
  document.body.appendChild(toolbar)

  // 打开时同步账号按钮文案
  window.bilihubNative.auth.status().then((status) => {
    const button = toolbar.querySelector('button[data-action="account"]')
    if (button && status?.isLogin) button.textContent = status.name || '已登录'
  }).catch(() => {})
}

window.addEventListener('DOMContentLoaded', installToolbar, { once: true })

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const runtimePath = require('node:path').resolve(__dirname, '../packages/runtime/dist/install.js')
    const { pathToFileURL } = require('node:url')
    const modulesPath = require('node:path').resolve(__dirname, '../packages/modules/dist/index.js')
    const { installRuntime } = await import(pathToFileURL(runtimePath).href)
    const { ambientLight, customNavbar, darkMode, adBlock, danmakuEnhance, commentsEnhance, screenshot, sponsorSkip, shortcuts, liveEnhance, videoTools, download, danmakuTools } = await import(pathToFileURL(modulesPath).href)
    await installRuntime({
      get: (key) => window.bilihubNative.storage.get(key),
      set: (key, value) => window.bilihubNative.storage.set(key, value),
    }, [adBlock, ambientLight, danmakuEnhance, darkMode, customNavbar, commentsEnhance, screenshot, sponsorSkip, shortcuts, liveEnhance, videoTools, download, danmakuTools])
  } catch (error) {
    console.error('[BiliHub] runtime install failed', error)
  }
}, { once: true })

window.addEventListener('bilihub:screenshot:ready', (event) => {
  const dataUrl = event.detail
  if (typeof dataUrl === 'string') window.bilihubNative.saveData({ dataUrl, filename: `bilihub-${Date.now()}.png` })
})
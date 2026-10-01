// B 站页面注入脚本（沙箱预加载）
// 注意：沙箱预加载里不能 require('node:path') / require('node:url')，
// 也不能通过 window.bilihubNative 访问自己暴露的 API（隔离世界看不到主世界对象），
// 因此这里保留一个本地引用 native 供脚本自身使用。
const { contextBridge, ipcRenderer } = require('electron')

const native = {
  openBilibili: () => ipcRenderer.invoke('bilihub:window:open-bilibili'),
  screenshot: () => ipcRenderer.invoke('bilihub:window:screenshot'),
  platform: () => ipcRenderer.invoke('bilihub:platform'),
  download: (payload) => ipcRenderer.invoke('bilihub:download', payload),
  httpRequest: (options) => ipcRenderer.invoke('bilihub:http:request', options),
  auth: {
    status: () => ipcRenderer.invoke('bilihub:auth:status'),
    login: () => ipcRenderer.invoke('bilihub:auth:login'),
    logout: () => ipcRenderer.invoke('bilihub:auth:logout'),
    diagnose: () => ipcRenderer.invoke('bilihub:auth:diagnose'),
  },
  openPanel: () => ipcRenderer.invoke('bilihub:ui:open'),
  saveData: (payload) => ipcRenderer.invoke('bilihub:download:save-data', payload),
  storage: {
    get: (key) => ipcRenderer.invoke('bilihub:storage:get', key),
    set: (key, value) => ipcRenderer.invoke('bilihub:storage:set', key, value),
    delete: (key) => ipcRenderer.invoke('bilihub:storage:delete', key),
  },
}

contextBridge.exposeInMainWorld('bilihubNative', native)

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
    if (action === 'capture') await native.screenshot()
    if (action === 'download') await native.download({ filename: `bilihub-${Date.now()}.bin` })
    if (action === 'panel') await native.openPanel()
    if (action === 'danmaku') {
      document.body.classList.toggle('bilihub-danmaku-off')
      button.classList.toggle('active')
    }
    if (action === 'account') {
      const accountButton = toolbar.querySelector('button[data-action="account"]')
      const status = await native.auth.status()
      if (status?.isLogin) {
        await native.auth.logout()
        accountButton.textContent = '登录'
        accountButton.classList.remove('active')
      } else {
        accountButton.textContent = '登录中…'
        const result = await native.auth.login()
        const loggedIn = Boolean(result?.isLogin)
        accountButton.textContent = loggedIn ? (result.name || '已登录') : '登录'
        accountButton.classList.toggle('active', loggedIn)
      }
    }
  })
  document.body.appendChild(toolbar)

  syncAccountButton()
  // 登录可能在任意窗口完成，定时同步按钮文案
  setInterval(syncAccountButton, 5000)
}

async function syncAccountButton() {
  const button = document.querySelector('#bilihub-toolbar button[data-action="account"]')
  if (!button) return
  try {
    const status = await native.auth.status()
    if (status?.isLogin) {
      button.textContent = status.name || '已登录'
      button.classList.add('active')
    } else {
      button.textContent = '登录'
      button.classList.remove('active')
    }
  } catch {
    /* 忽略：主进程尚未就绪 */
  }
}

window.addEventListener('DOMContentLoaded', installToolbar, { once: true })

window.addEventListener('DOMContentLoaded', async () => {
  try {
    // 模块产物通过受信任的私有协议提供：
    // 沙箱预加载既没有 __dirname，直接 import file:// 也会被页面安全策略拦截。
    const { installRuntime, createAdapter } = await import('bilihub://runtime/index.js')
    const modules = await import('bilihub://modules/index.js')
    const adapter = createAdapter(native, {
      get: (key) => native.storage.get(key),
      set: (key, value) => native.storage.set(key, value),
    })
    await installRuntime(adapter, [
      modules.adBlock,
      modules.ambientLight,
      modules.danmakuEnhance,
      modules.darkMode,
      modules.customNavbar,
      modules.commentsEnhance,
      modules.screenshot,
      modules.sponsorSkip,
      modules.shortcuts,
      modules.liveEnhance,
      modules.videoTools,
      modules.download,
      modules.danmakuTools,
    ].filter(Boolean))
  } catch (error) {
    console.error('[BiliHub] runtime install failed', error)
  }
}, { once: true })

window.addEventListener('bilihub:screenshot:ready', (event) => {
  const dataUrl = event.detail
  if (typeof dataUrl === 'string') native.saveData({ dataUrl, filename: `bilihub-${Date.now()}.png` })
})

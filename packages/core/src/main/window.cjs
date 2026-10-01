// B 站页面窗口
const { BrowserWindow, app } = require('electron')
const path = require('node:path')

const HOME = 'https://www.bilibili.com/'
/** 允许在窗口内直接跳转的域名 */
const INTERNAL = /^https:\/\/([\w-]+\.)*(bilibili\.com|biliapi\.net|biligame\.com|hdslb\.com)\//

function attachCrashRecovery(window, homeUrl = HOME) {
  let reloads = 0

  // 渲染进程崩溃：自动重载，短时间内反复崩溃则放弃，避免无限重启
  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('[bilihub:window] 渲染进程退出', details.reason)
    if (details.reason === 'clean-exit') return
    if (reloads >= 3) {
      console.error('[bilihub:window] 连续崩溃 3 次，停止自动重载')
      return
    }
    reloads += 1
    setTimeout(() => {
      if (!window.isDestroyed()) window.loadURL(homeUrl)
    }, 800 * reloads)
  })

  // 页面长时间无响应：先尝试重载，仍无响应则提示
  window.webContents.on('unresponsive', () => {
    console.warn('[bilihub:window] 页面无响应，尝试重载')
    if (!window.isDestroyed()) window.webContents.reload()
  })

  window.webContents.on('did-finish-load', () => {
    reloads = 0
  })
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    title: 'BiliHub',
    autoHideMenuBar: true,
    backgroundColor: '#111317',
    webPreferences: {
      preload: path.resolve(__dirname, '../../../../electron/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:bilihub',
    },
  })

  // Widevine 的开关必须在页面导航之前设置
  if (app.isPackaged) {
    try {
      window.webContents.session.setPreloads([path.resolve(__dirname, '../../../../electron/preload.cjs')])
    } catch {
      /* 忽略 */
    }
  }

  window.loadURL(HOME)

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (INTERNAL.test(url)) {
      window.loadURL(url)
      window.show()
    }
    return { action: 'deny' }
  })

  attachCrashRecovery(window)
  return window
}

module.exports = { createMainWindow, attachCrashRecovery }

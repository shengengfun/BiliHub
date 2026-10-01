// 自动更新（guide P5-1）
// 仅在打包后启用；开发态直接跳过，避免拿着 dev 版本去比对线上包。
const { app, ipcMain } = require('electron')

let updater = null
let state = { status: 'idle', version: '', progress: 0, error: '' }
let notifyUi = () => {}

function loadUpdater() {
  if (updater) return updater
  try {
    updater = require('electron-updater').autoUpdater
  } catch {
    updater = null
  }
  return updater
}

function push(patch) {
  state = { ...state, ...patch }
  notifyUi(state)
}

function setupUpdater({ getUiWindow }) {
  notifyUi = (payload) => {
    const window = getUiWindow()?.window
    if (window && !window.isDestroyed()) window.webContents.send('bilihub:update:changed', payload)
  }

  ipcMain.handle('bilihub:update:status', () => ({ ...state, supported: Boolean(loadUpdater()), packaged: app.isPackaged }))

  ipcMain.handle('bilihub:update:check', async () => {
    const instance = loadUpdater()
    if (!instance || !app.isPackaged) {
      return { ...state, supported: Boolean(instance), packaged: app.isPackaged }
    }
    push({ status: 'checking', error: '' })
    try {
      await instance.checkForUpdates()
    } catch (error) {
      push({ status: 'error', error: String(error?.message ?? error) })
    }
    return state
  })

  ipcMain.handle('bilihub:update:download', async () => {
    const instance = loadUpdater()
    if (!instance || !app.isPackaged) return state
    push({ status: 'downloading', progress: 0 })
    try {
      await instance.downloadUpdate()
    } catch (error) {
      push({ status: 'error', error: String(error?.message ?? error) })
    }
    return state
  })

  ipcMain.handle('bilihub:update:install', () => {
    const instance = loadUpdater()
    if (!instance || !app.isPackaged) return false
    instance.quitAndInstall()
    return true
  })

  const instance = loadUpdater()
  if (!instance) {
    console.log('[bilihub:update] electron-updater 不可用，已跳过')
    return
  }

  instance.autoDownload = false
  instance.autoInstallOnAppQuit = true

  instance.on('update-available', (info) => push({ status: 'available', version: info.version }))
  instance.on('update-not-available', () => push({ status: 'latest' }))
  instance.on('download-progress', (progress) => push({ status: 'downloading', progress: Math.round(progress.percent) }))
  instance.on('update-downloaded', (info) => push({ status: 'ready', version: info.version, progress: 100 }))
  instance.on('error', (error) => push({ status: 'error', error: String(error?.message ?? error) }))

  // 启动后延迟几秒再检查，避免和首屏加载抢带宽
  if (app.isPackaged) {
    setTimeout(() => {
      instance.checkForUpdates().catch((error) => push({ status: 'error', error: String(error?.message ?? error) }))
    }, 6000)
  }
}

module.exports = { setupUpdater }

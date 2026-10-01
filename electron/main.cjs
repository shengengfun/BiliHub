const { app, BrowserWindow, session, ipcMain, globalShortcut, dialog, desktopCapturer } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const adPatterns = [
  /api\.bilibili\.com\/x\/v2\/ad\//i,
  /api\.bilibili\.com\/x\/v2\/activity\//i,
  /bili(?:g|m)eta\.com\/.*(?:ad|advert)/i,
]
let mainWindow

function installRequestFilter() {
  const ses = session.fromPartition('persist:bilihub')
  ses.webRequest.onBeforeRequest({ urls: ['*://*.bilibili.com/*', '*://*.hdslb.com/*'] }, (details, callback) => {
    callback({ cancel: adPatterns.some((pattern) => pattern.test(details.url)) })
  })
  ses.webRequest.onHeadersReceived({ urls: ['*://*.bilibili.com/*'] }, (details, callback) => {
    const headers = { ...details.responseHeaders }
    delete headers['content-security-policy']
    delete headers['Content-Security-Policy']
    callback({ responseHeaders: headers })
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1440, height: 920, minWidth: 1024, minHeight: 680, backgroundColor: '#111317', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, partition: 'persist:bilihub' } })
  installRequestFilter()
  mainWindow.loadURL('https://www.bilibili.com/')
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://www.bilibili.com')) mainWindow.loadURL(url); return { action: 'deny' } })
  globalShortcut.register('CommandOrControl+Shift+S', () => captureWindow())
}

async function captureWindow() {
  if (!mainWindow) return false
  const image = await mainWindow.webContents.capturePage()
  const file = await dialog.showSaveDialog(mainWindow, { defaultPath: `bilihub-${Date.now()}.png`, filters: [{ name: 'PNG image', extensions: ['png'] }] })
  if (file.canceled || !file.filePath) return false
  fs.writeFileSync(file.filePath, image.toPNG())
  return true
}

ipcMain.handle('bilihub:window:open-bilibili', () => mainWindow?.loadURL('https://www.bilibili.com/'))
ipcMain.handle('bilihub:window:screenshot', captureWindow)
ipcMain.handle('bilihub:platform', () => ({ windows: process.platform === 'win32', drm: process.platform === 'win32', touch: false }))
ipcMain.handle('bilihub:download', async (_event, { url, filename }) => {
  if (!url) return { queued: true, filename }
  const ses = session.fromPartition('persist:bilihub')
  return new Promise((resolve) => { ses.downloadURL(url); ses.once('will-download', (_event, item) => { item.setSaveDialogOptions({ defaultPath: filename }); item.once('done', (_event, state) => resolve({ queued: true, state })) }) })
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('will-quit', () => globalShortcut.unregisterAll())
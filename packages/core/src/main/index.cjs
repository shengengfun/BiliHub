const { app, globalShortcut } = require('electron')
const path = require('node:path')
const { setupSession } = require('./session.cjs')
const { setupWebRequest } = require('./web-request.cjs')
const { createMainWindow } = require('./window.cjs')
const { createUiWindow } = require('./ui-window.cjs')
const { setupIpc } = require('./ipc.cjs')
const { createStorage } = require('./storage.cjs')

let mainWindow
let uiWindow

app.whenReady().then(() => {
  if (process.platform === 'win32') app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport')
  const ses = setupSession()
  setupWebRequest(ses)

  const storage = createStorage(path.join(app.getPath('userData'), 'bilihub-settings.json'))
  setupIpc({ getWindow: () => mainWindow, getUiWindow: () => uiWindow, storage })

  mainWindow = createMainWindow()
  uiWindow = createUiWindow()

  // 启动时展示客户端面板，B 站页面窗口同时打开
  uiWindow.window.once('ready-to-show', () => uiWindow.show())

  globalShortcut.register('CommandOrControl+Shift+S', () => mainWindow?.webContents.send('bilihub:shortcut:screenshot'))
  globalShortcut.register('CommandOrControl+Shift+B', () => uiWindow?.show())
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('will-quit', () => globalShortcut.unregisterAll())
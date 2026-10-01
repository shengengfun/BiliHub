const { app, globalShortcut } = require('electron')
const path = require('node:path')
const { setupSession } = require('./session.cjs')
const { setupWebRequest } = require('./web-request.cjs')
const { createMainWindow } = require('./window.cjs')
const { setupIpc } = require('./ipc.cjs')
const { createStorage } = require('./storage.cjs')

let mainWindow

app.whenReady().then(() => {
  if (process.platform === 'win32') app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport')
  const ses = setupSession(); setupWebRequest(ses)
  const storage = createStorage(path.join(app.getPath('userData'), 'bilihub-settings.json'))
  setupIpc({ getWindow: () => mainWindow, storage })
  mainWindow = createMainWindow()
  globalShortcut.register('CommandOrControl+Shift+S', () => mainWindow?.webContents.send('bilihub:shortcut:screenshot'))
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('will-quit', () => globalShortcut.unregisterAll())
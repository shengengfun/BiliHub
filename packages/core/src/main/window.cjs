const { BrowserWindow } = require('electron')
const path = require('node:path')

function createMainWindow() {
  const window = new BrowserWindow({ width: 1440, height: 920, minWidth: 1024, minHeight: 680, backgroundColor: '#111317', webPreferences: { preload: path.resolve(__dirname, '../../../../electron/preload.cjs'), contextIsolation: true, nodeIntegration: false, partition: 'persist:bilihub' } })
  window.loadURL('https://www.bilibili.com/')
  window.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://www.bilibili.com')) window.loadURL(url); return { action: 'deny' } })
  return window
}

module.exports = { createMainWindow }
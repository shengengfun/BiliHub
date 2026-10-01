const { ipcMain, dialog, session } = require('electron')
const fs = require('node:fs')

function setupIpc({ getWindow, storage }) {
  ipcMain.handle('bilihub:storage:get', (_event, key) => storage.get(key))
  ipcMain.handle('bilihub:storage:set', (_event, key, value) => storage.set(key, value))
  ipcMain.handle('bilihub:storage:delete', (_event, key) => storage.delete(key))
  ipcMain.handle('bilihub:platform', () => ({ platform: process.platform, drm: process.platform === 'win32', touch: false }))
  ipcMain.handle('bilihub:window:open-bilibili', () => getWindow()?.loadURL('https://www.bilibili.com/'))
  ipcMain.handle('bilihub:window:screenshot', async () => {
    const window = getWindow(); if (!window) return false
    const image = await window.webContents.capturePage(); const result = await dialog.showSaveDialog(window, { defaultPath: `bilihub-${Date.now()}.png`, filters: [{ name: 'PNG image', extensions: ['png'] }] })
    if (result.canceled || !result.filePath) return false
    fs.writeFileSync(result.filePath, image.toPNG()); return true
  })
  ipcMain.handle('bilihub:download', async (_event, { url, filename }) => {
    if (!url) return { queued: true, filename }
    const ses = session.fromPartition('persist:bilihub')
    return new Promise((resolve) => { ses.downloadURL(url); ses.once('will-download', (_downloadEvent, item) => { item.setSaveDialogOptions({ defaultPath: filename }); item.once('done', (_doneEvent, state) => resolve({ queued: true, state })) }) })
  })
}

module.exports = { setupIpc }
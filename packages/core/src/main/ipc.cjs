const { ipcMain, dialog, session, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const API_HOSTS = ['api.bilibili.com', 'api.live.bilibili.com', 'api.biliapi.net']

async function sessionFetch(url, responseType) {
  const target = new URL(url)
  if (!API_HOSTS.includes(target.hostname)) throw new Error(`Domain not allowed: ${target.hostname}`)
  const ses = session.fromPartition('persist:bilihub')
  const response = await ses.fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Origin: 'https://www.bilibili.com' } })
  return response
}

function setupIpc({ getWindow, getUiWindow, storage }) {
  ipcMain.handle('bilihub:storage:get', (_event, key) => storage.get(key))
  ipcMain.handle('bilihub:storage:set', (_event, key, value) => storage.set(key, value))
  ipcMain.handle('bilihub:storage:delete', (_event, key) => storage.delete(key))
  ipcMain.handle('bilihub:platform', () => ({ platform: process.platform, drm: process.platform === 'win32', touch: false }))
  ipcMain.handle('bilihub:http:request', async (_event, options) => {
    const url = new URL(options.url)
    const allowed = ['bilibili.com', 'biliapi.net', 'hdslb.com']
    if (!allowed.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new Error(`Domain not allowed: ${url.hostname}`)
    const response = await session.fromPartition('persist:bilihub').fetch(options.url, { method: options.method ?? 'GET', headers: options.headers, body: options.body })
    const data = options.responseType === 'text' ? await response.text() : await response.json()
    return { status: response.status, data }
  })
  ipcMain.handle('bilihub:window:open-bilibili', () => getWindow()?.loadURL('https://www.bilibili.com/'))
  ipcMain.handle('bilihub:window:screenshot', async () => {
    const window = getWindow(); if (!window) return false
    const image = await window.webContents.capturePage(); const result = await dialog.showSaveDialog(window, { defaultPath: `bilihub-${Date.now()}.png`, filters: [{ name: 'PNG image', extensions: ['png'] }] })
    if (result.canceled || !result.filePath) return false
    fs.writeFileSync(result.filePath, image.toPNG()); return true
  })
  ipcMain.handle('bilihub:download:save-data', async (_event, { dataUrl, filename }) => {
    const window = getWindow(); if (!window || typeof dataUrl !== 'string') return false
    const result = await dialog.showSaveDialog(window, { defaultPath: filename || `bilihub-${Date.now()}.png`, filters: [{ name: 'PNG image', extensions: ['png'] }] })
    if (result.canceled || !result.filePath) return false
    fs.writeFileSync(result.filePath, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'))
    return true
  })
  ipcMain.handle('bilihub:bili:api', async (_event, url) => {
    const response = await sessionFetch(url)
    const text = await response.text()
    try { return { status: response.status, data: JSON.parse(text) } } catch { return { status: response.status, data: null } }
  })
  ipcMain.handle('bilihub:bili:text', async (_event, url) => {
    const response = await sessionFetch(url)
    return response.text()
  })
  ipcMain.handle('bilihub:ui:open', (_event, route) => getUiWindow()?.show(route))
  ipcMain.handle('bilihub:ui:close', () => getUiWindow()?.hide())
  ipcMain.handle('bilihub:plugins:reveal', () => { const dir = pluginsDir(); fs.mkdirSync(dir, { recursive: true }); shell.openPath(dir) })
  ipcMain.handle('bilihub:download', async (_event, { url, filename }) => {
    if (!url) return { queued: true, filename }
    const ses = session.fromPartition('persist:bilihub')
    return new Promise((resolve) => { ses.downloadURL(url); ses.once('will-download', (_downloadEvent, item) => { item.setSaveDialogOptions({ defaultPath: filename }); item.once('done', (_doneEvent, state) => resolve({ queued: true, state })) }) })
  })
}

function pluginsDir() {
  const { app } = require('electron')
  return path.join(app.getPath('userData'), 'plugins')
}

module.exports = { setupIpc, pluginsDir }
const { ipcMain, dialog, session, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const auth = require('./auth.cjs')
const download = require('./download.cjs')
const modules = require('./modules.cjs')
const plugins = require('./plugins.cjs')
const capture = require('./capture.cjs')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const REFERER = 'https://www.bilibili.com/'
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
  ipcMain.handle('bilihub:platform', () => ({
    platform: process.platform,
    // Widevine 只在 castlabs 构建里可用；打包与否不能说明问题，直接看版本号里有没有 wvcus 标记
    drm: /wvcus/i.test(process.versions.electron ?? ''),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    touch: false,
  }))
  ipcMain.handle('bilihub:http:request', async (_event, options) => {
    const url = new URL(options.url)
    const allowed = ['bilibili.com', 'biliapi.net', 'hdslb.com']
    if (!allowed.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new Error(`Domain not allowed: ${url.hostname}`)
    const response = await session.fromPartition('persist:bilihub').fetch(options.url, { method: options.method ?? 'GET', headers: options.headers, body: options.body })
    const data = options.responseType === 'text' ? await response.text() : await response.json()
    return { status: response.status, data }
  })
  ipcMain.handle('bilihub:window:open-bilibili', (_event, url) => {
    const target = typeof url === 'string' && /^https:\/\/([\w-]+\.)*(bilibili\.com|biliapi\.net)\//.test(url) ? url : 'https://www.bilibili.com/'
    const window = getWindow()
    if (window) {
      window.show()
      return window.loadURL(target)
    }
    return false
  })
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
  // 写操作（发弹幕、点赞等）：显式带 Cookie + csrf
  ipcMain.handle('bilihub:bili:post', async (_event, { url, body, contentType }) => {
    const target = new URL(url)
    if (!API_HOSTS.includes(target.hostname)) throw new Error(`Domain not allowed: ${target.hostname}`)
    const cookie = await auth.cookieHeader()
    const csrf = await auth.csrfToken()
    const payload = new URLSearchParams(body ?? {})
    if (csrf) payload.set('csrf', csrf)
    if (!csrf) return { status: 403, data: { code: -111, message: '未登录，缺少 csrf token' } }
    const response = await session.fromPartition('persist:bilihub').fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        Referer: REFERER,
        Origin: 'https://www.bilibili.com',
        Cookie: cookie,
        'Content-Type': contentType || 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    })
    const text = await response.text()
    try { return { status: response.status, data: JSON.parse(text) } } catch { return { status: response.status, data: null } }
  })

  // ---- 页面请求捕获（替代自行实现 WBI 签名）----
  ipcMain.handle('bilihub:capture:wait', (_event, pattern, timeoutMs) => capture.wait(pattern, timeoutMs))
  ipcMain.handle('bilihub:capture:cached', (_event, pattern) => capture.cached(pattern))
  ipcMain.handle('bilihub:capture:page', (_event, options) => capture.captureViaPage(options))
  ipcMain.handle('bilihub:capture:clear', () => capture.clear())

  ipcMain.handle('bilihub:auth:status', () => auth.getStatus())
  ipcMain.handle('bilihub:auth:login', async () => {
    const result = await auth.openLogin(getUiWindow()?.window ?? getWindow())
    // 登录成功后通知面板刷新账号信息
    if (result?.isLogin) getUiWindow()?.window?.webContents.send('bilihub:auth:changed', result)
    return result
  })
  ipcMain.handle('bilihub:auth:logout', () => auth.logout())
  ipcMain.handle('bilihub:auth:diagnose', () => auth.diagnose())
  ipcMain.handle('bilihub:ui:open', (_event, route) => getUiWindow()?.show(route))
  ipcMain.handle('bilihub:ui:close', () => getUiWindow()?.hide())
  ipcMain.handle('bilihub:plugins:reveal', () => plugins.reveal())

  // ---- 模块 ----（列表带启用状态）
  ipcMain.handle('bilihub:modules:list', () => modules.listModules(storage))
  ipcMain.handle('bilihub:modules:get-settings', (_event, id) => modules.getModuleSettings(storage, id))
  ipcMain.handle('bilihub:modules:set-setting', (_event, id, key, value) => modules.setModuleSetting(storage, id, key, value))
  ipcMain.handle('bilihub:modules:set-enabled', (_event, id, enabled) => { storage.set(`module:${id}:enabled`, Boolean(enabled)); return true })

  // ---- 插件 ----
  ipcMain.handle('bilihub:plugins:list', () => plugins.list(storage))
  ipcMain.handle('bilihub:plugins:set-enabled', (_event, id, enabled) => plugins.setEnabled(id, enabled, storage))
  ipcMain.handle('bilihub:plugins:source', (_event, id) => plugins.readSource(id, storage))
  ipcMain.handle('bilihub:plugins:install-bundled', () => plugins.installBundled())

  // ---- 下载管理 ----
  download.setNotifier((payload) => {
    const window = getUiWindow()?.window
    if (window && !window.isDestroyed()) window.webContents.send('bilihub:download:changed', payload)
  })
  ipcMain.handle('bilihub:download:create', (_event, options) => download.create(options))
  ipcMain.handle('bilihub:download:list', () => download.list())
  ipcMain.handle('bilihub:download:pause', (_event, id) => download.pause(id))
  ipcMain.handle('bilihub:download:resume', (_event, id) => download.resume(id))
  ipcMain.handle('bilihub:download:cancel', (_event, id) => download.cancel(id))
  ipcMain.handle('bilihub:download:remove', (_event, id) => download.remove(id))
  ipcMain.handle('bilihub:download:open-folder', (_event, id) => download.openFolder(id))
  ipcMain.handle('bilihub:download:dir', () => download.downloadsDir())

  // ---- 设置导入导出 ----
  ipcMain.handle('bilihub:settings:export', async () => {
    const window = getUiWindow()?.window
    const payload = JSON.stringify(
      { version: 1, app: 'BiliHub', exportedAt: new Date().toISOString(), values: storage.all() },
      null,
      2,
    )
    const result = await dialog.showSaveDialog(window, {
      defaultPath: `bilihub-settings-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { ok: false }
    fs.writeFileSync(result.filePath, payload, 'utf8')
    return { ok: true, filePath: result.filePath, count: Object.keys(storage.all()).length }
  })

  ipcMain.handle('bilihub:settings:import', async (_event, { replace } = {}) => {
    const window = getUiWindow()?.window
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePaths.length) return { ok: false }
    try {
      const raw = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'))
      const values = raw?.values ?? raw
      const count = storage.merge(values, Boolean(replace))
      return { ok: true, count, filePath: result.filePaths[0] }
    } catch (error) {
      return { ok: false, error: String(error?.message ?? error) }
    }
  })
}

module.exports = { setupIpc, pluginsDir: plugins.pluginsDir }
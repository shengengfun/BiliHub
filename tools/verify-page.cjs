// 验证：预加载脚本、模块运行时、各模块是否真的在 B 站页面里生效
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const { setupSession } = require('../packages/core/src/main/session.cjs')
const { setupWebRequest } = require('../packages/core/src/main/web-request.cjs')
const { setupIpc } = require('../packages/core/src/main/ipc.cjs')
const { createStorage } = require('../packages/core/src/main/storage.cjs')
const { registerSchemes, setupProtocol } = require('../packages/core/src/main/assets-protocol.cjs')

const WAIT_MS = Number(process.env.VERIFY_WAIT ?? 9000)

registerSchemes()

app.whenReady().then(async () => {
  const ses = setupSession()
  setupProtocol(ses)
  setupWebRequest(ses)
  const storage = createStorage(path.join(app.getPath('userData'), 'bilihub-settings.json'))
  setupIpc({ getWindow: () => null, getUiWindow: () => null, storage })

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      partition: 'persist:bilihub',
      preload: path.resolve(__dirname, '../electron/preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  const errors = []
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) errors.push(message)
    console.log(`[page:${level}]`, message.slice(0, 300))
  })

  await win.loadURL('https://www.bilibili.com/')

  // 诊断：页面能否拿到 bilihub:// 产物
  const diag = await win.webContents.executeJavaScript(`(async () => {
    const out = {}
    try {
      const response = await fetch('bilihub://runtime/install.js')
      out.fetchStatus = response.status
      out.contentType = response.headers.get('content-type') || ''
      out.length = (await response.text()).length
    } catch (error) { out.fetchError = String(error) }
    try { await import('bilihub://runtime/install.js'); out.importState = 'ok' } catch (error) { out.importError = String(error) }
    return out
  })()`)
  console.log('[diag]', JSON.stringify(diag))

  await new Promise((resolve) => setTimeout(resolve, WAIT_MS))

  const result = await win.webContents.executeJavaScript(`(() => {
    const styleIds = [...document.querySelectorAll('style[id^="bilihub-"]')].map((node) => node.id)
    return {
      nativeExposed: typeof window.bilihubNative,
      toolbar: Boolean(document.getElementById('bilihub-toolbar')),
      accountButtonText: document.querySelector('#bilihub-toolbar button[data-action="account"]')?.textContent ?? '',
      injectedStyles: styleIds,
      injectedStyleCount: styleIds.length,
      sponsorButton: Boolean(document.getElementById('bilihub-sponsor-skip')),
    }
  })()`)

  console.log('\n===== VERIFY RESULT =====')
  console.log(JSON.stringify(result, null, 2))
  console.log('errorCount:', errors.length)
  if (errors.length) console.log('errors:', JSON.stringify(errors.slice(0, 10), null, 2))
  app.quit()
})

app.on('window-all-closed', () => app.quit())

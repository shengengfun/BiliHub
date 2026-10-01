// 页面请求捕获中枢
// guide.md 明确要求「不自己实现 WBI 签名，优先拦截页面已有请求」。
// 实现方式：用 Chrome DevTools Protocol 的 Network 域监听 webContents 的网络响应，
// 这样能拿到页面主世界自身发起的所有请求（隔离世界的 XHR/fetch hook 拿不到）。
const { BrowserWindow } = require('electron')
const path = require('node:path')

const PARTITION = 'persist:bilihub'
const DEFAULT_TIMEOUT = 20000
const MAX_BODY = 8 * 1024 * 1024

/** 关心的接口：B 站 Web 接口全部走 api.bilibili.com/x/ 与直播接口 */
const INTERESTING = [/^https?:\/\/api\.bilibili\.com\/x\//, /^https?:\/\/api\.live\.bilibili\.com\//]

/** @type {Map<string, {url:string, text:string, json:any, base64:string, mime:string, at:number}>} */
const cache = new Map()
/** @type {{pattern:RegExp, resolve:Function, timer:any}[]} */
const waiters = []

function cacheKey(url) {
  const target = new URL(url)
  return `${target.origin}${target.pathname}`
}

function store(url, { text, json, base64, mime }) {
  const key = cacheKey(url)
  cache.set(key, { url, text: text ?? '', json: json ?? null, base64: base64 ?? '', mime: mime ?? '', at: Date.now() })
  for (let index = waiters.length - 1; index >= 0; index -= 1) {
    const waiter = waiters[index]
    if (waiter.pattern.test(url)) {
      clearTimeout(waiter.timer)
      waiters.splice(index, 1)
      waiter.resolve(cache.get(key))
    }
  }
}

/**
 * 给一个 webContents 挂上网络捕获。
 * @param {Electron.WebContents} webContents
 * @returns {() => void} 卸载函数
 */
function attach(webContents) {
  const debuggerApi = webContents.debugger
  const inflight = new Map()
  let disposed = false

  const onMessage = async (_event, method, params) => {
    if (disposed) return
    if (method === 'Network.responseReceived') {
      const { requestId, response, type } = params ?? {}
      const url = response?.url ?? ''
      if (!url || !INTERESTING.some((pattern) => pattern.test(url))) return
      if (type === 'Preflight') return
      inflight.set(requestId, { url, mime: response.mimeType || '' })
      return
    }
    if (method === 'Network.loadingFinished') {
      const { requestId } = params ?? {}
      const meta = inflight.get(requestId)
      if (!meta) return
      inflight.delete(requestId)
      try {
        const result = await debuggerApi.sendCommand('Network.getResponseBody', { requestId })
        if (!result?.body) return
        // getResponseBody 的 body 一律是字符串；base64Encoded 表示二进制
        if (result.base64Encoded) {
          if (result.body.length > MAX_BODY) return
          store(meta.url, { base64: result.body, mime: meta.mime })
          return
        }
        if (result.body.length > MAX_BODY) return
        let json = null
        if (/json/i.test(meta.mime) || result.body.trimStart().startsWith('{')) {
          try {
            json = JSON.parse(result.body)
          } catch {
            json = null
          }
        }
        store(meta.url, { text: result.body, json, mime: meta.mime })
      } catch {
        /* 响应体可能已被丢弃，忽略 */
      }
    }
  }

  try {
    if (!debuggerApi.isAttached()) debuggerApi.attach('1.3')
    debuggerApi.on('message', onMessage)
    debuggerApi.sendCommand('Network.enable', { maxResourceBufferSize: MAX_BODY, maxTotalBufferSize: 64 * 1024 * 1024 })
  } catch {
    return () => {}
  }

  return () => {
    disposed = true
    try {
      debuggerApi.removeListener('message', onMessage)
      if (debuggerApi.isAttached()) debuggerApi.detach()
    } catch {
      /* 已销毁 */
    }
  }
}

/**
 * 等待某个 URL 模式的响应出现。
 * @param {string|RegExp} pattern
 * @param {number} timeoutMs
 */
function wait(pattern, timeoutMs = DEFAULT_TIMEOUT) {
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern)
  const existing = findCached(regex)
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const index = waiters.findIndex((item) => item.timer === timer)
      if (index >= 0) waiters.splice(index, 1)
      reject(new Error(`等待页面请求超时：${regex}`))
    }, timeoutMs)
    waiters.push({ pattern: regex, resolve, timer })
  })
}

function findCached(regex) {
  let latest = null
  for (const record of cache.values()) {
    if (regex.test(record.url) && (!latest || record.at > latest.at)) latest = record
  }
  return latest
}

/**
 * 用隐藏窗口打开真实页面，捕获其中匹配 pattern 的接口响应。
 * @param {{pageUrl:string, pattern:string|RegExp, timeoutMs?:number, waitAfterLoad?:number}} options
 */
async function captureViaPage({ pageUrl, pattern, timeoutMs = DEFAULT_TIMEOUT, waitAfterLoad = 0 }) {
  let regex
  try {
    regex = pattern instanceof RegExp ? pattern : new RegExp(pattern)
  } catch {
    regex = null
  }

  // 已有缓存直接用，避免无谓地开窗口
  if (regex) {
    const existing = findCached(regex)
    if (existing && Date.now() - existing.at < 60_000) return existing
  }

  const pending = regex ? wait(regex, timeoutMs) : Promise.resolve(null)
  const window = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: false,
    },
  })
  window.webContents.setAudioMuted(true)
  const detach = attach(window.webContents)

  try {
    try {
      await window.loadURL(pageUrl)
    } catch {
      /* 页面自身报错不影响捕获 */
    }
    if (waitAfterLoad > 0) await new Promise((resolve) => setTimeout(resolve, waitAfterLoad))
    return regex ? await pending : null
  } finally {
    detach()
    if (!window.isDestroyed()) window.destroy()
  }
}

function cached(pattern) {
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern)
  return findCached(regex)
}

function clear() {
  cache.clear()
}

module.exports = { attach, wait, captureViaPage, cached, clear, PARTITION, preloadPath: () => path.resolve(__dirname, '../../../../electron/preload.cjs') }

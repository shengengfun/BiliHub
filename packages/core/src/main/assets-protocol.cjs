// 自定义协议 bilihub://
// 页面预加载脚本运行在沙箱里，既没有 __dirname，也不能直接 import file://（会被页面安全策略拦截）。
// 这里把构建产物通过一个受信任的私有协议暴露出去，供 B 站页面里的 preload 动态 import。
const { protocol, session } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

/** 路由前缀 → 磁盘目录 */
const ROUTES = {
  runtime: path.resolve(__dirname, '../../../runtime/dist'),
  modules: path.resolve(__dirname, '../../../modules/dist'),
  shared: path.resolve(__dirname, '../../../shared/dist'),
}

/** 必须在 app ready 之前调用 */
function registerSchemes() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'bilihub',
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
    },
  ])
}

function mimeOf(file) {
  if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript; charset=utf-8'
  if (file.endsWith('.json')) return 'application/json; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.map')) return 'application/json; charset=utf-8'
  return 'application/octet-stream'
}

/**
 * 页面源是 https://www.bilibili.com，动态 import 属于跨源请求，
 * 必须返回 CORS 头，否则会被浏览器拦截。
 */
function headers(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    ...extra,
  }
}

function fail(status, message) {
  return new Response(message, { status, headers: headers({ 'Content-Type': 'text/plain; charset=utf-8' }) })
}

/**
 * 在 app ready 之后调用。
 * 注意：必须注册到页面实际使用的会话（persist:bilihub），
 * 模块级 protocol.handle 只作用于默认会话。
 * @param {Electron.Session} [targetSession]
 */
function setupProtocol(targetSession) {
  const target = targetSession ?? session.defaultSession
  target.protocol.handle('bilihub', (request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers() })

    let url
    try {
      url = new URL(request.url)
    } catch {
      return fail(400, 'bad request')
    }

    // bilihub://runtime/install.js → hostname=runtime, pathname=/install.js
    const base = ROUTES[url.hostname]
    if (!base) return fail(404, `unknown route: ${url.hostname}`)

    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    const target = path.resolve(base, relative)
    // 防目录穿越
    if (target !== base && !target.startsWith(base + path.sep)) return fail(403, 'forbidden')
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return fail(404, `not found: ${relative}`)

    return new Response(fs.readFileSync(target), { headers: headers({ 'Content-Type': mimeOf(target) }) })
  })
}

/** 供 preload 使用的固定入口地址 */
const RUNTIME_ENTRY = 'bilihub://runtime/install.js'
const MODULES_ENTRY = 'bilihub://modules/index.js'

module.exports = { registerSchemes, setupProtocol, RUNTIME_ENTRY, MODULES_ENTRY, ROUTES }

// B 站 HTTP 访问层
//
// 优先走 Electron 会话的 fetch（自带 Cookie 与代理设置），
// 但实测同一会话内连续调用偶发 ERR_BLOCKED_BY_CLIENT，
// 因此统一在这里回退到 Node 全局 fetch，并把 Cookie 显式带上。
const { session } = require('electron')

const PARTITION = 'persist:bilihub'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const REFERER = 'https://www.bilibili.com/'

function biliSession() {
  return session.fromPartition(PARTITION)
}

let cachedCookie = { value: '', at: 0 }

/** 读取会话内的 B 站 Cookie；2 秒内复用，避免高频轮询反复查询 */
async function cookieHeader(force = false) {
  const now = Date.now()
  if (!force && now - cachedCookie.at < 2000) return cachedCookie.value
  try {
    const cookies = await biliSession().cookies.get({ domain: 'bilibili.com' })
    const value = cookies.filter((item) => item.value).map((item) => `${item.name}=${item.value}`).join('; ')
    cachedCookie = { value, at: now }
    return value
  } catch {
    return ''
  }
}

/** bili_jct，写操作接口必须携带 */
async function csrfToken() {
  try {
    const cookies = await biliSession().cookies.get({ domain: 'bilibili.com', name: 'bili_jct' })
    return cookies[0]?.value ?? ''
  } catch {
    return ''
  }
}

function invalidateCookieCache() {
  cachedCookie = { value: '', at: 0 }
}

async function request(url, { method = 'GET', headers = {}, body, cookie, referer, useSessionFirst = true } = {}) {
  const finalHeaders = {
    'User-Agent': UA,
    Referer: referer ?? REFERER,
    ...headers,
  }
  if (method !== 'GET') finalHeaders.Origin = 'https://www.bilibili.com'
  // 没有显式传入就自动补 Cookie；写操作需要它，读操作带上也无害
  const cookieValue = cookie !== undefined ? cookie : await cookieHeader()
  if (cookieValue) finalHeaders.Cookie = cookieValue
  if (body && !finalHeaders['Content-Type']) finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded'

  if (useSessionFirst) {
    try {
      return await biliSession().fetch(url, { method, headers: finalHeaders, body })
    } catch {
      /* 落到 Node fetch */
    }
  }
  return fetch(url, { method, headers: finalHeaders, body })
}

async function getJson(url, options) {
  const response = await request(url, options)
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return { code: -1, message: '响应不是 JSON', raw: text.slice(0, 500) }
  }
}

async function getText(url, options) {
  const response = await request(url, options)
  return response.text()
}

/** 表单 POST，自动补 csrf */
async function postForm(url, fields) {
  const csrf = await csrfToken()
  if (!csrf) return { code: -111, message: '未登录，缺少 csrf token' }
  const payload = new URLSearchParams({ ...fields, csrf })
  const response = await request(url, { method: 'POST', body: payload.toString() })
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return { code: -1, message: '响应不是 JSON', raw: text.slice(0, 500) }
  }
}

module.exports = { biliSession, cookieHeader, csrfToken, invalidateCookieCache, request, getJson, getText, postForm, UA, REFERER, PARTITION }

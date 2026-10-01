const { BrowserWindow, session } = require('electron')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const NAV_URL = 'https://api.bilibili.com/x/web-interface/nav'
const LOGIN_URL = 'https://passport.bilibili.com/login'
const PARTITION = 'persist:bilihub'

function biliSession() {
  return session.fromPartition(PARTITION)
}

/** 读取会话中所有 bilibili 域 Cookie，拼成请求头 */
async function cookieHeader() {
  const cookies = await biliSession().cookies.get({ domain: 'bilibili.com' })
  return cookies.filter((cookie) => cookie.value).map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
}

async function hasLoginCookie() {
  const cookies = await biliSession().cookies.get({ domain: 'bilibili.com' })
  return cookies.some((cookie) => cookie.name === 'SESSDATA' && cookie.value)
}

/**
 * 请求 nav 接口判定登录态。
 * 显式附带 Cookie 头（不依赖 fetch 的默认凭据策略），失败时回退 Node fetch。
 */
async function requestNav() {
  const cookie = await cookieHeader()
  const headers = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' }
  if (cookie) headers.Cookie = cookie

  try {
    const response = await biliSession().fetch(NAV_URL, { headers, credentials: 'include' })
    return await response.json()
  } catch (error) {
    const response = await fetch(NAV_URL, { headers })
    return await response.json()
  }
}

function mapUser(data) {
  return {
    isLogin: true,
    mid: data.mid,
    name: data.uname,
    face: data.face,
    level: data.level_info?.current_level ?? 0,
    vip: Boolean(data.vipStatus),
    vipLabel: data.vip_label?.text ?? '',
    coin: data.money ?? 0,
    bcoin: data.wallet?.bcoin_balance ?? 0,
    following: data.following ?? 0,
    follower: data.follower ?? 0,
  }
}

/** 查询当前登录状态；未登录返回 { isLogin: false } */
async function getStatus() {
  try {
    const nav = await requestNav()
    if (nav?.data?.isLogin) return mapUser(nav.data)
    return { isLogin: false, code: nav?.code ?? null, hasCookie: await hasLoginCookie() }
  } catch (error) {
    return { isLogin: false, error: String(error?.message ?? error) }
  }
}

/**
 * 打开官方登录页。登录成功后 Cookie 写入 persist:bilihub 会话。
 * 每 1.5s 检测一次：接口 isLogin 或 SESSDATA Cookie 出现即视为成功。
 */
function openLogin(parent) {
  return new Promise((resolve) => {
    let settled = false
    let ticks = 0
    const finish = (result) => {
      if (settled) return
      settled = true
      clearInterval(timer)
      resolve(result)
    }

    const win = new BrowserWindow({
      width: 460,
      height: 680,
      parent: parent ?? undefined,
      modal: false,
      title: '登录哔哩哔哩',
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
      webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false },
    })
    win.loadURL(LOGIN_URL)
    win.webContents.on('did-finish-load', () => console.log('[bilihub:auth] 登录页已加载:', win.webContents.getURL()))
    win.webContents.on('did-navigate', (_e, url) => console.log('[bilihub:auth] 登录页跳转:', url))

    const timer = setInterval(async () => {
      ticks += 1
      try {
        const nav = await requestNav()
        if (nav?.data?.isLogin) {
          console.log('[bilihub:auth] 登录成功（接口判据）:', nav.data.uname, 'tid', ticks)
          finish(mapUser(nav.data))
          if (!win.isDestroyed()) win.close()
          return
        }
        if (ticks % 4 === 0) {
          const has = await hasLoginCookie()
          console.log(`[bilihub:auth] 轮询 #${ticks} code=${nav?.code} SESSDATA=${has}`)
        }
      } catch (error) {
        if (ticks % 8 === 0) console.warn('[bilihub:auth] 轮询异常:', String(error?.message ?? error))
      }
    }, 1500)

    win.on('closed', () => finish({ isLogin: false }))
  })
}

/** 退出登录：清理 B 站相关站点数据 */
async function logout() {
  await biliSession().clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'] })
  return true
}

/** 诊断信息：定位登录状态异常原因 */
async function diagnose() {
  const cookies = await biliSession().cookies.get({ domain: 'bilibili.com' })
  const names = cookies.map((cookie) => cookie.name)
  let nav = null
  let error = null
  try {
    const json = await requestNav()
    nav = { code: json.code, isLogin: json.data?.isLogin ?? false, uname: json.data?.uname ?? null }
  } catch (e) {
    error = String(e?.message ?? e)
  }
  return { cookieCount: cookies.length, hasSESSDATA: names.includes('SESSDATA'), cookieNames: names, nav, error }
}

module.exports = { getStatus, openLogin, logout, diagnose, biliSession, UA }

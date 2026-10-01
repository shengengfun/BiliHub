const { BrowserWindow } = require('electron')
const { biliSession, cookieHeader, csrfToken, invalidateCookieCache, getJson, UA, PARTITION } = require('./http.cjs')

const NAV_URL = 'https://api.bilibili.com/x/web-interface/nav'
const LOGIN_URL = 'https://passport.bilibili.com/login'
const SPACE_API = 'https://api.bilibili.com/x/space/wbi/acc/info'

async function hasLoginCookie() {
  const cookies = await biliSession().cookies.get({ domain: 'bilibili.com' })
  return cookies.some((cookie) => cookie.name === 'SESSDATA' && cookie.value)
}

/** 请求 nav 接口判定登录态 */
async function requestNav() {
  return getJson(NAV_URL)
}

/**
 * nav → 客户端账号模型。
 * 装扮相关字段全部落在这里：头像挂件、昵称颜色、大会员图标与头像角标。
 */
function mapUser(data) {
  const vip = data.vip ?? {}
  const label = vip.label ?? {}
  const pendant = data.pendant ?? {}
  const nameplate = data.nameplate ?? {}

  return {
    isLogin: true,
    mid: data.mid,
    name: data.uname,
    face: data.face,
    level: data.level_info?.current_level ?? 0,
    coin: Math.floor(data.money ?? 0),
    bcoin: data.wallet?.bcoin_balance ?? 0,

    // 装扮
    pendant: pendant.image || pendant.image_enhance
      ? { name: pendant.name ?? '', image: pendant.image_enhance || pendant.image, frame: pendant.image_enhance_frame ?? '' }
      : null,
    nameplate: nameplate.image ? { name: nameplate.name ?? '', image: nameplate.image, level: nameplate.level ?? '' } : null,
    nicknameColor: vip.nickname_color || '',
    avatarIcon: vip.avatar_icon?.icon_resource?.url ?? '',
    vip: Boolean(vip.status),
    vipLabel: label.text ?? '',
    // use_img_label 为真时用静态图片，否则用色块 + 文字渲染
    vipLabelImage: label.use_img_label ? (label.img_label_uri_hans_static || label.path || '') : '',
    vipBgColor: label.bg_color || '#FB7299',
    vipTextColor: label.text_color || '#FFFFFF',
    vipDueDate: vip.due_date ?? 0,
    official: data.official?.role ? { role: data.official.role, title: data.official.title ?? '' } : null,
  }
}

/** 关注 / 粉丝数：nav 不再返回，改用公开的关系接口 */
async function fetchRelation(mid) {
  if (!mid) return { following: 0, follower: 0 }
  try {
    const json = await getJson(`https://api.bilibili.com/x/relation/stat?vmid=${mid}`, { referer: `https://space.bilibili.com/${mid}` })
    return { following: json?.data?.following ?? 0, follower: json?.data?.follower ?? 0 }
  } catch {
    return { following: 0, follower: 0 }
  }
}

/** 空间装扮：acc/info 需要 WBI 签名，由调用方通过页面捕获提供，这里只做字段归一 */
function mapSpaceProfile(data) {
  if (!data) return null
  return {
    mid: data.mid,
    name: data.name,
    face: data.face,
    sign: data.sign ?? '',
    level: data.level ?? 0,
    pendant: data.pendant?.image ? { name: data.pendant.name ?? '', image: data.pendant.image_enhance || data.pendant.image } : null,
    nameplate: data.nameplate?.image ? { name: data.nameplate.name ?? '', image: data.nameplate.image } : null,
    vip: data.vip ?? null,
    official: data.official ?? null,
  }
}

/** 查询当前登录状态；未登录返回 { isLogin: false } */
async function getStatus() {
  try {
    const nav = await requestNav()
    if (nav?.data?.isLogin) {
      const user = mapUser(nav.data)
      Object.assign(user, await fetchRelation(user.mid))
      return user
    }
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
          const user = mapUser(nav.data)
          Object.assign(user, await fetchRelation(user.mid))
          finish(user)
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
  invalidateCookieCache()
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

module.exports = { getStatus, openLogin, logout, diagnose, mapSpaceProfile, biliSession, cookieHeader, csrfToken, invalidateCookieCache, UA, PARTITION, SPACE_API }

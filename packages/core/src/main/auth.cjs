const { BrowserWindow, session } = require('electron')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const NAV_URL = 'https://api.bilibili.com/x/web-interface/nav'
const LOGIN_URL = 'https://passport.bilibili.com/login'
const PARTITION = 'persist:bilihub'

function biliSession() {
  return session.fromPartition(PARTITION)
}

async function requestNav() {
  const response = await biliSession().fetch(NAV_URL, {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Origin: 'https://www.bilibili.com' },
  })
  return response.json()
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
    return { isLogin: false }
  } catch {
    return { isLogin: false }
  }
}

/**
 * 打开官方登录页，登录成功后 Cookie 会写入 persist:bilihub 会话。
 * 轮询 nav 接口判断登录完成，成功后自动关闭登录窗口。
 */
function openLogin(parent) {
  return new Promise((resolve) => {
    let settled = false
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

    const timer = setInterval(async () => {
      try {
        const nav = await requestNav()
        if (nav?.data?.isLogin) {
          finish(mapUser(nav.data))
          if (!win.isDestroyed()) win.close()
        }
      } catch {
        // 登录页跳转期间网络可能短暂失败，忽略后继续轮询
      }
    }, 1500)

    win.on('closed', () => finish({ isLogin: false }))
  })
}

/** 退出登录：清空该会话的 Cookie 与站点数据 */
async function logout() {
  await biliSession().clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'] })
  return true
}

module.exports = { getStatus, openLogin, logout, biliSession, UA }

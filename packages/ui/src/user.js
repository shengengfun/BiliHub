// 当前登录用户状态（跨页面共享）
import { ref } from 'vue'
import { api } from './api.js'

export const user = ref({ isLogin: false })
export const authSupported = api.hasAuth

/** 空间装扮只在进入「我的」页时补一次，避免每次轮询都开隐藏窗口 */
let spaceEnriched = false

/**
 * 空间页的 acc/info 里带着空间装扮与铭牌，比 nav 更全；
 * 拿不到就沿用 nav 的数据，不影响使用。
 */
async function enrichFromSpace() {
  if (spaceEnriched || !user.value.isLogin || !user.value.mid) return
  spaceEnriched = true
  const profile = await api.spaceProfile(user.value.mid)
  if (!profile || profile.error || !user.value.isLogin) return
  user.value = {
    ...user.value,
    pendant: profile.pendant ?? user.value.pendant,
    nameplate: profile.nameplate ?? user.value.nameplate,
    sign: profile.sign ?? '',
    dynamicCount: profile.dynamicCount ?? user.value.dynamicCount,
  }
}

export async function refreshUser() {
  const result = await api.auth.status()
  if (result?.isLogin && !user.value.isLogin) spaceEnriched = false
  user.value = result ?? { isLogin: false }
  if (user.value.isLogin) void enrichFromSpace()
  return user.value
}

export async function login() {
  if (!api.hasAuth) return { isLogin: false, unsupported: true }
  const result = await api.auth.login()
  user.value = result ?? { isLogin: false }
  return user.value
}

export async function logout() {
  await api.auth.logout()
  user.value = { isLogin: false }
}

let started = false

/**
 * 让界面自动跟随登录状态：
 * 1) 订阅主进程推送的登录成功事件
 * 2) 定时轮询兜底（例如在 B 站页面窗口完成登录时）
 * 3) 窗口重新获得焦点时立即刷新
 */
export function startUserSync(intervalMs = 4000) {
  if (!api.hasAuth || started) return
  started = true
  api.auth.onChange((payload) => { if (payload) user.value = payload })
  window.setInterval(() => { refreshUser() }, intervalMs)
  window.addEventListener('focus', () => { refreshUser() })
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshUser() })
}

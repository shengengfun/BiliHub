// 当前登录用户状态（跨页面共享）
import { ref } from 'vue'
import { api } from './api.js'

export const user = ref({ isLogin: false })
export const authSupported = api.hasAuth

export async function refreshUser() {
  const result = await api.auth.status()
  user.value = result ?? { isLogin: false }
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

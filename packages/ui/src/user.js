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

// 验证登录态接口在当前网络下的行为
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com/',
  Origin: 'https://www.bilibili.com',
}

const res = await fetch('https://api.bilibili.com/x/web-interface/nav', { headers: HEADERS })
const json = await res.json()
console.log('HTTP', res.status, 'code', json.code)
console.log('isLogin:', json.data?.isLogin)
console.log('uname:', json.data?.uname, '| mid:', json.data?.mid)
console.log('set-cookie 数量:', (res.headers.getSetCookie?.() ?? []).length)

// 登录页可达性（Electron 会在此加载官方登录页）
const login = await fetch('https://passport.bilibili.com/login', { headers: HEADERS, redirect: 'follow' })
console.log('登录页 HTTP', login.status, login.url)

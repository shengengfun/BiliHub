// 在真实 Electron 会话中验证：ses.fetch 走会话 Cookie、nav 可读、Cookie 存储可写
const { app, session } = require('electron')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const PARTITION = 'persist:bilihub'

app.whenReady().then(async () => {
  const ses = session.fromPartition(PARTITION)

  const res = await ses.fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Origin: 'https://www.bilibili.com' },
  })
  const json = await res.json()
  console.log('[test] nav HTTP', res.status, 'code', json.code, 'isLogin', json.data?.isLogin)

  // 写入一个测试 Cookie，验证持久化存储可读写
  await ses.cookies.set({ url: 'https://www.bilibili.com', name: 'bilihub_probe', value: 'ok', expirationDate: Math.floor(Date.now() / 1000) + 60 })
  const stored = await ses.cookies.get({ name: 'bilihub_probe' })
  console.log('[test] 会话 Cookie 读写:', stored.length === 1 ? '正常' : '失败')

  // 清理测试 Cookie 与本地存储，避免污染真实登录态
  await ses.cookies.remove('https://www.bilibili.com', 'bilihub_probe')

  // 视频 CDN 请求头注入是否生效（用封面地址验证 Referer）
  const cover = await ses.fetch('https://i0.hdslb.com/bfs/archive/5242750857121e05146d5d5b13a47a2a6dd36e60.jpg', {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
  })
  console.log('[test] 封面请求 HTTP', cover.status, cover.headers.get('content-type'))

  app.quit()
})

// 验证登录窗口会向会话写入 Cookie，且 requestNav 能带上这些 Cookie
const { app, BrowserWindow } = require('electron')
const auth = require('../packages/core/src/main/auth.cjs')

app.whenReady().then(async () => {
  console.log('[test] 初始诊断:', JSON.stringify(await auth.diagnose()))

  const pending = auth.openLogin()
  const win = BrowserWindow.getAllWindows()[0]

  // 等登录页加载并下发 Cookie
  setTimeout(async () => {
    const diag = await auth.diagnose()
    console.log('[test] 加载登录页后的 Cookie 数:', diag.cookieCount)
    console.log('[test] Cookie 名称:', diag.cookieNames.join(', ') || '(空)')
    console.log('[test] nav 结果:', JSON.stringify(diag.nav), '错误:', diag.error)

    // 手动注入一个假 SESSDATA，验证“携带 Cookie 后 requestNav 会把它发出去”
    const ses = auth.biliSession()
    await ses.cookies.set({ url: 'https://www.bilibili.com', name: 'SESSDATA', value: 'probe-invalid-token', domain: '.bilibili.com', expirationDate: Math.floor(Date.now() / 1000) + 120 })
    const after = await auth.diagnose()
    console.log('[test] 注入假 SESSDATA 后 hasSESSDATA:', after.hasSESSDATA, '导航返回 code:', after.nav?.code)

    await ses.cookies.remove('https://www.bilibili.com', 'SESSDATA')
    win?.close()
  }, 12000)

  await pending
  console.log('[test] 流程结束')
  app.quit()
})

// 验证登录窗口能否打开官方登录页，并确认轮询与清理逻辑正常
const { app, BrowserWindow } = require('electron')
const auth = require('../packages/core/src/main/auth.cjs')

app.whenReady().then(async () => {
  const status = await auth.getStatus()
  console.log('[test] 初始状态:', JSON.stringify(status))

  const pending = auth.openLogin()

  setTimeout(() => {
    const wins = BrowserWindow.getAllWindows()
    console.log('[test] 打开的窗口数:', wins.length)
    for (const win of wins) {
      const url = win.webContents.getURL()
      console.log('[test] 窗口 URL:', url)
      const ok = url.includes('passport.bilibili.com')
      console.log('[test] 是否为官方登录页:', ok ? '是' : '否')
      win.close()
    }
  }, 8000)

  const result = await pending
  console.log('[test] 登录流程结果:', JSON.stringify(result))
  app.quit()
})

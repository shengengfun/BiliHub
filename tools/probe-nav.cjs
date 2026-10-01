// 打印 nav 接口里与「装扮」相关的字段，用于对齐头像挂件 / 昵称颜色 / 大会员标识
const { app, session } = require('electron')
const path = require('node:path')
const { setupSession } = require('../packages/core/src/main/session.cjs')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

app.whenReady().then(async () => {
  setupSession()
  const ses = session.fromPartition('persist:bilihub')
  const cookies = await ses.cookies.get({ domain: 'bilibili.com' })
  const cookie = cookies.filter((c) => c.value).map((c) => `${c.name}=${c.value}`).join('; ')

  const response = await ses.fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Cookie: cookie },
  })
  const json = await response.json()
  const data = json.data ?? {}

  console.log('code=', json.code, 'isLogin=', data.isLogin, 'uname=', data.uname)
  console.log('\n--- 装扮相关字段 ---')
  for (const key of ['pendant', 'nameplate', 'vip', 'official', 'level_info', 'face', 'mid', 'money', 'wallet', 'following', 'follower']) {
    console.log(`${key}: ${JSON.stringify(data[key])}`)
  }

  // 顺便看一眼空间装扮接口
  if (data.mid) {
    const theme = await ses.fetch(`https://api.bilibili.com/x/space/wbi/acc/info?mid=${data.mid}`, {
      headers: { 'User-Agent': UA, Referer: `https://space.bilibili.com/${data.mid}`, Cookie: cookie },
    })
    const themeJson = await theme.json()
    console.log('\nacc/info code=', themeJson.code, themeJson.message ?? '')
    if (themeJson.data) {
      for (const key of ['pendant', 'nameplate', 'vip', 'level', 'is_vip', 'theme']) {
        console.log(`  ${key}: ${JSON.stringify(themeJson.data[key])}`)
      }
    }
  }

  app.quit()
})

app.on('window-all-closed', () => app.quit())
void path

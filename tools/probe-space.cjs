// 验证空间资料捕获：acc/info 需要 WBI，走页面请求捕获
const { app, session } = require('electron')
const path = require('node:path')
const { setupSession } = require('../packages/core/src/main/session.cjs')
const { registerSchemes } = require('../packages/core/src/main/assets-protocol.cjs')
const capture = require('../packages/core/src/main/capture.cjs')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

registerSchemes()

app.whenReady().then(async () => {
  setupSession()
  const ses = session.fromPartition('persist:bilihub')

  const cookies = await ses.cookies.get({ domain: 'bilibili.com' })
  const cookie = cookies.filter((c) => c.value).map((c) => `${c.name}=${c.value}`).join('; ')
  const nav = await (await ses.fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Cookie: cookie },
  })).json()
  const mid = nav?.data?.mid
  console.log('mid=', mid, 'uname=', nav?.data?.uname)

  console.log('\n[关系接口]')
  const rel = await (await ses.fetch(`https://api.bilibili.com/x/relation/stat?vmid=${mid}`, {
    headers: { 'User-Agent': UA, Referer: `https://space.bilibili.com/${mid}`, Cookie: cookie },
  })).json()
  console.log(JSON.stringify(rel.data ?? rel))

  console.log('\n[空间资料捕获]')
  try {
    const record = await capture.captureViaPage({
      pageUrl: `https://space.bilibili.com/${mid}`,
      pattern: '/x/space/wbi/acc/info',
      timeoutMs: 20000,
    })
    const data = record?.json?.data
    if (!data) {
      console.log('未捕获到 acc/info，记录：', JSON.stringify(record?.json)?.slice(0, 300))
    } else {
      for (const key of Object.keys(data)) {
        const value = JSON.stringify(data[key])
        console.log(`  ${key}: ${value?.length > 200 ? `${value.slice(0, 200)}…` : value}`)
      }
    }
  } catch (error) {
    console.log('捕获失败：', String(error?.message ?? error))
  }

  app.quit()
})

app.on('window-all-closed', () => app.quit())
void path

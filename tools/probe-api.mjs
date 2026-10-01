// 实测 B 站公开接口在当前网络下的可用性
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com/',
  Origin: 'https://www.bilibili.com',
}

async function probe(name, url) {
  try {
    const res = await fetch(url, { headers: HEADERS })
    const text = await res.text()
    let code = 'n/a'
    let summary = ''
    try {
      const json = JSON.parse(text)
      code = json.code
      if (json.code === 0 && json.data) {
        const d = json.data
        if (Array.isArray(d.list)) summary = `list=${d.list.length} 例:${d.list[0]?.title ?? d.list[0]?.bvid ?? ''}`
        else if (Array.isArray(d)) summary = `array=${d.length}`
        else if (d.bvid) summary = `bvid=${d.bvid} title=${String(d.title).slice(0, 24)} cid=${d.cid ?? (d.pages?.[0]?.cid ?? '')}`
        else if (d.dash) summary = `dash video=${d.dash.video?.length} dur=${d.timelength ?? ''}`
        else if (d.durl) summary = `durl=${d.durl.length}`
        else summary = `keys=${Object.keys(d).slice(0, 6).join(',')}`
      } else {
        summary = String(json.message ?? text.slice(0, 80))
      }
    } catch { summary = text.slice(0, 60) }
    console.log(`${res.status} code=${code} ${name}\n    ${summary}`)
  } catch (error) {
    console.log(`ERR ${name}: ${error.message}`)
  }
}

const BVID = 'BV1GJ411x7h7'

await probe('popular 热门', 'https://api.bilibili.com/x/web-interface/popular?ps=12&pn=1')
await probe('ranking 排行榜', 'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all')
await probe('rcmd 推荐(需WBI)', 'https://api.bilibili.com/x/web-interface/index/top/feed/rcmd?ps=12')
await probe('view 视频信息', `https://api.bilibili.com/x/web-interface/view?bvid=${BVID}`)
await probe('playurl dash', `https://api.bilibili.com/x/player/playurl?bvid=${BVID}&cid=265928230&fnval=16&qn=80`)
await probe('danmaku XML', 'https://api.bilibili.com/x/v1/dm/list.so?oid=265928230')
await probe('player 页面', 'https://player.bilibili.com/player.html?bvid=BV1GJ411x7h7')

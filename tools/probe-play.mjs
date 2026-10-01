// 实测播放地址与弹幕链路（使用正确的 cid）
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com/',
  Origin: 'https://www.bilibili.com',
}

const BVID = process.argv[2] ?? 'BV1GJ411x7h7'

const viewRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${BVID}`, { headers: HEADERS })
const view = await viewRes.json()
const cid = view.data.cid
console.log(`view: ${view.data.title} cid=${cid} pages=${view.data.pages?.length}`)

for (const fnval of [16, 0]) {
  const url = `https://api.bilibili.com/x/player/playurl?bvid=${BVID}&cid=${cid}&fnval=${fnval}&qn=80&fourk=1`
  const res = await fetch(url, { headers: HEADERS })
  const json = await res.json()
  if (json.code !== 0) { console.log(`playurl fnval=${fnval} -> code=${json.code} ${json.message}`); continue }
  const d = json.data
  if (d.dash) {
    console.log(`playurl fnval=${fnval} -> DASH 视频流 ${d.dash.video.length} 条, 音频 ${d.dash.audio?.length ?? 0} 条`)
    for (const v of d.dash.video.slice(0, 4)) console.log(`   id=${v.id} ${v.width}x${v.height} codecs=${v.codecs} host=${new URL(v.baseUrl).host}`)
    if (d.dash.audio?.[0]) console.log(`   audio host=${new URL(d.dash.audio[0].baseUrl).host}`)
    console.log(`   支持画质: ${d.accept_quality?.join(',')}`)
  } else if (d.durl) {
    console.log(`playurl fnval=${fnval} -> durl ${d.durl.length} 条`)
    for (const item of d.durl.slice(0, 3)) console.log(`   ${item.url.slice(0, 90)} size=${item.size}`)
  }
}

// 弹幕
const dmRes = await fetch(`https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`, { headers: HEADERS })
const dmText = await dmRes.text()
const count = (dmText.match(/<d p=/g) ?? []).length
console.log(`danmaku: ${dmText.length} 字节, ${count} 条`)
const first = dmText.match(/<d p="([^"]+)">([^<]*)<\/d>/)
if (first) console.log(`   例: p=${first[1].slice(0, 40)} text=${first[2]}`)

// 封面可达性
const cover = view.data.pic
const coverRes = await fetch(cover, { headers: HEADERS })
console.log(`cover: ${coverRes.status} ${coverRes.headers.get('content-type')} ${cover.slice(0, 70)}`)

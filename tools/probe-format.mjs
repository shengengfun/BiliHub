// 检查 durl 直链格式与 DASH 分段信息
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com/',
}
const BVID = 'BV1GJ411x7h7'
const view = await (await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${BVID}`, { headers: HEADERS })).json()
const cid = view.data.cid

const durlJson = await (await fetch(`https://api.bilibili.com/x/player/playurl?bvid=${BVID}&cid=${cid}&fnval=0&qn=64`, { headers: HEADERS })).json()
const d = durlJson.data
console.log('quality:', d.quality, 'format:', d.format, 'accept:', d.accept_quality)
for (const item of d.durl ?? []) {
  console.log('durl:', item.url.split('?')[0])
  const head = await fetch(item.url, { headers: { ...HEADERS, Range: 'bytes=0-15' } })
  const buf = Buffer.from(await head.arrayBuffer())
  console.log('  status', head.status, 'type', head.headers.get('content-type'), 'magic', buf.toString('hex'), JSON.stringify(buf.toString('latin1').slice(0, 8)))
}

const dashJson = await (await fetch(`https://api.bilibili.com/x/player/playurl?bvid=${BVID}&cid=${cid}&fnval=16&qn=80`, { headers: HEADERS })).json()
const dash = dashJson.data.dash
const v = dash.video.find((x) => x.codecs.startsWith('avc')) || dash.video[0]
console.log('dash video id', v.id, v.width + 'x' + v.height, 'codecs', v.codecs)
console.log('  segmentBase:', JSON.stringify(v.segmentBase ?? null))
console.log('  backup hosts:', (v.backupUrl ?? []).map((u) => new URL(u).host).slice(0, 3))
const vHead = await fetch(v.baseUrl, { headers: { ...HEADERS, Range: 'bytes=0-15' } })
console.log('  range status', vHead.status, 'content-range', vHead.headers.get('content-range'))

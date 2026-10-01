// B 站数据访问层
// - Electron：走主进程 IPC，主进程补齐 Referer/UA 并按需注入到页面请求
// - 浏览器预览：走 dev server 的 /bili-proxy 转发
import { api } from './api.js'

const API_BASE = 'https://api.bilibili.com'

export function mediaUrl(url) {
  if (!url) return ''
  return api.mode === 'electron' ? url : `/bili-proxy?url=${encodeURIComponent(url)}`
}

async function get(path, params = {}) {
  const query = new URLSearchParams(params).toString()
  const full = `${API_BASE}${path}${query ? `?${query}` : ''}`
  if (api.mode === 'electron') {
    const result = await api.biliApi(full)
    if (!result) throw new Error('主进程接口不可用')
    if (result.status !== 200) throw new Error(`HTTP ${result.status}`)
    return result.data
  }
  const res = await fetch(mediaUrl(full))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function unwrap(json) {
  if (!json || json.code !== 0) throw new Error(json?.message ?? '接口返回异常')
  return json.data
}

/** 热门视频（公开接口，无需登录） */
export async function fetchPopular(pageSize = 20) {
  const data = unwrap(await get('/x/web-interface/popular', { ps: pageSize, pn: 1 }))
  return (data.list ?? []).map(normalizeVideo)
}

/** 排行榜（公开接口，无需登录），rid 为分区号 */
export async function fetchRanking(pageSize = 20, rid = 0) {
  const data = unwrap(await get('/x/web-interface/ranking/v2', { rid, type: 'all' }))
  return (data.list ?? []).slice(0, pageSize).map(normalizeVideo)
}

/** 视频详情，含 cid 与分 P */
export async function fetchVideo(bvid) {
  const data = unwrap(await get('/x/web-interface/view', { bvid }))
  return {
    bvid: data.bvid,
    aid: data.aid,
    cid: data.cid,
    title: data.title,
    desc: data.desc,
    cover: data.pic,
    duration: data.duration,
    pubdate: data.pubdate,
    owner: { name: data.owner?.name, face: data.owner?.face, mid: data.owner?.mid },
    stat: { view: data.stat?.view ?? 0, danmaku: data.stat?.danmaku ?? 0, like: data.stat?.like ?? 0, coin: data.stat?.coin ?? 0, favorite: data.stat?.favorite ?? 0, share: data.stat?.share ?? 0, reply: data.stat?.reply ?? 0 },
    pages: (data.pages ?? []).map((page) => ({ cid: page.cid, page: page.page, part: page.part, duration: page.duration })),
  }
}

/** 播放地址：优先 DASH，回退 durl 直链 */
export async function fetchPlayUrl(bvid, cid, fnval = 16) {
  const data = unwrap(await get('/x/player/playurl', { bvid, cid, fnval, qn: 80, fourk: 1 }))
  if (data.dash) {
    return {
      kind: 'dash',
      duration: data.dash.duration,
      videos: (data.dash.video ?? []).map((item) => ({ id: item.id, width: item.width, height: item.height, codecs: item.codecs, url: item.baseUrl })),
      audios: (data.dash.audio ?? []).map((item) => ({ id: item.id, url: item.baseUrl })),
    }
  }
  return { kind: 'durl', urls: (data.durl ?? []).map((item) => item.url) }
}

/** 弹幕（XML 文本格式，公开接口） */
export async function fetchDanmakuXml(cid) {
  const full = `${API_BASE}/x/v1/dm/list.so?oid=${cid}`
  const text = api.mode === 'electron' ? await api.biliText(full) : await (await fetch(mediaUrl(full))).text()
  return parseDanmakuXml(text)
}

export function parseDanmakuXml(text) {
  const items = []
  const pattern = /<d p="([^"]+)">([^<]*)<\/d>/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    const [time, mode, fontSize, color, timestamp, pool, sender, rowId] = match[1].split(',')
    items.push({
      time: Number(time),
      mode: Number(mode),
      fontSize: Number(fontSize),
      color: Number(color),
      timestamp: Number(timestamp),
      senderHash: sender,
      id: rowId,
      content: match[2],
    })
  }
  return items.sort((a, b) => a.time - b.time)
}

function normalizeVideo(item) {
  const stat = item.stat ?? {}
  return {
    bvid: item.bvid,
    title: item.title,
    cover: item.pic,
    duration: item.duration,
    owner: item.owner?.name ?? '',
    ownerFace: item.owner?.face ?? '',
    view: stat.view ?? item.play ?? 0,
    danmaku: stat.danmaku ?? item.video_review ?? 0,
    like: stat.like ?? item.like ?? 0,
    pubdate: item.pubdate ?? 0,
  }
}

export function formatCount(value) {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return String(value ?? 0)
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds ?? 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function formatDate(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

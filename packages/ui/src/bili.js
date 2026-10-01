// B 站数据访问层
// - Electron：走主进程 IPC（主进程补齐 Referer/UA/Cookie）
// - 浏览器预览：走 dev server 的 /bili-proxy 转发
// - 需要 WBI 签名的接口（评论、动态、弹幕 protobuf）：先查捕获缓存，miss 时用隐藏窗口
//   加载真实页面并捕获其自身请求，不自行实现签名算法（见 guide.md）。
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

/**
 * 通过捕获真实页面请求拿到 WBI 接口数据。
 * 先查缓存，没有再开隐藏窗口加载页面等待命中。
 * @param {{pageUrl:string, pattern:string, timeoutMs?:number}} options
 */
export async function captureJson({ pageUrl, pattern, timeoutMs = 20000 }) {
  const hit = await api.capture.cached(pattern)
  if (hit?.json) return hit.json

  if (api.mode !== 'electron') throw new Error('浏览器预览无法捕获页面请求，请在桌面客户端中使用')
  const record = await api.capture.viaPage({ pageUrl, pattern, timeoutMs })
  if (!record?.json) throw new Error('未能捕获到页面响应')
  return record.json
}

const QUALITY_LABEL = {
  127: '8K 超高清',
  126: '杜比视界',
  125: 'HDR 真彩',
  120: '4K 超清',
  116: '1080P60 高帧率',
  112: '1080P+ 高码率',
  80: '1080P 高清',
  74: '720P60 高帧率',
  64: '720P 高清',
  32: '480P 清晰',
  16: '360P 流畅',
  6: '240P 极速',
}

/** 清晰度数字 → 中文标签 */
export function qualityLabel(quality, fallback = '') {
  return QUALITY_LABEL[quality] ?? fallback ?? `${quality}P`
}

export function normalizeVideo(item) {
  const stat = item.stat ?? {}
  return {
    bvid: item.bvid,
    title: item.title,
    cover: item.pic ?? item.cover ?? '',
    duration: item.duration,
    owner: item.owner?.name ?? item.name ?? '',
    ownerFace: item.owner?.face ?? '',
    ownerMid: item.owner?.mid ?? 0,
    view: stat.view ?? item.play ?? 0,
    danmaku: stat.danmaku ?? item.video_review ?? 0,
    like: stat.like ?? item.like ?? 0,
    pubdate: item.pubdate ?? 0,
  }
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
    stat: {
      view: data.stat?.view ?? 0,
      danmaku: data.stat?.danmaku ?? 0,
      like: data.stat?.like ?? 0,
      coin: data.stat?.coin ?? 0,
      favorite: data.stat?.favorite ?? 0,
      share: data.stat?.share ?? 0,
      reply: data.stat?.reply ?? 0,
    },
    pages: (data.pages ?? []).map((page) => ({ cid: page.cid, page: page.page, part: page.part, duration: page.duration })),
  }
}

/** 相关推荐（需登录/WBI，走捕获） */
export async function fetchRelated(bvid) {
  try {
    const json = await captureJson({
      pageUrl: `https://www.bilibili.com/video/${bvid}`,
      pattern: '/x/web-interface/archive/related',
      timeoutMs: 15000,
    })
    return (json?.data ?? []).map(normalizeVideo)
  } catch {
    return []
  }
}

/**
 * 播放地址。
 * fnval=0 时返回 durl（MP4 直链，可被 <video> 直接播放），并带清晰度列表。
 */
export async function fetchPlayUrl(bvid, cid, { qn = 80, fnval = 0 } = {}) {
  const data = unwrap(await get('/x/player/playurl', { bvid, cid, fnval, qn, fourk: 1 }))
  const formats = (data.support_formats ?? []).map((item) => ({
    quality: item.quality,
    label: item.new_description || item.display_desc || qualityLabel(item.quality),
    codecs: item.codecs ?? '',
  }))

  if (fnval !== 0 && data.dash) {
    return {
      kind: 'dash',
      duration: data.dash.duration,
      quality: data.quality,
      formats,
      videos: (data.dash.video ?? []).map((item) => ({ id: item.id, width: item.width, height: item.height, codecs: item.codecs, url: item.baseUrl })),
      audios: (data.dash.audio ?? []).map((item) => ({ id: item.id, url: item.baseUrl })),
    }
  }

  return {
    kind: 'durl',
    duration: data.timelength ? data.timelength / 1000 : 0,
    quality: data.quality,
    formats,
    acceptQuality: data.accept_quality ?? [],
    urls: (data.durl ?? []).map((item) => item.url).filter(Boolean),
  }
}

/** 弹幕（XML 文本格式，公开接口，无需签名） */
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

// ---------------------------------------------------------------------------
// 弹幕发送人查询
// 弹幕的发送者只以 CRC32(uid) 的十进制哈希形式随弹幕下发，官方没有反查接口。
// 这里用两级策略：① 本地已采集的 UID→哈希索引；② 对观众列表做定向尝试。
// 都不命中时返回哈希本身，界面据此提示「无法解析」。
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

/** 与 B 站一致的 midHash：CRC32(uid) 的十进制字符串 */
export function midHash(uid) {
  const text = String(uid)
  let crc = 0xffffffff
  for (let index = 0; index < text.length; index += 1) {
    crc = CRC_TABLE[(crc ^ text.charCodeAt(index)) & 0xff] ^ (crc >>> 8)
  }
  return String((crc ^ 0xffffffff) >>> 0)
}

const senderIndex = new Map()

/** 把已知用户写入本地索引，供后续反查 */
export function indexSenders(users = []) {
  for (const user of users) {
    if (user?.mid) senderIndex.set(midHash(user.mid), user)
  }
}

/**
 * 查询弹幕发送人。
 * @returns {{resolved:boolean, hash:string, user?:object, hint:string}}
 */
export async function lookupDanmakuSender({ cid, danmaku }) {
  const hash = danmaku?.senderHash ?? ''
  if (!hash) return { resolved: false, hash: '', hint: '该弹幕未携带发送者哈希' }

  if (senderIndex.has(hash)) return { resolved: true, hash, user: senderIndex.get(hash), hint: '' }

  // 用视频评论区里出现过的用户扩充索引后重试
  try {
    const users = await collectKnownUsers(cid)
    indexSenders(users)
  } catch {
    /* 采集失败不影响结果 */
  }
  if (senderIndex.has(hash)) return { resolved: true, hash, user: senderIndex.get(hash), hint: '' }

  return { resolved: false, hash, hint: '官方未提供哈希反查接口，仅能显示发送者哈希' }
}

/** 采集当前视频相关的用户（UP 主 + 评论区用户），用于建立本地索引 */
async function collectKnownUsers(cid) {
  const users = []
  if (!cid) return users
  try {
    const json = await captureJson({
      pageUrl: `https://www.bilibili.com/video/av${cid}`,
      pattern: '/x/v2/reply',
      timeoutMs: 12000,
    })
    const replies = json?.data?.replies ?? []
    for (const reply of replies) {
      if (reply.member?.mid) users.push({ mid: reply.member.mid, name: reply.member.uname, face: reply.member.avatar })
    }
  } catch {
    /* 忽略 */
  }
  return users
}

/** 发送弹幕（需要登录，主进程自动补 csrf） */
export async function sendDanmaku({ bvid, cid, text, mode = 1, color = 16777215, fontSize = 25, progress = 0, pool = 0 }) {
  const result = await api.biliPost({
    url: `${API_BASE}/x/v2/dm/post`,
    body: {
      type: 1,
      oid: cid,
      bvid,
      msg: text,
      mode,
      color,
      fontsize: fontSize,
      progress: Math.max(0, Math.floor(progress * 1000)),
      pool,
      plat: 1,
    },
  })
  const data = result?.data ?? {}
  if (data.code !== 0) throw new Error(data.message || data.msg || `发送失败（code ${data.code}）`)
  return data
}

/** 点赞视频 */
export async function likeVideo(bvid, like = 1) {
  const result = await api.biliPost({ url: `${API_BASE}/x/web-interface/archive/like`, body: { bvid, like } })
  const data = result?.data ?? {}
  if (data.code !== 0) throw new Error(data.message || '点赞失败')
  return data
}

/** 投币 */
export async function coinVideo(bvid, num = 1) {
  const result = await api.biliPost({ url: `${API_BASE}/x/web-interface/coin/add`, body: { bvid, multiply: num, select_like: 0 } })
  const data = result?.data ?? {}
  if (data.code !== 0) throw new Error(data.message || '投币失败')
  return data
}

/** 评论列表（WBI 接口，走页面捕获） */
export async function fetchComments({ bvid, cid, page = 1, sort = 1 }) {
  const json = await captureJson({
    pageUrl: `https://www.bilibili.com/video/${bvid}/#reply${cid ?? ''}`,
    pattern: '/x/v2/reply',
    timeoutMs: 20000,
  })
  const data = json?.data ?? {}
  const replies = data.replies ?? []
  const users = replies
    .filter((reply) => reply.member?.mid)
    .map((reply) => ({ mid: reply.member.mid, name: reply.member.uname, face: reply.member.avatar }))
  indexSenders(users)

  return {
    page: data.page?.num ?? page,
    total: data.page?.count ?? 0,
    items: replies.map((reply) => ({
      rpid: reply.rpid_str ?? String(reply.rpid),
      user: reply.member?.uname ?? '',
      face: reply.member?.avatar ?? '',
      mid: reply.member?.mid ?? 0,
      level: reply.member?.level_info?.current_level ?? 0,
      content: reply.content?.message ?? '',
      like: reply.like ?? 0,
      replyCount: reply.rcount ?? 0,
      ctime: reply.ctime ?? 0,
      location: reply.reply_control?.location ?? '',
      subReplies: (reply.replies ?? []).map((sub) => ({
        rpid: sub.rpid_str ?? String(sub.rpid),
        user: sub.member?.uname ?? '',
        face: sub.member?.avatar ?? '',
        content: sub.content?.message ?? '',
        like: sub.like ?? 0,
        ctime: sub.ctime ?? 0,
      })),
    })),
  }
}

/** 动态首页（WBI 接口，走 t.bilibili.com 页面捕获） */
export async function fetchDynamicFeed() {
  const json = await captureJson({
    pageUrl: 'https://t.bilibili.com/',
    pattern: '/x/polymer/web-dynamic/v1/feed/',
    timeoutMs: 25000,
  })
  const items = json?.data?.items ?? []
  return items.map(normalizeDynamic).filter(Boolean)
}

function normalizeDynamic(item) {
  if (!item?.id_str) return null
  const author = item.modules?.module_author ?? {}
  const dynamic = item.modules?.module_dynamic ?? {}
  const major = dynamic.major ?? {}
  const archive = major.archive ?? null
  const draw = major.draw ?? null
  const opus = major.opus ?? null

  let kind = 'text'
  let cover = ''
  let title = ''
  let description = ''

  if (archive) {
    kind = 'video'
    cover = archive.cover ?? ''
    title = archive.title ?? ''
    description = archive.desc ?? ''
  } else if (draw) {
    kind = 'image'
    cover = draw.items?.[0]?.src ?? ''
    title = draw.title ?? ''
    description = draw.summary ?? ''
  } else if (opus) {
    kind = 'opus'
    title = opus.title ?? ''
    cover = opus.pics?.[0]?.url ?? ''
    description = opus.summary?.text ?? ''
  }

  return {
    id: item.id_str,
    type: kind,
    author: { mid: author.mid ?? 0, name: author.name ?? '', face: author.face ?? '' },
    pubTime: author.pub_ts ?? 0,
    pubText: author.pub_time ?? '',
    text: (dynamic.desc?.text ?? item.modules?.module_dynamic?.desc?.text ?? '').trim(),
    title,
    description,
    cover,
    bvid: archive?.bvid ?? '',
    duration: archive?.duration_text ?? '',
    stat: {
      comment: item.modules?.module_stat?.comment?.count ?? 0,
      like: item.modules?.module_stat?.like?.count ?? 0,
      forward: item.modules?.module_stat?.forward?.count ?? 0,
    },
  }
}

export function formatCount(value) {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return String(value ?? 0)
}

/** 紧凑计数：原包点赞徽章用「6千点赞」这种单位 */
export function formatShort(value) {
  const num = Number(value) || 0
  const trim = (text) => text.replace(/\.0$/, '')
  if (num >= 100000000) return `${trim((num / 100000000).toFixed(1))}亿`
  if (num >= 10000) return `${trim((num / 10000).toFixed(1))}万`
  if (num >= 1000) return `${trim((num / 1000).toFixed(1))}千`
  return String(num)
}

/** 首页热搜词（公开接口，取不到时由调用方回退） */
export async function fetchHotWords() {
  const data = unwrap(await get('/x/web-interface/search/square', { limit: 10 }))
  return (data?.trending?.list ?? []).map((item) => item.keyword).filter(Boolean)
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

/** 相对时间（动态列表用） */
export function formatRelative(timestamp) {
  if (!timestamp) return ''
  const diff = Date.now() - timestamp
  if (diff < 0) return '刚刚'
  const minute = 60000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`
  if (diff < day) return `${Math.floor(diff / hour)}小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)}天前`
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

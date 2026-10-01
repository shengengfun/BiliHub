import type { RuntimeContext, RuntimeModule } from '@bilihub/runtime'
import { injectStyle } from './util.js'

/**
 * UP 主广告跳过（guide 5.3.2）
 *   阶段 1：SponsorBlock 社区标记（基于 bvid 的 SHA-256 前缀）
 *   阶段 2：弹幕时间点解析 + 关键词打分 + 滑动窗口聚类
 *   阶段 3：手动跳过按钮 / 自动跳过
 */

export interface Segment {
  start: number
  end: number
  source: 'sponsorblock' | 'danmaku'
  weight?: number
}

const TIME_PATTERNS: RegExp[] = [
  /(\d{1,2}):(\d{2}):(\d{2})/,
  /(\d{1,2}):(\d{2})/,
  /(\d{1,2})分(\d{1,2})秒?/,
  /(\d{1,2})分半/,
  /(\d{1,3})秒/,
  /(\d{3,4})s\b/i,
]

const KEYWORDS_HIGH = ['空降', '快进到', '跳转', '广告结束', '欢迎回来', '正片开始', '跳过']
const KEYWORDS_LOW = ['广告', '恰饭', '推广', '赞助']

const NOISE_PATTERNS: RegExp[] = [
  /打\d+分/,
  /身高\d+/,
  /\d+米/,
  /发布.{0,3}(分钟|小时|天)/,
  /^\d+$/,
]

/** 从弹幕文本解析时间点（秒）；噪声文本返回 null */
export function parseSponsorTime(content: string): number | null {
  if (!content) return null
  if (NOISE_PATTERNS.some((pattern) => pattern.test(content))) return null

  const half = /(\d{1,2})分半/.exec(content)
  if (half) return Number(half[1]) * 60 + 30

  for (const pattern of TIME_PATTERNS) {
    const match = pattern.exec(content)
    if (!match) continue
    if (match[3] !== undefined) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
    if (match[2] !== undefined) return Number(match[1]) * 60 + Number(match[2])
    return Number(match[1])
  }
  return null
}

/** 关键词权重：强提示 3 分，弱提示 1 分，其余 0.5 分 */
export function scoreDanmaku(content: string): number {
  if (KEYWORDS_HIGH.some((keyword) => content.includes(keyword))) return 3
  if (KEYWORDS_LOW.some((keyword) => content.includes(keyword))) return 1
  return 0.5
}

export interface TimePoint {
  time: number
  weight: number
}

/** 滑动窗口聚类：把邻近的时间点合并为区间 */
export function clusterTimes(points: TimePoint[], epsilon = 3, minWeight = 4): Segment[] {
  const sorted = [...points].sort((a, b) => a.time - b.time)
  const clusters: { center: number; points: TimePoint[]; weight: number }[] = []

  for (const point of sorted) {
    const last = clusters[clusters.length - 1]
    if (last && point.time - last.center <= epsilon) {
      last.points.push(point)
      last.center = last.points.reduce((sum, item) => sum + item.time, 0) / last.points.length
      last.weight += point.weight
    } else {
      clusters.push({ center: point.time, points: [point], weight: point.weight })
    }
  }

  return clusters
    .filter((cluster) => cluster.weight >= minWeight || cluster.points.length >= 3)
    .map((cluster) => ({ start: Math.max(0, cluster.center - 2), end: cluster.center + 2, source: 'danmaku' as const, weight: cluster.weight }))
}

/** 纯函数版本，便于单测与复用 */
export function detectSponsorPoints(contents: string[]): TimePoint[] {
  const result: TimePoint[] = []
  for (const content of contents) {
    const time = parseSponsorTime(content)
    if (time === null) continue
    result.push({ time, weight: scoreDanmaku(content) })
  }
  return result
}

async function sha256Prefix(input: string, hexLength = 8): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, hexLength)
}

async function fetchSponsorBlock(bvid: string, cid: number): Promise<Segment[]> {
  const categories = encodeURIComponent('["sponsor","selfpromo","interaction"]')
  for (const candidate of [bvid, `${bvid}${cid}`]) {
    try {
      const hash = await sha256Prefix(candidate)
      const response = await fetch(`https://sponsor.ajay.app/api/skipSegments/${hash}?categories=${categories}`)
      if (!response.ok) continue
      const data = (await response.json()) as { segment: [number, number] }[]
      if (!Array.isArray(data) || !data.length) continue
      return data.map((item) => ({ start: item.segment[0], end: item.segment[1], source: 'sponsorblock' as const }))
    } catch {
      /* 网络受限时继续尝试下一种 */
    }
  }
  return []
}

/** 先查社区数据，没有就分析弹幕 */
async function resolveSegments(context: RuntimeContext, bvid: string, cid: number): Promise<Segment[]> {
  const community = await fetchSponsorBlock(bvid, cid)
  if (community.length) return community
  if (!cid) return []

  try {
    const response = await context.adapter.http({ url: `https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}` })
    const xml = typeof response.data === 'string' ? response.data : ''
    const contents = [...xml.matchAll(/<d p="[^"]*">([^<]*)<\/d>/g)].map((match) => match[1])
    if (!contents.length) return []
    const minWeight = Number(context.getSetting<number>('minWeight') ?? 4)
    return clusterTimes(detectSponsorPoints(contents), 3, minWeight)
  } catch {
    return []
  }
}

const STYLE_ID = 'bilihub-sponsor-skip-style'
const BUTTON_ID = 'bilihub-sponsor-skip'

export const sponsorSkip: RuntimeModule = {
  id: 'sponsor-skip',
  name: '自动跳过 UP 主广告',
  category: 'utility',
  version: '1.0.0',
  description: '优先读取 SponsorBlock 社区标记，无数据时分析弹幕空降时间点，提供手动/自动跳过',

  settings: [
    {
      key: 'mode',
      type: 'select',
      default: 'manual',
      label: '跳过模式',
      options: [
        { label: '手动确认', value: 'manual' },
        { label: '自动跳过', value: 'auto' },
      ],
    },
    { key: 'minWeight', type: 'number', default: 4, min: 1, max: 20, label: '弹幕聚类权重阈值' },
    { key: 'showSource', type: 'boolean', default: true, label: '按钮上显示数据来源' },
  ],

  onLoad(context) {
    const cleanupStyle = injectStyle(STYLE_ID, `
      #${BUTTON_ID} {
        position: absolute; right: 24px; bottom: 96px; z-index: 90; display: none;
        padding: 9px 18px; border: 0; border-radius: 6px;
        background: rgba(255, 102, 153, .94); color: #fff;
        font: 14px/1 -apple-system, "Segoe UI", sans-serif; cursor: pointer;
        box-shadow: 0 6px 20px rgba(0, 0, 0, .28);
      }
      #${BUTTON_ID}:hover { background: #ff4f88; }
    `)

    const button = document.createElement('button')
    button.id = BUTTON_ID
    button.textContent = '跳过广告'

    let segments: Segment[] = []
    let loadedFor = ''
    let stopTimeUpdate: (() => void) | undefined

    const activeSegment = () => {
      const video = context.adapter.media.getVideoEl()
      if (!video) return null
      return segments.find((segment) => video.currentTime >= segment.start && video.currentTime < segment.end) ?? null
    }

    button.addEventListener('click', () => {
      const video = context.adapter.media.getVideoEl()
      const segment = activeSegment()
      if (!video || !segment) return
      video.currentTime = segment.end
      button.style.display = 'none'
      context.adapter.ui.toast('已跳过广告')
    })

    const unsubscribeVideo = context.adapter.media.onVideoChange(async (video) => {
      stopTimeUpdate?.()
      if (!video) return

      const container = (video.closest('.bpx-player-container, .bilibili-player-video-wrap, #bilibili-player') as HTMLElement | null) ?? document.body
      if (!button.isConnected) container.appendChild(button)

      const page = context.adapter.page()
      if (!page.bvid) return
      const key = `${page.bvid}:${page.cid}`
      if (loadedFor === key) return
      loadedFor = key

      const mode = context.getSetting<string>('mode') ?? 'manual'
      const showSource = context.getSetting<boolean>('showSource') !== false
      segments = await resolveSegments(context, page.bvid, page.cid)
      context.log.info(`可跳过区间 ${segments.length} 段`, segments)

      const onUpdate = () => {
        const segment = activeSegment()
        if (!segment) {
          button.style.display = 'none'
          return
        }
        if (mode === 'auto') {
          video.currentTime = segment.end
          context.adapter.ui.toast('已自动跳过广告')
          return
        }
        button.style.display = 'block'
        const tag = segment.source === 'sponsorblock' ? '社区' : '弹幕'
        button.textContent = showSource ? `跳过广告（${tag}）` : '跳过广告'
      }
      video.addEventListener('timeupdate', onUpdate)
      stopTimeUpdate = () => video.removeEventListener('timeupdate', onUpdate)
    })

    context.log.info('广告跳过已启用')

    // 卸载时统一回收
    ;(sponsorSkip as RuntimeModule & { __cleanup?: () => void }).__cleanup = () => {
      stopTimeUpdate?.()
      unsubscribeVideo()
      cleanupStyle()
      button.remove()
    }
  },

  onUnload() {
    const cleanup = (sponsorSkip as RuntimeModule & { __cleanup?: () => void }).__cleanup
    cleanup?.()
    document.getElementById(BUTTON_ID)?.remove()
    document.getElementById(STYLE_ID)?.remove()
  },
}

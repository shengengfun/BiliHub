const timePatterns = [
  /(\d{1,2}):(\d{2})(?::(\d{2}))?/g,
  /(\d{1,2})分(\d{1,2})?秒?/g,
  /(\d{1,3})秒/g,
  /(\d{3,4})s\b/gi,
]
const noisePatterns = [/打\d+分/, /身高\d+/, /\d+米/, /发布.{0,3}(分钟|小时|天)/]

export function parseDanmakuTime(content) {
  if (noisePatterns.some((pattern) => pattern.test(content))) return null
  for (const pattern of timePatterns) {
    pattern.lastIndex = 0
    const match = pattern.exec(content)
    if (!match) continue
    if (match[0].includes(':')) {
      const first = Number(match[1]); const second = Number(match[2]); const third = match[3] ? Number(match[3]) : 0
      return match[3] ? first * 3600 + second * 60 + third : first * 60 + second
    }
    return Number(match[1]) * (match[0].includes('分') ? 60 : 1) + (match[2] ? Number(match[2]) : 0)
  }
  return null
}

export function scoreDanmaku(content) {
  if (['空降', '快进到', '跳转', '广告结束', '正片开始'].some((keyword) => content.includes(keyword))) return 3
  if (['广告', '恰饭', '推广'].some((keyword) => content.includes(keyword))) return 1
  return 0.5
}

export function clusterTimes(points, epsilon = 3) {
  const clusters = []
  for (const point of [...points].sort((a, b) => a.time - b.time)) {
    const last = clusters[clusters.length - 1]
    if (last && point.time - last.center <= epsilon) {
      last.points.push(point)
      last.center = last.points.reduce((sum, item) => sum + item.time, 0) / last.points.length
      last.weight += point.weight
    } else clusters.push({ center: point.time, points: [point], weight: point.weight })
  }
  return clusters
}

export function findAdSegments(danmaku) {
  const points = danmaku.map((item) => ({ time: parseDanmakuTime(item.content), weight: scoreDanmaku(item.content) })).filter((item) => item.time !== null && item.weight >= 1)
  return clusterTimes(points).filter((cluster) => cluster.weight >= 2).map((cluster) => ({ start: Math.max(0, cluster.center - 3), end: cluster.center + 12, confidence: Math.min(1, cluster.weight / 8) }))
}
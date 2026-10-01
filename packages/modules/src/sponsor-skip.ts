import type { RuntimeModule } from '@bilihub/runtime'

const timePatterns = [/([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?/g, /([0-9]{1,3})秒/g, /([0-9]{3,4})s\b/gi]
const keywords = ['广告', '恰饭', '推广', '空降', '快进到', '广告结束']

export function parseSponsorTime(content: string): number | null {
  for (const pattern of timePatterns) {
    pattern.lastIndex = 0
    const match = pattern.exec(content)
    if (!match) continue
    if (match[0].includes(':')) return match[3] ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : Number(match[1]) * 60 + Number(match[2])
    return Number(match[1])
  }
  return null
}

export function detectSponsorPoints(contents: string[]) {
  return contents.map((content) => ({ content, time: parseSponsorTime(content) })).filter((item) => item.time !== null && keywords.some((keyword) => item.content.includes(keyword)))
}

export const sponsorSkip: RuntimeModule = {
  id: 'sponsor-skip', name: '自动跳过 UP 主广告', category: 'utility', version: '0.1.0', description: '识别弹幕中的推广时间点并提供手动跳过',
  settings: [{ key: 'mode', type: 'select', default: 'manual', label: '跳过模式', options: [{ label: '手动确认', value: 'manual' }, { label: '自动跳过', value: 'auto' }] }],
  onLoad() {}, onUnload() {},
}
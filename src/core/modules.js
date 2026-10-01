export const moduleRegistry = [
  { id: 'ad-block', title: '净化观看', category: 'utility', description: '去广告与自动跳过 UP 主广告', settings: [{ key: 'enabled', type: 'boolean', default: true }] },
  { id: 'download', title: '一键下载', category: 'download', description: '视频、封面、弹幕与元数据', settings: [{ key: 'quality', type: 'select', default: '1080p' }] },
  { id: 'danmaku', title: '弹幕实验室', category: 'danmaku', description: '优化弹幕样式并查询发送人', settings: [{ key: 'density', type: 'range', default: 0.7 }] },
  { id: 'shortcuts', title: '快捷键', category: 'utility', description: '用键盘掌控播放与工具面板', settings: [{ key: 'enabled', type: 'boolean', default: true }] },
  { id: 'live', title: '直播增强', category: 'live', description: '过滤礼物、清理侧栏与低延迟', settings: [{ key: 'lowLatency', type: 'boolean', default: true }] },
  { id: 'ambient', title: 'AmbientLight', category: 'ambient', description: '从视频画面生成沉浸式背景光', settings: [{ key: 'fps', type: 'number', default: 15 }] },
  { id: 'comments', title: '评论增强', category: 'ui', description: '折叠楼层、过滤关键词和高亮回复', settings: [{ key: 'collapseLong', type: 'boolean', default: true }] },
  { id: 'capture', title: '画面截图', category: 'video', description: '无损截取视频画面与弹幕', settings: [{ key: 'includeDanmaku', type: 'boolean', default: false }] },
]

export function createSettingsStore(storage = window.localStorage) {
  const prefix = 'bilihub.module.'
  return {
    get(moduleId, key, fallback) {
      const value = storage.getItem(`${prefix}${moduleId}.${key}`)
      if (value === null) return fallback
      try { return JSON.parse(value) } catch { return value }
    },
    set(moduleId, key, value) { storage.setItem(`${prefix}${moduleId}.${key}`, JSON.stringify(value)) },
  }
}

export class DownloadQueue {
  constructor() { this.items = [] }
  add({ title, kind = 'video', url = '' }) {
    const item = { id: crypto.randomUUID(), title, kind, url, progress: 0, status: 'queued' }
    this.items.push(item)
    return item
  }
  start(id, onUpdate = () => {}) {
    const item = this.items.find((entry) => entry.id === id)
    if (!item || item.status === 'done') return
    item.status = 'downloading'
    const timer = window.setInterval(() => {
      item.progress = Math.min(100, item.progress + 10)
      onUpdate(item)
      if (item.progress >= 100) { item.status = 'done'; window.clearInterval(timer); onUpdate(item) }
    }, 120)
    return () => { window.clearInterval(timer); item.status = 'paused' }
  }
}

export const platformCapabilities = {
  windows: navigator.userAgent.includes('Windows'),
  drm: navigator.requestMediaKeySystemAccess !== undefined,
  touch: navigator.maxTouchPoints > 0,
}
import type { RuntimeModule } from '@bilihub/runtime'

export interface DownloadRequest { url: string; filename: string; kind: 'video' | 'cover' | 'danmaku' | 'metadata' }

export const download: RuntimeModule = {
  id: 'download', name: '下载管理', category: 'video', version: '0.1.0', description: '下载视频、封面、弹幕与元数据',
  settings: [{ key: 'quality', type: 'select', default: '1080p', label: '默认画质', options: [{ label: '1080P', value: '1080p' }, { label: '720P', value: '720p' }] }],
  onLoad() {}, onUnload() {},
}

export function requestDownload(request: DownloadRequest) { window.dispatchEvent(new CustomEvent('bilihub:download:request', { detail: request })) }
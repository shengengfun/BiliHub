import type { RuntimeModule } from '@bilihub/runtime'

export function screenshotVideo(includeDanmaku = false): string | null {
  const video = document.querySelector('video')
  if (!video || !video.videoWidth) return null
  const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight
  const context = canvas.getContext('2d'); if (!context) return null
  context.drawImage(video, 0, 0)
  if (includeDanmaku) document.dispatchEvent(new Event('bilihub:screenshot:include-danmaku'))
  return canvas.toDataURL('image/png')
}

export const videoTools: RuntimeModule = {
  id: 'video-tools', name: '视频工具', category: 'video', version: '0.1.0', description: '截图、画中画和视频画面增强',
  settings: [{ key: 'includeDanmaku', type: 'boolean', default: false, label: '截图包含弹幕' }],
  onLoad(context) { window.addEventListener('bilihub:shortcut:screenshot', () => { const image = screenshotVideo(context.getSetting<boolean>('includeDanmaku')); if (image) window.dispatchEvent(new CustomEvent('bilihub:screenshot:ready', { detail: image })) }) },
  onUnload() {},
}
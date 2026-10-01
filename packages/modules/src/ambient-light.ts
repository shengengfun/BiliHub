import type { RuntimeModule } from '@bilihub/runtime'
import { onVideoFrame } from './util.js'

/**
 * 氛围光（guide 5.3.1 video-frame-sampler + P1 ambient-light）
 * 用 64px 的降采样画布抓帧，直接当作背景层放大并糊化：
 * 只做一次 drawImage，不回读像素，1080p 下开销远低于 15%。
 */
const CANVAS_ID = 'bilihub-ambient-light'

export const ambientLight: RuntimeModule = {
  id: 'ambient-light',
  name: '氛围光',
  category: 'appearance',
  version: '1.0.0',
  description: '把视频画面边缘颜色扩散成页面背景，营造沉浸式观感',

  settings: [
    { key: 'fps', type: 'number', default: 15, min: 1, max: 30, label: '采样帧率' },
    { key: 'blur', type: 'number', default: 80, min: 20, max: 200, label: '模糊半径（px）' },
    { key: 'opacity', type: 'range', default: 0.85, min: 0.1, max: 1, step: 0.05, label: '强度' },
    { key: 'saturate', type: 'range', default: 1.6, min: 1, max: 3, step: 0.1, label: '饱和度' },
    { key: 'fillPage', type: 'boolean', default: true, label: '铺满整个页面（关闭则只做播放器底衬）' },
  ],

  onLoad(context) {
    const canvas = document.createElement('canvas')
    canvas.id = CANVAS_ID
    canvas.width = 64
    canvas.height = 36

    const fps = Number(context.getSetting<number>('fps') ?? 15)
    const blur = Number(context.getSetting<number>('blur') ?? 80)
    const opacity = Number(context.getSetting<number>('opacity') ?? 0.85)
    const saturate = Number(context.getSetting<number>('saturate') ?? 1.6)
    const fillPage = context.getSetting<boolean>('fillPage') !== false

    canvas.style.cssText = [
      'position: fixed',
      'inset: -10%',
      'width: 120%',
      'height: 120%',
      `filter: blur(${blur}px) saturate(${saturate})`,
      `opacity: ${opacity}`,
      'z-index: -1',
      'pointer-events: none',
      'transform: translateZ(0)',
    ].join(';')

    if (fillPage) {
      document.documentElement.style.setProperty('background-color', '#000')
      document.body.style.setProperty('background-color', '#000')
    }
    document.body.appendChild(canvas)

    const ctx = canvas.getContext('2d', { alpha: false })
    let stopFrame: (() => void) | undefined
    let lastDraw = 0

    const unsubscribeVideo = context.adapter.media.onVideoChange((video) => {
      stopFrame?.()
      if (!video || !ctx) return
      context.log.info('开始采样视频画面')

      stopFrame = onVideoFrame(video, () => {
        // 暂停时不必重复绘制
        if (video.paused || video.ended || !video.videoWidth) return
        const now = performance.now()
        if (now - lastDraw < 1000 / fps) return
        lastDraw = now
        try {
          const height = Math.max(1, Math.round(canvas.width * (video.videoHeight / video.videoWidth)))
          if (canvas.height !== height) canvas.height = height
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        } catch {
          /* 跨域视频源会抛错，忽略这一帧 */
        }
      }, fps)
    })

    const onVisibility = () => {
      canvas.style.display = document.hidden ? 'none' : 'block'
    }
    document.addEventListener('visibilitychange', onVisibility)

    context.log.info('氛围光已启用')
    ;(ambientLight as RuntimeModule & { __cleanup?: () => void }).__cleanup = () => {
      stopFrame?.()
      unsubscribeVideo()
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.remove()
    }
  },

  onUnload() {
    ;(ambientLight as RuntimeModule & { __cleanup?: () => void }).__cleanup?.()
    document.getElementById(CANVAS_ID)?.remove()
  },
}

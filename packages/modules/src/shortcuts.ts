import type { RuntimeModule } from '@bilihub/runtime'

/**
 * 快捷键
 * B 站网页版自带的按键不能覆盖全部场景，这里补齐常用操作，并允许逐项开关。
 * 输入框内不拦截，避免影响发弹幕与搜索。
 */
export const shortcuts: RuntimeModule = {
  id: 'shortcuts',
  name: '快捷键',
  category: 'utility',
  version: '1.0.0',
  description: '播放/暂停、快进后退、音量、倍速、全屏、弹幕开关等键盘快捷操作',

  settings: [
    { key: 'seekStep', type: 'number', default: 5, min: 1, max: 30, label: '快进/后退步长（秒）' },
    { key: 'volumeStep', type: 'range', default: 0.05, min: 0.01, max: 0.2, step: 0.01, label: '音量步长' },
    { key: 'rateStep', type: 'range', default: 0.25, min: 0.05, max: 1, step: 0.05, label: '倍速步长' },
    { key: 'enableSeek', type: 'boolean', default: true, label: '方向键快进/后退' },
    { key: 'enableVolume', type: 'boolean', default: true, label: '上下键调节音量' },
    { key: 'enableRate', type: 'boolean', default: true, label: 'Shift+左右 调节倍速' },
    { key: 'enableScreenshot', type: 'boolean', default: false, label: '接管 Alt+S（由截图模块处理）' },
  ],

  onLoad(context) {
    const seekStep = Number(context.getSetting<number>('seekStep') ?? 5)
    const volumeStep = Number(context.getSetting<number>('volumeStep') ?? 0.05)
    const rateStep = Number(context.getSetting<number>('rateStep') ?? 0.25)
    const enableSeek = context.getSetting<boolean>('enableSeek') !== false
    const enableVolume = context.getSetting<boolean>('enableVolume') !== false
    const enableRate = context.getSetting<boolean>('enableRate') !== false

    const isTyping = (target: EventTarget | null) => {
      const element = target as HTMLElement | null
      if (!element) return false
      const tag = element.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || element.isContentEditable
    }

    const toast = (message: string) => context.adapter.ui.toast(message)

    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      const video = context.adapter.media.getVideoEl()
      if (!video) return

      const handled = (message?: string) => {
        event.preventDefault()
        event.stopPropagation()
        if (message) toast(message)
      }

      switch (event.key) {
        case ' ':
        case 'k':
          if (video.paused) void video.play()
          else video.pause()
          return handled()
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (event.shiftKey && enableRate) {
            const delta = event.key === 'ArrowRight' ? rateStep : -rateStep
            const next = Math.min(4, Math.max(0.25, Number((video.playbackRate + delta).toFixed(2))))
            video.playbackRate = next
            return handled(`倍速 ${next}x`)
          }
          if (!enableSeek) return
          const delta = event.key === 'ArrowRight' ? seekStep : -seekStep
          video.currentTime = Math.min(video.duration || Infinity, Math.max(0, video.currentTime + delta))
          return handled()
        }
        case 'ArrowUp':
        case 'ArrowDown': {
          if (!enableVolume) return
          const delta = event.key === 'ArrowUp' ? volumeStep : -volumeStep
          const next = Math.min(1, Math.max(0, Number((video.volume + delta).toFixed(2))))
          video.volume = next
          video.muted = next === 0
          return handled(`音量 ${Math.round(next * 100)}%`)
        }
        case 'm':
          video.muted = !video.muted
          return handled(video.muted ? '静音' : '取消静音')
        case 'f':
          if (!document.fullscreenElement) void document.documentElement.requestFullscreen()
          else void document.exitFullscreen()
          return handled()
        case 'd':
          window.dispatchEvent(new CustomEvent('bilihub:toggle-danmaku'))
          return handled()
        default:
          // 0-9 按比例跳转
          if (/^[0-9]$/.test(event.key) && video.duration) {
            video.currentTime = (Number(event.key) / 10) * video.duration
            return handled()
          }
      }
    }

    window.addEventListener('keydown', onKey, true)
    context.log.info('快捷键已启用')
    ;(shortcuts as RuntimeModule & { __cleanup?: () => void }).__cleanup = () => window.removeEventListener('keydown', onKey, true)
  },

  onUnload() {
    ;(shortcuts as RuntimeModule & { __cleanup?: () => void }).__cleanup?.()
  },
}

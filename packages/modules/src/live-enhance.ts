import type { RuntimeModule } from '@bilihub/runtime'
import { injectStyle } from './util.js'

/**
 * 直播优化
 * 关礼物特效、自动最高画质、阻止休眠、简化弹幕区。
 */
const STYLE_ID = 'bilihub-live-enhance'

export const liveEnhance: RuntimeModule = {
  id: 'live-enhance',
  name: '直播优化',
  category: 'enhance',
  version: '1.0.0',
  description: '关闭礼物特效与动画、自动选择最高画质、播放期间阻止系统休眠',

  settings: [
    { key: 'blockGift', type: 'boolean', default: true, label: '屏蔽礼物特效' },
    { key: 'blockAnimation', type: 'boolean', default: true, label: '屏蔽进场/横幅动画' },
    { key: 'autoQuality', type: 'boolean', default: true, label: '自动切到最高画质' },
    { key: 'keepAwake', type: 'boolean', default: true, label: '播放时阻止休眠' },
    { key: 'wideDanmaku', type: 'boolean', default: false, label: '加宽弹幕区' },
  ],

  onLoad(context) {
    const page = context.adapter.page()
    if (!page.isLive) {
      context.log.info('当前不是直播页，直播优化待命')
    }

    const css = [
      context.getSetting<boolean>('blockGift') !== false
        ? '.gift-item, .gift-banner, .gift-effect-container, .super-chat-card, .guard-buy-effect { display: none !important; }'
        : '',
      context.getSetting<boolean>('blockAnimation') !== false
        ? '.enter-effect, .enter-room-effect, .activity-banner, .live-animation-player, .gift-animation-player { display: none !important; }'
        : '',
      context.getSetting<boolean>('wideDanmaku')
        ? '.danmaku-area, .chat-history-list { width: 380px !important; }'
        : '',
    ].filter(Boolean).join('\n')

    const cleanup = css ? injectStyle(STYLE_ID, css) : () => {}

    let wakeLock: WakeLockSentinel | null = null

    const requestWakeLock = async (video: HTMLVideoElement | null) => {
      if (context.getSetting<boolean>('keepAwake') === false) return
      try {
        if (video && !video.paused && !wakeLock && 'wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
        } else if ((video?.paused ?? true) && wakeLock) {
          await wakeLock.release()
          wakeLock = null
        }
      } catch {
        /* 部分环境不支持 Wake Lock */
      }
    }

    /** 直播播放器把画质存在 localStorage 的 quality 字段里 */
    if (context.getSetting<boolean>('autoQuality') !== false && page.isLive) {
      try {
        const stored = window.localStorage.getItem('quality')
        if (stored !== '4' && stored !== '400') {
          window.localStorage.setItem('quality', '4')
          context.log.info('已把直播默认画质设为原画')
        }
      } catch {
        /* 隐私模式下不可写 */
      }
    }

    let stopVideo: (() => void) | undefined
    const unsubscribe = context.adapter.media.onVideoChange((video) => {
      stopVideo?.()
      void requestWakeLock(video)
      if (!video) return
      const onChange = () => void requestWakeLock(video)
      video.addEventListener('play', onChange)
      video.addEventListener('pause', onChange)
      stopVideo = () => {
        video.removeEventListener('play', onChange)
        video.removeEventListener('pause', onChange)
      }
    })

    context.log.info('直播优化已启用')
    ;(liveEnhance as RuntimeModule & { __cleanup?: () => void }).__cleanup = () => {
      stopVideo?.()
      unsubscribe()
      void wakeLock?.release().catch(() => {})
      cleanup()
    }
  },

  onUnload() {
    ;(liveEnhance as RuntimeModule & { __cleanup?: () => void }).__cleanup?.()
    document.getElementById(STYLE_ID)?.remove()
  },
}

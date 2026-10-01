import type { RuntimeModule } from '@bilihub/runtime'
import { injectStyle } from './util.js'

/**
 * 夜间模式
 * 用一层深色调覆盖页面主色，而不是简单反色（反色会让封面图变得很怪）。
 * 支持按时间自动切换。
 */
const STYLE_ID = 'bilihub-dark-mode'

const DARK_CSS = `
  html { background: #16171a !important; }
  body, #app, .bili-feed4, .bili-header, .bili-header__bar, .international-header,
  .bili-header__channel, .mini-header, .nav-menu, .bili-dyn-list, .bili-dyn-home,
  .space-container, .main-container, .video-container-v1, .reply-warp, .comment-container,
  .bili-video-card, .feed-card, .bili-dyn-item, .bili-dyn-card, .opus-module-content,
  .bili-comment, .search-page, .channel-container {
    background-color: #1b1c1f !important;
    color: #e3e5e7 !important;
  }
  .bili-header__bar, .bili-header__channel, .international-header, .nav-menu {
    border-color: #2b2d31 !important;
  }
  a, .bili-video-card__info--tit, .title, .bili-dyn-title__text, .bili-comment-user-info__uname {
    color: #e3e5e7 !important;
  }
  .bili-video-card__info--author, .bili-video-card__stats, .desc, .bili-dyn-time, .bili-comment-content {
    color: #9499a0 !important;
  }
  .bili-video-card:hover, .bili-dyn-item:hover, .bili-comment:hover { background-color: #232428 !important; }
  input, textarea, select { background-color: #232428 !important; color: #e3e5e7 !important; border-color: #34363b !important; }
  .bili-header__search input, .nav-search-content input { background-color: #232428 !important; }
  .bili-dyn-list__item, .bili-video-card__wrap, .reply-item, .sub-reply-item { border-color: #2b2d31 !important; }
  #bilihub-toolbar { background: rgba(28, 29, 33, .94) !important; }
`

export const darkMode: RuntimeModule = {
  id: 'dark-mode',
  name: '夜间模式',
  category: 'appearance',
  version: '1.0.0',
  description: '为页面套用深色配色，可手动开关或按时间自动切换',

  settings: [
    { key: 'auto', type: 'boolean', default: false, label: '按时间自动切换' },
    { key: 'startHour', type: 'number', default: 19, min: 0, max: 23, label: '进入夜间的小时' },
    { key: 'endHour', type: 'number', default: 7, min: 0, max: 23, label: '退出夜间的小时' },
    { key: 'dimImages', type: 'boolean', default: false, label: '同时压暗图片亮度' },
  ],

  onLoad(context) {
    let cleanupStyle: (() => void) | undefined
    let timer: number | undefined

    const auto = context.getSetting<boolean>('auto') === true
    const startHour = Number(context.getSetting<number>('startHour') ?? 19)
    const endHour = Number(context.getSetting<number>('endHour') ?? 7)
    const dimImages = context.getSetting<boolean>('dimImages') === true

    const inNightRange = (hour: number) => (startHour <= endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour)

    const apply = (dark: boolean) => {
      cleanupStyle?.()
      cleanupStyle = undefined
      if (dark) {
        cleanupStyle = injectStyle(STYLE_ID, dimImages ? `${DARK_CSS}\nimg, video { filter: brightness(.86); }` : DARK_CSS)
      }
      document.documentElement.dataset.bilihubDark = dark ? '1' : '0'
    }

    const tick = () => apply(inNightRange(new Date().getHours()))

    if (auto) {
      tick()
      timer = window.setInterval(tick, 60_000)
      context.log.info('夜间模式按时间自动切换已启用')
    } else {
      // 手动模式：跟随系统的 prefers-color-scheme
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      apply(media.matches)
      media.addEventListener('change', (event) => apply(event.matches))
      context.log.info(`夜间模式跟随系统：${media.matches ? '深色' : '浅色'}`)
    }

    ;(darkMode as RuntimeModule & { __cleanup?: () => void }).__cleanup = () => {
      window.clearInterval(timer)
      cleanupStyle?.()
      delete document.documentElement.dataset.bilihubDark
    }
  },

  onUnload() {
    ;(darkMode as RuntimeModule & { __cleanup?: () => void }).__cleanup?.()
    document.getElementById(STYLE_ID)?.remove()
  },
}

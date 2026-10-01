import type { RuntimeModule } from '@bilihub/runtime'
import { injectStyle } from './util.js'

/**
 * 自定义顶栏
 * 原包的顶栏是单行白底：头像 + 搜索 + 五个标签 + 右侧图标。
 * 这里把网页版顶栏压成同一形态，并支持吸顶、透明、隐藏分区条。
 */
const STYLE_ID = 'bilihub-custom-navbar'

const BASE_CSS = `
  .bili-header__bar, .international-header, .nav-menu {
    position: sticky !important;
    top: 0 !important;
    z-index: 100 !important;
    height: 56px !important;
    min-height: 56px !important;
    background: #ffffff !important;
    box-shadow: none !important;
    border-bottom: 1px solid #e4e5e7 !important;
  }
  .bili-header__banner, .bili-header .bili-header__banner { display: none !important; }
  .bili-header__bar .left-entry { display: flex !important; align-items: center !important; }
  .bili-header__bar .left-entry .local-entry { display: none !important; }
  .bili-header__bar .center-search-container { flex: 1 1 auto !important; max-width: 500px !important; }
  .bili-header__bar .right-entry { align-items: center !important; }
  .bili-header__bar .right-entry .right-entry__outside { padding: 0 6px !important; }
  .bili-header__bar .nav-search-input { border-radius: 18px !important; }
  .bili-header__channel, .bili-header .bili-header__channel { height: 40px !important; }
`

const COMPACT_CSS = `
  .bili-header__bar {
    height: 48px !important;
    min-height: 48px !important;
  }
  .bili-header__bar .right-entry__outside > span:last-child { display: none !important; }
`

const TRANSPARENT_CSS = `
  .bili-header__bar, .international-header, .nav-menu {
    background: rgba(255, 255, 255, .82) !important;
    backdrop-filter: blur(14px) !important;
    border-bottom-color: rgba(228, 229, 231, .6) !important;
  }
`

const HIDE_CHANNEL_CSS = `
  .bili-header__channel, .bili-header .bili-header__channel { display: none !important; }
`

export const customNavbar: RuntimeModule = {
  id: 'custom-navbar',
  name: '自定义顶栏',
  category: 'appearance',
  version: '1.0.0',
  description: '把网页版顶栏压成原包的单行形态，支持吸顶、毛玻璃与紧凑模式',

  settings: [
    { key: 'sticky', type: 'boolean', default: true, label: '顶栏吸顶' },
    { key: 'compact', type: 'boolean', default: false, label: '紧凑模式（48px）' },
    { key: 'transparent', type: 'boolean', default: false, label: '毛玻璃半透明' },
    { key: 'hideChannel', type: 'boolean', default: false, label: '隐藏分区条' },
    { key: 'hideBanner', type: 'boolean', default: true, label: '隐藏首页大横幅' },
  ],

  onLoad(context) {
    const parts = [BASE_CSS]
    if (context.getSetting<boolean>('compact')) parts.push(COMPACT_CSS)
    if (context.getSetting<boolean>('transparent')) parts.push(TRANSPARENT_CSS)
    if (context.getSetting<boolean>('hideChannel')) parts.push(HIDE_CHANNEL_CSS)
    if (context.getSetting<boolean>('hideBanner') === false) {
      parts[0] = parts[0].replace('.bili-header__banner, .bili-header .bili-header__banner { display: none !important; }', '')
    }

    const cleanup = injectStyle(STYLE_ID, parts.join('\n'))
    if (!context.getSetting<boolean>('sticky')) {
      injectStyle(`${STYLE_ID}-nosticky`, '.bili-header__bar, .international-header, .nav-menu { position: relative !important; }')
    }

    context.log.info('自定义顶栏已启用')
    ;(customNavbar as RuntimeModule & { __cleanup?: () => void }).__cleanup = cleanup
  },

  onUnload() {
    ;(customNavbar as RuntimeModule & { __cleanup?: () => void }).__cleanup?.()
    document.getElementById(STYLE_ID)?.remove()
    document.getElementById(`${STYLE_ID}-nosticky`)?.remove()
  },
}

import type { RuntimeModule } from '@bilihub/runtime'
import { injectStyle, removeSelector } from './util.js'

/**
 * 去广告（guide P4-2）
 * 两条线：CSS 隐藏规则 + DOM 节点清理（B 站推荐流是虚拟列表，广告卡片会被反复插入）。
 */
const STYLE_ID = 'bilihub-ad-block'

const CATEGORY_RULES: Record<string, string[]> = {
  /** 首页 / 分区推荐流里的广告卡片 */
  feed: [
    '.bili-video-card:has(.bili-video-card__info--ad)',
    '.feed-card:has(.bili-video-card__info--ad)',
    '.video-page-special-card-small',
    '.bili-video-card.is-rcmd-ad',
    '.ad-report',
    '.video-card-ad',
    '.video-card-ad-small',
    '[class*="ad-report"]',
  ],
  /** 顶部横幅、活动楼层 */
  banner: [
    '#slide_ad',
    '.slide-ad-exp',
    '.ad-floor-exp',
    '.ad-floor-cover',
    '.activity-m-v1',
    '.floor-single-card',
    '.bili-header__banner .banner-card',
  ],
  /** 直播页的推荐位与礼物特效 */
  live: [
    '.live-recommend',
    '.gift-effect-container',
    '.bili-live-card.is-activity',
    '.live-room-ad',
  ],
  /** 动态页广告 */
  dynamic: [
    '.bili-dyn-list__item:has(.bili-dyn-card-ad)',
    '.dyn-card-opus__ad',
    '.bili-dyn-card-ad',
  ],
  /** 播放页的广告弹窗、暂停广告 */
  player: [
    '.bpx-player-adv-danmaku',
    '.bilibili-player-video-popup',
    '.bilibili-player-video-btn-widescreen-ad',
    '.player-archive-card-ad',
    '.bpx-player-ending-related-item-ad',
    '.bilibili-player-promote-wrap',
  ],
  /** 会员购入口 */
  mall: [
    '.bili-header__channel .channel-entry-mall',
    '.bili-header__channel .channel-entry-vip',
    '.mini-mall-entry',
  ],
}

const DEFAULT_ENABLED = ['feed', 'banner', 'live', 'dynamic', 'player']

export const adBlock: RuntimeModule = {
  id: 'ad-block',
  name: '广告拦截',
  category: 'enhance',
  version: '1.0.0',
  description: '按分类隐藏推荐流、横幅、直播、动态与播放器内的广告位，并持续清理动态插入的节点',

  settings: [
    { key: 'feed', type: 'boolean', default: true, label: '推荐流广告' },
    { key: 'banner', type: 'boolean', default: true, label: '顶部横幅与活动楼层' },
    { key: 'live', type: 'boolean', default: true, label: '直播推荐与礼物特效' },
    { key: 'dynamic', type: 'boolean', default: true, label: '动态页广告' },
    { key: 'player', type: 'boolean', default: true, label: '播放器广告弹窗' },
    { key: 'mall', type: 'boolean', default: false, label: '会员购 / 大会员入口' },
    { key: 'hideUpAd', type: 'boolean', default: false, label: '隐藏 UP 主自己插入的恰饭卡片' },
  ],

  onLoad(context) {
    const cleanups: (() => void)[] = []
    const rules: string[] = []

    for (const category of Object.keys(CATEGORY_RULES)) {
      const enabled = category === 'mall' ? context.getSetting<boolean>('mall') === true : DEFAULT_ENABLED.includes(category)
      if (!enabled) continue
      rules.push(...CATEGORY_RULES[category])
    }

    if (context.getSetting<boolean>('hideUpAd')) {
      rules.push('.video-card-ad', '[class*="commercial"]')
    }

    if (!rules.length) {
      context.log.info('所有广告分类均已关闭，跳过注入')
      return
    }

    const css = `${rules.join(',\n')} { display: none !important; }\n`
      // 广告卡片被移除后可能出现空白占位，顺手压掉
      + '.bili-video-card__info--ad, .bili-video-card__stats--ad { display: none !important; }'

    cleanups.push(injectStyle(STYLE_ID, css))
    cleanups.push(removeSelector('.ad-report, .video-card-ad, #slide_ad'))
    context.log.info(`已注入 ${rules.length} 条隐藏规则`)

    ;(adBlock as RuntimeModule & { __cleanup?: () => void }).__cleanup = () => cleanups.forEach((fn) => fn())
  },

  onUnload() {
    ;(adBlock as RuntimeModule & { __cleanup?: () => void }).__cleanup?.()
  },
}

import type { RuntimeModule } from '@bilihub/runtime'

const selectors = ['.ad-report', '.slide-ad-exp', '.video-card-ad-small', '.bili-video-card:has(.bili-video-card__info--ad)', '[class*="ad-report"]']
const STYLE_ID = 'bilihub-ad-block'

export const adBlock: RuntimeModule = {
  id: 'ad-block', name: '广告拦截', category: 'utility', version: '0.1.0', description: '清理首页广告卡片和页面广告占位',
  settings: [{ key: 'enabled', type: 'boolean', default: true, label: '启用广告拦截' }],
  onLoad(context) {
    if (typeof document === 'undefined' || !context.getSetting<boolean>('enabled')) return
    const style = document.createElement('style'); style.id = STYLE_ID
    style.textContent = `${selectors.join(',')}{display:none!important}`
    document.head.appendChild(style)
    const removeAds = () => document.querySelectorAll(selectors.join(',')).forEach((element) => element.remove())
    removeAds()
    const observer = new MutationObserver(removeAds)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('bilihub:ad-block:stop', () => observer.disconnect(), { once: true })
  },
  onUnload() { document.dispatchEvent(new Event('bilihub:ad-block:stop')); document.getElementById(STYLE_ID)?.remove() },
}
import type { RuntimeModule } from '@bilihub/runtime'

const STYLE_ID = 'bilihub-live-enhance'

export const liveEnhance: RuntimeModule = {
  id: 'live-enhance', name: '直播增强', category: 'live', version: '0.1.0', description: '清理直播礼物特效、侧栏和重复提醒',
  settings: [{ key: 'hideGiftEffects', type: 'boolean', default: true, label: '隐藏礼物特效' }, { key: 'hideSidebar', type: 'boolean', default: false, label: '隐藏直播侧栏' }],
  onLoad(context) {
    if (typeof document === 'undefined') return
    const style = document.createElement('style'); style.id = STYLE_ID
    const rules = [context.getSetting<boolean>('hideGiftEffects') ? '.web-player-icon-room,.gift-panel,.web-live-room__gift{display:none!important}' : '', context.getSetting<boolean>('hideSidebar') ? '.right-container,.aside-area{display:none!important}' : '']
    style.textContent = rules.join('')
    document.head.appendChild(style)
  },
  onUnload() { document.getElementById(STYLE_ID)?.remove() },
}
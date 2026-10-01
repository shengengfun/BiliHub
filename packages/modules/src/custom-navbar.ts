import type { RuntimeModule } from '@bilihub/runtime'

const STYLE_ID = 'bilihub-custom-navbar'

export const customNavbar: RuntimeModule = {
  id: 'custom-navbar', name: '自定义顶栏', category: 'ui', version: '0.1.0',
  description: '将 BiliHub 工具入口固定到 B 站顶栏',
  settings: [{ key: 'compact', type: 'boolean', default: false, label: '紧凑顶栏' }],
  onLoad(context) {
    if (typeof document === 'undefined') return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = context.getSetting<boolean>('compact') ? '.bili-header__bar{min-height:48px!important}.bili-header__channel{display:none!important}' : '.bili-header__bar{backdrop-filter:blur(12px)}'
    document.head.appendChild(style)
  },
  onUnload() { document.getElementById(STYLE_ID)?.remove() },
}
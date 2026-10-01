import type { RuntimeModule } from '@bilihub/runtime'

const STYLE_ID = 'bilihub-dark-mode'

export const darkMode: RuntimeModule = {
  id: 'dark-mode', name: '夜间模式', category: 'style', version: '0.1.0',
  description: '降低页面亮度并减少夜间观看刺激',
  settings: [{ key: 'mode', type: 'select', default: 'auto', label: '模式', options: [{ label: '跟随系统', value: 'auto' }, { label: '始终开启', value: 'on' }, { label: '关闭', value: 'off' }] }],
  onLoad(context) {
    if (typeof document === 'undefined' || context.getSetting<string>('mode') === 'off') return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = 'html{filter:saturate(.92)}body{background:#111317!important}.bili-header__bar{background:#17191f!important}'
    document.head.appendChild(style)
  },
  onUnload() { document.getElementById(STYLE_ID)?.remove() },
}
import type { RuntimeModule } from '@bilihub/runtime'

const STYLE_ID = 'bilihub-ambient-light'

export const ambientLight: RuntimeModule = {
  id: 'ambient-light', name: 'AmbientLight', category: 'ambient', version: '0.1.0',
  description: '从视频画面边缘采样并生成沉浸式背景光',
  settings: [{ key: 'enabled', type: 'boolean', default: true, label: '启用氛围光' }, { key: 'fps', type: 'number', default: 15, label: '采样频率', min: 1, max: 30, step: 1 }],
  onLoad(context) {
    if (!context.getSetting<boolean>('enabled') || typeof document === 'undefined') return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = 'body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147483640;box-shadow:inset 0 0 140px rgba(71,183,174,.13);transition:box-shadow .35s}'
    document.head.appendChild(style)
    context.log.info('AmbientLight 已加载')
  },
  onUnload() { document.getElementById(STYLE_ID)?.remove() },
}
import type { RuntimeModule } from '@bilihub/runtime'

const STYLE_ID = 'bilihub-danmaku-enhance'

export const danmakuEnhance: RuntimeModule = {
  id: 'danmaku-enhance', name: '弹幕优化', category: 'danmaku', version: '0.1.0', description: '优化弹幕透明度、字号和密度',
  settings: [{ key: 'opacity', type: 'range', default: 0.86, label: '弹幕透明度', min: 0.2, max: 1, step: 0.05 }, { key: 'fontSize', type: 'number', default: 24, label: '弹幕字号', min: 12, max: 48 }],
  onLoad(context) {
    if (typeof document === 'undefined') return
    const style = document.createElement('style'); style.id = STYLE_ID
    const opacity = context.getSetting<number>('opacity'); const fontSize = context.getSetting<number>('fontSize')
    style.textContent = `.b-danmaku,.bili-danmaku,.b-danmaku-item{opacity:${opacity}!important;font-size:${fontSize}px!important;text-shadow:1px 1px 2px #000,0 0 3px #000!important}`
    document.head.appendChild(style)
  },
  onUnload() { document.getElementById(STYLE_ID)?.remove() },
}
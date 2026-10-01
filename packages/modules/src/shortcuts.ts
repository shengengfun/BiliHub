import type { RuntimeModule } from '@bilihub/runtime'

const bindings: Record<string, string> = { toggleDanmaku: 'D', screenshot: 'Shift+S', download: 'Alt+D', toggleAmbient: 'A' }

export const shortcuts: RuntimeModule = {
  id: 'shortcuts', name: '快捷键', category: 'utility', version: '0.1.0', description: '用键盘控制弹幕、截图、下载与氛围光',
  settings: Object.entries(bindings).map(([key, value]) => ({ key, type: 'string' as const, default: value, label: key })),
  onLoad(context) {
    if (typeof window === 'undefined') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      const combo = `${event.shiftKey ? 'Shift+' : ''}${event.altKey ? 'Alt+' : ''}${event.key.length === 1 ? event.key.toUpperCase() : event.key}`
      const actions = Object.entries(bindings)
      const action = actions.find(([key, fallback]) => context.getSetting<string>(key) === combo || fallback === combo)?.[0]
      if (action) window.dispatchEvent(new CustomEvent(`bilihub:shortcut:${action}`))
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('bilihub:shortcuts:cleanup', () => window.removeEventListener('keydown', onKeyDown), { once: true })
  },
  onUnload() { window.dispatchEvent(new Event('bilihub:shortcuts:cleanup')) },
}
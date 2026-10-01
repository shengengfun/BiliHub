import type { RuntimeModule } from '@bilihub/runtime'

export const screenshot: RuntimeModule = {
  id: 'screenshot', name: '截图', category: 'video', version: '0.1.0', description: '截取当前视频画面并保存',
  settings: [{ key: 'includeDanmaku', type: 'boolean', default: false, label: '包含弹幕' }],
  onLoad() { window.addEventListener('bilihub:shortcut:screenshot', () => window.dispatchEvent(new CustomEvent('bilihub:screenshot:request'))) },
  onUnload() { window.dispatchEvent(new Event('bilihub:shortcut:screenshot:cleanup')) },
}
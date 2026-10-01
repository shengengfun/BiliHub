import type { RuntimeModule } from '@bilihub/runtime'

/**
 * 截图
 * 播放页抓当前视频帧（可选叠加弹幕），其他页面交给主进程抓窗口。
 * 默认快捷键 Alt+S。
 */
export const screenshot: RuntimeModule = {
  id: 'screenshot',
  name: '截图',
  category: 'utility',
  version: '1.0.0',
  description: '抓取当前视频帧或整个窗口并保存到本地',

  settings: [
    { key: 'withDanmaku', type: 'boolean', default: true, label: '截图包含弹幕' },
    { key: 'format', type: 'select', default: 'png', label: '图片格式', options: [{ label: 'PNG', value: 'png' }, { label: 'JPEG', value: 'jpeg' }] },
    { key: 'quality', type: 'range', default: 0.92, min: 0.5, max: 1, step: 0.02, label: 'JPEG 质量' },
    { key: 'shortcut', type: 'boolean', default: true, label: '启用 Alt+S 快捷键' },
    { key: 'floatingButton', type: 'boolean', default: true, label: '显示悬浮截图按钮' },
  ],

  onLoad(context) {
    const withDanmaku = context.getSetting<boolean>('withDanmaku') !== false
    const isJpeg = (context.getSetting<string>('format') ?? 'png') === 'jpeg'
    const type = isJpeg ? 'image/jpeg' : 'image/png'
    const quality = Number(context.getSetting<number>('quality') ?? 0.92)

    let busy = false

    const capture = async () => {
      if (busy) return
      busy = true
      try {
        const video = context.adapter.media.getVideoEl()
        if (video?.videoWidth) {
          const dataUrl = await context.adapter.media.screenshot(video, { withDanmaku, type, quality })
          context.adapter.ui.toast(dataUrl ? '截图已保存' : '截图失败：画面尚未就绪')
          return
        }
        await context.adapter.media.captureWindow()
        context.adapter.ui.toast('窗口截图已保存')
      } catch (error) {
        context.log.error('截图失败', error)
        context.adapter.ui.toast('截图失败')
      } finally {
        busy = false
      }
    }

    const useShortcut = context.getSetting<boolean>('shortcut') !== false
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      void capture()
    }
    if (useShortcut) window.addEventListener('keydown', onKey, true)

    const showButton = context.getSetting<boolean>('floatingButton') !== false
    let button: HTMLButtonElement | null = null
    if (showButton) {
      button = document.createElement('button')
      button.id = 'bilihub-shot-btn'
      button.textContent = '截图'
      button.style.cssText = 'position:fixed;right:16px;bottom:118px;z-index:2147483644;padding:8px 14px;border:0;border-radius:16px;background:rgba(24,26,32,.86);color:#dfe3ea;font:12px -apple-system,"Segoe UI",sans-serif;cursor:pointer'
      button.addEventListener('click', () => void capture())
      document.body.appendChild(button)
    }

    context.log.info(`截图模块已启用${useShortcut ? '（Alt+S）' : ''}`)
    ;(screenshot as RuntimeModule & { __cleanup?: () => void }).__cleanup = () => {
      window.removeEventListener('keydown', onKey, true)
      button?.remove()
    }
  },

  onUnload() {
    ;(screenshot as RuntimeModule & { __cleanup?: () => void }).__cleanup?.()
    document.getElementById('bilihub-shot-btn')?.remove()
  },
}

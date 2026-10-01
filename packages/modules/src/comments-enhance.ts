import type { RuntimeModule } from '@bilihub/runtime'
import { injectStyle } from './util.js'

/**
 * 评论区增强
 * 关键词屏蔽、显示 IP 属地、展开被折叠的长评论、加宽评论区。
 */
const STYLE_ID = 'bilihub-comments-enhance'
const HIDDEN_ATTR = 'data-bilihub-reply-hidden'

export const commentsEnhance: RuntimeModule = {
  id: 'comments-enhance',
  name: '评论区增强',
  category: 'enhance',
  version: '1.0.0',
  description: '屏蔽关键词评论、展开折叠内容、突出 IP 属地',

  settings: [
    { key: 'blockWords', type: 'text', default: '', label: '屏蔽关键词（逗号分隔）' },
    { key: 'blockUsers', type: 'text', default: '', label: '屏蔽用户名（逗号分隔）' },
    { key: 'highlightLocation', type: 'boolean', default: true, label: '突出显示 IP 属地' },
    { key: 'wide', type: 'number', default: 0, min: 0, max: 400, label: '评论区加宽（px，0 为不调整）' },
  ],

  onLoad(context) {
    const blockWords = String(context.getSetting<string>('blockWords') ?? '').split(',').map((w) => w.trim()).filter(Boolean)
    const blockUsers = String(context.getSetting<string>('blockUsers') ?? '').split(',').map((w) => w.trim()).filter(Boolean)
    const highlight = context.getSetting<boolean>('highlightLocation') !== false
    const wide = Number(context.getSetting<number>('wide') ?? 0)
    const hidden = new WeakSet<Element>()

    const css = [
      highlight ? '.reply-item .reply-info .reply-time, .sub-reply-item .sub-reply-info .sub-reply-time { color: #9499a0; }' : '',
      highlight ? '.reply-item .reply-location, .reply-item [class*="location"] { color: #ff6699 !important; }' : '',
      wide > 0 ? `.reply-warp, .comment-container { max-width: ${960 + wide}px !important; }` : '',
      `[${HIDDEN_ATTR}="1"] { display: none !important; }`,
    ].filter(Boolean).join('\n')

    const cleanup = injectStyle(STYLE_ID, css)

    const sweep = () => {
      document.querySelectorAll<HTMLElement>('.reply-item, .sub-reply-item, .bili-comment').forEach((node) => {
        if (hidden.has(node)) return
        const text = node.textContent ?? ''
        const user = node.querySelector('.user-name, .sub-user-name, [class*="uname"]')?.textContent ?? ''

        const hitWord = blockWords.some((word) => text.includes(word))
        const hitUser = blockUsers.some((name) => user.trim() === name)
        if (hitWord || hitUser) {
          node.setAttribute(HIDDEN_ATTR, '1')
          hidden.add(node)
          return
        }

        // 折叠的长评论直接展开
        const folded = node.querySelector<HTMLElement>('[class*="fold"], .reply-content-ellipsis')
        if (folded) folded.style.webkitLineClamp = 'unset'
      })
    }

    sweep()
    const timer = window.setInterval(sweep, 2000)
    context.log.info('评论区增强已启用')

    ;(commentsEnhance as RuntimeModule & { __cleanup?: () => void }).__cleanup = () => {
      window.clearInterval(timer)
      cleanup()
    }
  },

  onUnload() {
    ;(commentsEnhance as RuntimeModule & { __cleanup?: () => void }).__cleanup?.()
    document.querySelectorAll(`[${HIDDEN_ATTR}="1"]`).forEach((node) => node.removeAttribute(HIDDEN_ATTR))
    document.getElementById(STYLE_ID)?.remove()
  },
}

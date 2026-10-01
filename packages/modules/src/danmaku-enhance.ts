import type { RuntimeModule } from '@bilihub/runtime'
import { injectStyle } from './util.js'

/**
 * 弹幕优化
 * 提供屏蔽词（支持 /正则/）、重复弹幕合并、透明度/字号/速度覆盖。
 * 网页版弹幕节点会被持续重建，所以用 CSS 变量 + 定时清理组合实现。
 */
const STYLE_ID = 'bilihub-danmaku-enhance'
const HIDDEN_ATTR = 'data-bilihub-dm-hidden'

export const danmakuEnhance: RuntimeModule = {
  id: 'danmaku-enhance',
  name: '弹幕优化',
  category: 'danmaku',
  version: '1.0.0',
  description: '屏蔽词过滤、重复弹幕合并，并统一下发透明度与字号',

  settings: [
    { key: 'blockWords', type: 'text', default: '', label: '屏蔽词（逗号分隔，/xx/ 视为正则）' },
    { key: 'blockSame', type: 'boolean', default: false, label: '屏蔽重复弹幕' },
    { key: 'opacity', type: 'range', default: 1, min: 0.1, max: 1, step: 0.05, label: '不透明度' },
    { key: 'fontScale', type: 'range', default: 1, min: 0.6, max: 2, step: 0.05, label: '字号缩放' },
    { key: 'hideBottom', type: 'boolean', default: false, label: '屏蔽底部弹幕' },
    { key: 'hideTop', type: 'boolean', default: false, label: '屏蔽顶部弹幕' },
    { key: 'blockLevel', type: 'number', default: 0, min: 0, max: 6, label: '屏蔽低于该等级的发送者（0 为不限制）' },
  ],

  onLoad(context) {
    const blockWords = String(context.getSetting<string>('blockWords') ?? '')
      .split(',')
      .map((word) => word.trim())
      .filter(Boolean)
    const blockSame = context.getSetting<boolean>('blockSame') === true
    const hidden = new WeakSet<Element>()
    const seen = new Set<string>()

    const matchers = blockWords.map((word) => {
      if (word.length > 2 && word.startsWith('/') && word.endsWith('/')) {
        try {
          return new RegExp(word.slice(1, -1))
        } catch {
          return null
        }
      }
      return word
    }).filter((item): item is string | RegExp => item !== null)

    const cleanup = injectStyle(STYLE_ID, `
      .bpx-player-dm-wrap, .bilibili-player-video-danmaku {
        opacity: ${context.getSetting<number>('opacity') ?? 1} !important;
        font-size: ${Math.round((context.getSetting<number>('fontScale') ?? 1) * 100)}% !important;
      }
      [${HIDDEN_ATTR}="1"] { display: none !important; }
    `)

    const shouldHide = (text: string): boolean => {
      for (const matcher of matchers) {
        if (typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text)) return true
      }
      return false
    }

    /** 网页版底部/顶部弹幕靠坐标判断，这里用 class 近似 */
    const isTop = (node: HTMLElement) => node.classList.contains('danmaku-item-top') || node.dataset.danmakuPos === 'top'
    const isBottom = (node: HTMLElement) => node.classList.contains('danmaku-item-bottom') || node.dataset.danmakuPos === 'bottom'

    const sweep = () => {
      const nodes = document.querySelectorAll<HTMLElement>('[class*="danmaku-item"], [class*="bili-danmaku"]')
      nodes.forEach((node) => {
        if (hidden.has(node)) return
        const text = (node.textContent ?? '').trim()
        if (!text) return

        let hide = false
        if (matchers.length && shouldHide(text)) hide = true
        if (!hide && context.getSetting<boolean>('hideTop') && isTop(node)) hide = true
        if (!hide && context.getSetting<boolean>('hideBottom') && isBottom(node)) hide = true
        if (!hide && blockSame) {
          if (seen.has(text)) hide = true
          else seen.add(text)
        }

        if (hide) {
          node.setAttribute(HIDDEN_ATTR, '1')
          hidden.add(node)
        }
      })
    }

    sweep()
    const timer = window.setInterval(sweep, 1500)
    context.log.info(`弹幕优化已启用，屏蔽词 ${matchers.length} 条`)

    ;(danmakuEnhance as RuntimeModule & { __cleanup?: () => void }).__cleanup = () => {
      window.clearInterval(timer)
      cleanup()
    }
  },

  onUnload() {
    ;(danmakuEnhance as RuntimeModule & { __cleanup?: () => void }).__cleanup?.()
    document.querySelectorAll(`[${HIDDEN_ATTR}="1"]`).forEach((node) => node.removeAttribute(HIDDEN_ATTR))
    document.getElementById(STYLE_ID)?.remove()
  },
}

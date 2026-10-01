import type { RuntimeModule } from '@bilihub/runtime'

const STYLE_ID = 'bilihub-comments-enhance'

export const commentsEnhance: RuntimeModule = {
  id: 'comments-enhance', name: '评论增强', category: 'ui', version: '0.1.0', description: '折叠过长评论并突出高质量回复',
  settings: [{ key: 'collapseLong', type: 'boolean', default: true, label: '折叠长评论' }],
  onLoad(context) {
    if (typeof document === 'undefined' || !context.getSetting<boolean>('collapseLong')) return
    const style = document.createElement('style'); style.id = STYLE_ID
    style.textContent = '.reply-item .root-reply:not(.is-up):has(.reply-content > .view-more){max-height:120px;overflow:hidden}.reply-item .root-reply:not(.is-up):has(.reply-content > .view-more)::after{content:"展开评论";display:block;color:#00aeec;cursor:pointer;margin-top:8px}'
    document.head.appendChild(style)
  },
  onUnload() { document.getElementById(STYLE_ID)?.remove() },
}
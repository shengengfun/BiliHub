import type { RuntimeModule } from '@bilihub/runtime'
import { injectStyle } from './util.js'

/**
 * 弹幕工具
 *   1. 在播放页挂一个发送弹幕的输入条（走主进程写接口，自动补 csrf）
 *   2. 弹幕发送人查询：弹幕只带 CRC32(UID) 哈希，本地建立 UID→哈希索引后反查
 */
const STYLE_ID = 'bilihub-danmaku-tools'
const FORM_ID = 'bilihub-dm-form'
const LOOKUP_ID = 'bilihub-dm-lookup'

/** CRC32(uid) 的十进制字符串，与 B 站下发弹幕里的 midHash 一致 */
export function midHash(uid: number | string): string {
  const table = CRC_TABLE
  const text = String(uid)
  let crc = 0xffffffff
  for (let index = 0; index < text.length; index += 1) {
    crc = table[(crc ^ text.charCodeAt(index)) & 0xff] ^ (crc >>> 8)
  }
  return String((crc ^ 0xffffffff) >>> 0)
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

interface KnownUser {
  mid: number
  name: string
  face?: string
}

export const danmakuTools: RuntimeModule = {
  id: 'danmaku-tools',
  name: '弹幕工具',
  category: 'danmaku',
  version: '1.0.0',
  description: '在播放页直接发送弹幕，并可反查弹幕发送者（基于本地 UID 哈希索引）',

  settings: [
    { key: 'enableSend', type: 'boolean', default: true, label: '显示弹幕发送框' },
    { key: 'enableLookup', type: 'boolean', default: true, label: '启用发送人查询' },
    { key: 'defaultColor', type: 'text', default: '#ffffff', label: '默认弹幕颜色' },
    { key: 'defaultMode', type: 'select', default: '1', label: '默认弹幕类型', options: [
      { label: '滚动', value: '1' },
      { label: '底部', value: '4' },
      { label: '顶部', value: '5' },
    ] },
    { key: 'collectUsers', type: 'boolean', default: true, label: '自动从评论区采集 UID 用于反查' },
  ],

  onLoad(context) {
    const enableSend = context.getSetting<boolean>('enableSend') !== false
    const enableLookup = context.getSetting<boolean>('enableLookup') !== false
    const defaultColor = context.getSetting<string>('defaultColor') ?? '#ffffff'
    const defaultMode = Number(context.getSetting<string>('defaultMode') ?? '1')
    const collect = context.getSetting<boolean>('collectUsers') !== false

    /** UID 哈希 → 用户；只装我们合法拿到的数据（评论区、UP 主） */
    const knownUsers = new Map<string, KnownUser>()

    const remember = (user: KnownUser) => {
      if (!user?.mid) return
      knownUsers.set(midHash(user.mid), user)
    }

    const cleanupStyle = injectStyle(STYLE_ID, `
      #${FORM_ID} {
        position: absolute; left: 16px; right: 16px; bottom: 96px; z-index: 88;
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; border-radius: 20px;
        background: rgba(24, 26, 32, .82); backdrop-filter: blur(10px);
      }
      #${FORM_ID} input[type="text"] { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: #fff; font: 13px -apple-system, "Segoe UI", sans-serif; }
      #${FORM_ID} input[type="text"]::placeholder { color: #838383; }
      #${FORM_ID} input[type="color"] { width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: pointer; }
      #${FORM_ID} select { border: 0; background: none; color: #c9ccd0; font: 12px -apple-system, "Segoe UI", sans-serif; }
      #${FORM_ID} button {
        padding: 5px 14px; border: 0; border-radius: 14px; cursor: pointer;
        background: #ff6699; color: #fff; font: 12px -apple-system, "Segoe UI", sans-serif;
      }
      #${FORM_ID} button:disabled { background: #5a5a5f; color: #9a9a9f; cursor: default; }
      #${LOOKUP_ID} {
        position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 2147483647;
        width: 320px; padding: 18px 20px; border-radius: 10px;
        background: #fff; color: #18191c; box-shadow: 0 18px 50px rgba(0, 0, 0, .35);
        font: 13px -apple-system, "Segoe UI", sans-serif;
      }
      #${LOOKUP_ID} .head { font-size: 15px; font-weight: 600; margin-bottom: 10px; }
      #${LOOKUP_ID} .content { padding: 9px 11px; border-radius: 6px; background: #f1f2f3; color: #61666d; line-height: 1.6; word-break: break-all; }
      #${LOOKUP_ID} .user { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
      #${LOOKUP_ID} .user img { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; }
      #${LOOKUP_ID} .tip { margin-top: 10px; color: #9499a0; line-height: 1.7; }
      #${LOOKUP_ID} code { display: inline-block; margin-top: 6px; padding: 2px 6px; border-radius: 4px; background: #f1f2f3; }
      #${LOOKUP_ID} .close { margin-top: 14px; width: 100%; padding: 9px; border: 0; border-radius: 18px; background: #ff6699; color: #fff; cursor: pointer; }
    `)

    let stopVideo: (() => void) | undefined
    let form: HTMLFormElement | null = null
    let panel: HTMLElement | null = null
    let videoEl: HTMLVideoElement | null = null

    const closePanel = () => {
      panel?.remove()
      panel = null
    }

    const showSender = (content: string, hash: string) => {
      closePanel()
      panel = document.createElement('div')
      panel.id = LOOKUP_ID
      const user = knownUsers.get(hash)
      panel.innerHTML = `
        <div class="head">弹幕发送人</div>
        <div class="content">「${escapeHtml(content)}」</div>
        ${user
          ? `<div class="user"><img src="${user.face ?? ''}" alt="" /><div><b>${escapeHtml(user.name)}</b><div class="tip">UID ${user.mid}</div></div></div>`
          : `<div class="tip">官方未开放哈希反查接口，仅能显示发送者哈希。<br /><code>${hash}</code></div>`}
        <button class="close">关闭</button>`
      panel.querySelector('.close')?.addEventListener('click', closePanel)
      document.body.appendChild(panel)
    }

    const submit = async () => {
      const input = form?.querySelector<HTMLInputElement>('input[type="text"]')
      const text = input?.value.trim()
      if (!text) return
      const page = context.adapter.page()
      if (!page.bvid) {
        context.adapter.ui.toast('当前不在视频播放页')
        return
      }
      try {
        const view = await context.adapter.http({ url: `https://api.bilibili.com/x/web-interface/view?bvid=${page.bvid}` })
        const cid = Number((view.data as { data?: { cid?: number } })?.data?.cid ?? page.cid)
        const colorInput = form?.querySelector<HTMLInputElement>('input[type="color"]')
        const modeSelect = form?.querySelector<HTMLSelectElement>('select')
        const response = await context.adapter.http({
          url: 'https://api.bilibili.com/x/v2/dm/post',
          method: 'POST',
          body: {
            type: 1,
            oid: cid,
            bvid: page.bvid,
            msg: text,
            mode: Number(modeSelect?.value ?? defaultMode),
            color: parseInt((colorInput?.value ?? defaultColor).replace('#', ''), 16),
            fontsize: 25,
            progress: Math.max(0, Math.floor((videoEl?.currentTime ?? 0) * 1000)),
            pool: 0,
            plat: 1,
          },
        })
        const result = (response.data as { code?: number; message?: string }) ?? {}
        if (result.code !== 0) {
          context.adapter.ui.toast(result.message || `发送失败（code ${result.code}）`)
          return
        }
        if (input) input.value = ''
        context.adapter.ui.toast('弹幕已发送')
      } catch (error) {
        context.log.error('发送弹幕失败', error)
        context.adapter.ui.toast('发送失败')
      }
    }

    const unsubscribeVideo = context.adapter.media.onVideoChange((video) => {
      stopVideo?.()
      form?.remove()
      form = null
      videoEl = video
      if (!video) return

      if (collect) {
        void (async () => {
          const page = context.adapter.page()
          if (!page.bvid) return
          try {
            const view = await context.adapter.http({ url: `https://api.bilibili.com/x/web-interface/view?bvid=${page.bvid}` })
            const data = (view.data as { data?: { owner?: KnownUser } })?.data
            if (data?.owner) remember(data.owner)
          } catch {
            /* 忽略 */
          }
        })()
      }

      if (enableSend) {
        const container = (video.closest('.bpx-player-container, .bilibili-player-video-wrap, #bilibili-player') as HTMLElement | null) ?? document.body
        form = document.createElement('form')
        form.id = FORM_ID
        form.innerHTML = `
          <input type="text" maxlength="100" placeholder="发送弹幕，回车确认" />
          <input type="color" value="${defaultColor}" title="弹幕颜色" />
          <select title="弹幕类型">
            <option value="1">滚动</option>
            <option value="4">底部</option>
            <option value="5">顶部</option>
          </select>
          <button type="submit">发送</button>`
        form.addEventListener('submit', (event) => {
          event.preventDefault()
          void submit()
        })
        container.appendChild(form)
      }

      if (enableLookup) {
        const onContextMenu = (event: MouseEvent) => {
          const target = (event.target as HTMLElement)?.closest('[class*="danmaku-item"]') as HTMLElement | null
          if (!target) return
          const hash = target.dataset.bilihubMidHash ?? target.getAttribute('data-mid-hash') ?? ''
          if (!hash) return
          showSender(target.textContent ?? '', hash)
        }
        document.addEventListener('contextmenu', onContextMenu)
        stopVideo = () => document.removeEventListener('contextmenu', onContextMenu)
      }
    })

    context.log.info('弹幕工具已启用')
    ;(danmakuTools as RuntimeModule & { __cleanup?: () => void }).__cleanup = () => {
      stopVideo?.()
      unsubscribeVideo()
      cleanupStyle()
      form?.remove()
      closePanel()
    }
  },

  onUnload() {
    ;(danmakuTools as RuntimeModule & { __cleanup?: () => void }).__cleanup?.()
    document.getElementById(FORM_ID)?.remove()
    document.getElementById(LOOKUP_ID)?.remove()
    document.getElementById(STYLE_ID)?.remove()
  },
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

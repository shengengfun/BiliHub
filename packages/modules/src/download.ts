import type { RuntimeAdapter, RuntimeModule } from '@bilihub/runtime'
import { injectStyle } from './util.js'

/**
 * 视频 / 封面 / 弹幕 / 元数据下载
 * 在播放页右上角挂一个下载菜单，走主进程的下载管理器（队列 + 断点续传）。
 */
const STYLE_ID = 'bilihub-download-style'
const MENU_ID = 'bilihub-download-menu'
const BTN_ID = 'bilihub-download-btn'

export const download: RuntimeModule = {
  id: 'download',
  name: '视频下载',
  category: 'download',
  version: '1.0.0',
  description: '一键下载当前视频、封面、弹幕与元数据，支持清晰度选择与断点续传',

  settings: [
    { key: 'quality', type: 'select', default: '80', label: '默认清晰度', options: [
      { label: '1080P', value: '80' },
      { label: '720P', value: '64' },
      { label: '480P', value: '32' },
      { label: '360P', value: '16' },
    ] },
    { key: 'autoDanmaku', type: 'boolean', default: true, label: '同时保存弹幕' },
    { key: 'autoMeta', type: 'boolean', default: true, label: '同时保存元数据' },
    { key: 'button', type: 'boolean', default: true, label: '在播放页显示下载按钮' },
  ],

  onLoad(context) {
    const cleanupStyle = injectStyle(STYLE_ID, `
      #${BTN_ID} {
        position: absolute; right: 16px; top: 12px; z-index: 89;
        padding: 6px 14px; border: 0; border-radius: 14px; cursor: pointer;
        background: rgba(24, 26, 32, .82); color: #dfe3ea;
        font: 12px -apple-system, "Segoe UI", sans-serif;
      }
      #${BTN_ID}:hover { background: rgba(255, 102, 153, .9); color: #fff; }
      #${MENU_ID} {
        position: absolute; right: 16px; top: 46px; z-index: 89;
        min-width: 168px; padding: 6px; border-radius: 8px;
        background: rgba(24, 24, 28, .96);
        box-shadow: 0 10px 30px rgba(0, 0, 0, .45);
        display: flex; flex-direction: column; gap: 2px;
      }
      #${MENU_ID} button {
        padding: 9px 12px; border: 0; border-radius: 5px; cursor: pointer;
        background: none; color: #c9ccd0; text-align: left;
        font: 13px -apple-system, "Segoe UI", sans-serif;
      }
      #${MENU_ID} button:hover { background: rgba(255, 255, 255, .08); color: #fff; }
    `)

    /** 从播放页地址与接口拿到 bvid / cid / 标题 */
    const resolveVideo = async () => {
      const page = context.adapter.page()
      if (!page.bvid) return null
      const response = await context.adapter.http({ url: `https://api.bilibili.com/x/web-interface/view?bvid=${page.bvid}` })
      const data = (response.data as { data?: Record<string, unknown> })?.data
      if (!data) return null
      return {
        bvid: String(data.bvid),
        cid: Number(data.cid),
        title: String(data.title ?? page.bvid),
        cover: String(data.pic ?? ''),
        duration: Number(data.duration ?? 0),
        owner: (data.owner as { name?: string })?.name ?? '',
        stat: data.stat ?? {},
        pages: data.pages ?? [],
      }
    }

    const startDownload = async (kind: 'video' | 'cover' | 'danmaku' | 'metadata') => {
      const info = await resolveVideo()
      if (!info) {
        context.adapter.ui.toast('当前不在视频播放页')
        return
      }

      if (kind === 'cover' && info.cover) {
        await context.adapter.download.save({ type: 'cover', url: info.cover, title: `${info.title}-封面`, filename: `${info.title}-封面.jpg` })
        context.adapter.ui.toast('封面已加入下载队列')
        return
      }

      if (kind === 'danmaku') {
        await saveDanmaku(context, info.cid, info.title)
        return
      }

      if (kind === 'metadata') {
        await context.adapter.download.save({
          type: 'metadata',
          url: `bilihub://metadata/${info.bvid}`,
          filename: `${info.title}-info.json`,
          title: `${info.title}-信息`,
          content: JSON.stringify(info, null, 2),
        })
        context.adapter.ui.toast('视频信息已保存')
        return
      }

      const quality = context.getSetting<string>('quality') ?? '80'
      const response = await context.adapter.http({
        url: `https://api.bilibili.com/x/player/playurl?bvid=${info.bvid}&cid=${info.cid}&fnval=0&qn=${quality}&fourk=1`,
      })
      const play = (response.data as { data?: { durl?: { url: string }[]; quality?: number } })?.data
      const direct = play?.durl?.[0]?.url
      if (!direct) {
        context.adapter.ui.toast('没有可用的下载直链，可能需要登录')
        return
      }
      await context.adapter.download.save({
        type: 'video',
        url: direct,
        bvid: info.bvid,
        cid: info.cid,
        title: info.title,
        filename: `${info.title}-${play?.quality ?? quality}P.mp4`,
      })
      context.adapter.ui.toast('视频已加入下载队列')

      if (context.getSetting<boolean>('autoDanmaku') !== false) await saveDanmaku(context, info.cid, info.title)
      if (context.getSetting<boolean>('autoMeta') !== false) {
        await context.adapter.download.save({
          type: 'metadata',
          url: `bilihub://metadata/${info.bvid}`,
          filename: `${info.title}-info.json`,
          title: `${info.title}-信息`,
          content: JSON.stringify(info, null, 2),
        })
      }
    }

    let stopVideo: (() => void) | undefined
    let button: HTMLButtonElement | null = null
    let menu: HTMLElement | null = null

    const showButton = context.getSetting<boolean>('button') !== false
    if (!showButton) {
      context.log.info('下载按钮已关闭，仅保留快捷键接口')
      return
    }

    const unsubscribe = context.adapter.media.onVideoChange((video) => {
      stopVideo?.()
      button?.remove()
      menu?.remove()
      button = null
      menu = null
      if (!video) return

      const container = (video.closest('.bpx-player-container, .bilibili-player-video-wrap, #bilibili-player') as HTMLElement | null) ?? document.body

      button = document.createElement('button')
      button.id = BTN_ID
      button.textContent = '下载'
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        if (menu) {
          menu.remove()
          menu = null
          return
        }
        menu = document.createElement('div')
        menu.id = MENU_ID
        for (const [label, kind] of [
          ['下载视频（含弹幕）', 'video'],
          ['下载封面', 'cover'],
          ['下载弹幕', 'danmaku'],
          ['导出视频信息', 'metadata'],
        ] as const) {
          const item = document.createElement('button')
          item.textContent = label
          item.addEventListener('click', () => {
            menu?.remove()
            menu = null
            void startDownload(kind).catch((error) => {
              context.log.error('下载失败', error)
              context.adapter.ui.toast('下载失败')
            })
          })
          menu.appendChild(item)
        }
        container.appendChild(menu)
      })
      container.appendChild(button)

      const onLeave = () => {
        menu?.remove()
        menu = null
      }
      document.addEventListener('click', onLeave)
      stopVideo = () => document.removeEventListener('click', onLeave)
    })

    context.log.info('下载模块已启用')
    ;(download as RuntimeModule & { __cleanup?: () => void }).__cleanup = () => {
      stopVideo?.()
      unsubscribe()
      cleanupStyle()
      button?.remove()
      menu?.remove()
    }
  },

  onUnload() {
    ;(download as RuntimeModule & { __cleanup?: () => void }).__cleanup?.()
    document.getElementById(BTN_ID)?.remove()
    document.getElementById(MENU_ID)?.remove()
    document.getElementById(STYLE_ID)?.remove()
  },
}

/** 把弹幕 XML 转成可读格式一并保存 */
async function saveDanmaku(context: { adapter: RuntimeAdapter }, cid: number, title: string) {
  const response = await context.adapter.http({ url: `https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}` })
  const xml = typeof response.data === 'string' ? response.data : ''
  const lines = [...xml.matchAll(/<d p="([^"]+)">([^<]*)<\/d>/g)].map((match) => `${match[1]}:${match[2]}`)
  await context.adapter.download.save({
    type: 'danmaku',
    url: `https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`,
    title: `${title}-弹幕`,
    filename: `${title}-弹幕.xml`,
    content: `<?xml version="1.0" encoding="UTF-8"?>\n<i>\n${lines.join('\n')}\n</i>\n`,
  })
}

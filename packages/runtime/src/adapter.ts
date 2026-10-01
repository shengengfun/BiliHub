import type { DownloadRequest, RuntimeAdapter, RuntimeStorage, ScreenshotOptions } from './types.js'

/** preload 通过 contextBridge 暴露的原始桥接对象（隔离世界里的本地引用） */
export interface NativeBridge {
  storage: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> }
  httpRequest(options: { url: string; method?: string; body?: unknown }): Promise<{ status: number; data: unknown }>
  biliApi(url: string): Promise<{ status: number; data: unknown }>
  biliPost(payload: { url: string; body?: Record<string, unknown> }): Promise<{ status: number; data: unknown }>
  download(payload: DownloadRequest): Promise<unknown>
  saveData(payload: { dataUrl: string; filename: string }): Promise<unknown>
  openBilibili(url?: string): Promise<unknown>
  screenshot(): Promise<unknown>
  auth: { status(): Promise<{ isLogin?: boolean; name?: string }> }
}

/**
 * 把原始桥接封装成模块可用的适配器（guide 4.4）。
 * 模块只看到 RuntimeAdapter，不直接依赖 electron IPC。
 */
export function createAdapter(bridge: NativeBridge, storage: RuntimeStorage): RuntimeAdapter {
  const videoListeners = new Set<(video: HTMLVideoElement | null) => void>()
  let currentVideo: HTMLVideoElement | null = null
  let observer: MutationObserver | null = null

  /** B 站播放器会在切换分 P / 清晰度时替换 video 元素，必须持续跟踪 */
  function ensureTracker() {
    if (observer || typeof document === 'undefined') return
    const check = () => {
      const video = document.querySelector('video') as HTMLVideoElement | null
      if (video !== currentVideo) {
        currentVideo = video
        videoListeners.forEach((callback) => callback(video))
      }
    }
    observer = new MutationObserver(check)
    observer.observe(document.documentElement, { childList: true, subtree: true })
    check()
  }

  function pageInfo() {
    const url = typeof location !== 'undefined' ? location.href : ''
    const match = /\/video\/(BV[0-9A-Za-z]+)/.exec(url)
    return {
      url,
      isVideo: Boolean(match) || /\/bangumi\/play\//.test(url),
      isLive: /live\.bilibili\.com/.test(url),
      bvid: match?.[1] ?? '',
      cid: Number(new URL(url, 'https://www.bilibili.com').searchParams.get('cid') ?? 0),
    }
  }

  function toast(message: string) {
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:2147483646;pointer-events:none'
    const shadow = host.attachShadow({ mode: 'open' })
    const box = document.createElement('div')
    box.textContent = message
    box.style.cssText = 'padding:10px 18px;border-radius:6px;background:rgba(0,0,0,.8);color:#fff;font:13px -apple-system,"Segoe UI",sans-serif;white-space:nowrap'
    shadow.appendChild(box)
    document.body.appendChild(host)
    setTimeout(() => host.remove(), 2400)
  }

  return {
    storage,

    async http({ url, method, body }) {
      if (method === 'POST') return bridge.biliPost({ url, body })
      return bridge.biliApi(url)
    },

    download: {
      save(request) {
        return bridge.download(request)
      },
    },

    media: {
      getVideoEl() {
        ensureTracker()
        return currentVideo ?? (document.querySelector('video') as HTMLVideoElement | null)
      },
      onVideoChange(callback) {
        ensureTracker()
        videoListeners.add(callback)
        callback(currentVideo)
        return () => videoListeners.delete(callback)
      },
      async screenshot(video, options: ScreenshotOptions = {}) {        if (!video?.videoWidth) return null
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const context = canvas.getContext('2d')
        if (!context) return null
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        // 可选：把弹幕层按比例叠加上去
        if (options.withDanmaku) {
          const overlay = document.querySelector('.bpx-player-dm-wrap, .bilibili-player-video-danmaku') as HTMLElement | null
          if (overlay) {
            const items = overlay.querySelectorAll<HTMLElement>('[class*="danmaku-item"]')
            context.font = `${Math.round(canvas.height / 26)}px sans-serif`
            context.textAlign = 'center'
            items.forEach((item) => {
              const style = getComputedStyle(item)
              const left = parseFloat(style.left || '0')
              const top = parseFloat(style.top || '0')
              if (!Number.isFinite(left) || !Number.isFinite(top)) return
              context.fillStyle = style.color || '#fff'
              context.fillText(item.textContent ?? '', left * canvas.width, top * canvas.height)
            })
          }
        }

        const type = options.type ?? 'image/png'
        const dataUrl = canvas.toDataURL(type, options.quality ?? 0.92)
        await bridge.saveData({ dataUrl, filename: `bilihub-${Date.now()}.png` })
        return dataUrl
      },

      captureWindow() {
        return bridge.screenshot()
      },
    },

    ui: {
      mountPanel(element, options = {}) {
        const host = document.createElement('div')
        host.style.cssText = `position:fixed;right:24px;bottom:88px;z-index:2147483645;width:${options.width ?? 'auto'};height:${options.height ?? 'auto'}`
        const shadow = host.attachShadow({ mode: 'open' })
        const style = document.createElement('style')
        style.textContent = ':host{all:initial} *{box-sizing:border-box;font-family:-apple-system,"Segoe UI",sans-serif}'
        shadow.append(style, element)
        document.body.appendChild(host)
        return () => host.remove()
      },
      toast,
    },

    page: pageInfo,
    openUrl: (url) => bridge.openBilibili(url),
    notify: toast,
    log: console,
  }
}

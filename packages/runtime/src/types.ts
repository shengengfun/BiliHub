import type { ComponentModule } from '@bilihub/shared'

export interface RuntimeStorage {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
}

export interface HttpResponse {
  status: number
  data: unknown
}

export interface DownloadRequest {
  type?: 'video' | 'cover' | 'danmaku' | 'metadata'
  url?: string
  title?: string
  filename?: string
  /** 直接落盘的文本内容（弹幕 XML、元数据 JSON） */
  content?: string
  bvid?: string
  cid?: number | string
}

export interface ScreenshotOptions {
  /** 是否把弹幕层一起合成进图片 */
  withDanmaku?: boolean
  type?: 'image/png' | 'image/jpeg'
  quality?: number
}

/**
 * 页面适配器：模块只依赖这一层，不直接触碰平台细节。
 * 与 guide 4.4 的 PlatformAdapter 对应。
 */
export interface RuntimeAdapter {
  storage: RuntimeStorage
  /** 仅允许 B 站域名的请求，由主进程白名单兜底 */
  http(options: { url: string; method?: string; body?: Record<string, unknown> }): Promise<HttpResponse>
  download: {
    save(request: DownloadRequest): Promise<unknown>
  }
  media: {
    /** B 站播放器会动态替换 video 元素，这里用 MutationObserver 跟踪 */
    getVideoEl(): HTMLVideoElement | null
    onVideoChange(callback: (video: HTMLVideoElement | null) => void): () => void
    screenshot(video: HTMLVideoElement, options?: ScreenshotOptions): Promise<string | null>
    /** 由主进程抓取整个窗口（非播放页场景） */
    captureWindow(): Promise<unknown>
  }
  ui: {
    /** 用 Shadow DOM 挂载模块自己的面板，避免与页面样式互相污染 */
    mountPanel(element: HTMLElement, options?: { width?: string; height?: string }): () => void
    toast(message: string): void
  }
  /** 当前页面标识，用于模块判断所处场景 */
  page(): { url: string; isVideo: boolean; isLive: boolean; bvid: string; cid: number }
  openUrl(url: string): Promise<unknown>
  notify(message: string): void
  log: Pick<Console, 'info' | 'warn' | 'error'>
}

export interface RuntimeContext {
  adapter: RuntimeAdapter
  settings: Record<string, unknown>
  getSetting<T>(key: string): T
  setSetting(key: string, value: unknown): Promise<void>
  log: Pick<Console, 'info' | 'warn' | 'error'>
}

export interface RuntimeModule extends ComponentModule {
  dependencies?: string[]
  onLoad(context: RuntimeContext): void | Promise<void>
  onUnload(): void
}

export type ModuleCategory = 'video' | 'live' | 'style' | 'utility' | 'ambient' | 'danmaku' | 'ui'

export interface ComponentModule {
  id: string
  name: string
  category: ModuleCategory
  version: string
  description: string
  settings: SettingSchema[]
}

export interface SettingSchema {
  key: string
  type: 'boolean' | 'number' | 'string' | 'select' | 'color' | 'range'
  default: unknown
  label: string
  description?: string
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: unknown }[]
}

export interface DanmakuItem {
  id: string
  content: string
  time: number
  mode: 1 | 4 | 5 | 6
  fontSize: number
  color: number
  senderHash: string
  timestamp: number
}

export interface DownloadTask {
  id: string
  url: string
  filename: string
  kind: 'video' | 'cover' | 'danmaku' | 'metadata'
  status: 'queued' | 'downloading' | 'paused' | 'done' | 'failed'
  progress: number
  error?: string
}

export interface PlatformCapabilities {
  platform: 'win32' | 'darwin' | 'linux' | 'android' | 'unknown'
  drm: boolean
  touch: boolean
}

export type PluginPermission = 'storage' | 'ui.page' | 'media.video' | 'danmaku.read' | 'download' | 'notify' | 'clipboard'

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  apiVersion: number
  main: string
  permissions: PluginPermission[]
}
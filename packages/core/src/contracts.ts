import type { DownloadTask, PlatformCapabilities } from '@bilihub/shared'

export interface CoreStorage {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
  delete(key: string): void
}

export interface CoreServices {
  storage: CoreStorage
  platform: PlatformCapabilities
  downloads: {
    list(): DownloadTask[]
    enqueue(task: Omit<DownloadTask, 'id' | 'status' | 'progress'>): DownloadTask
  }
}
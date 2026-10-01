import type { ComponentModule } from '@bilihub/shared'

export interface RuntimeStorage {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
}

export interface RuntimeContext {
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
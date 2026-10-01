import type { RuntimeModule } from '@bilihub/runtime'

const allowedSenderHosts = ['bilibili.com', 'biliapi.net', 'hdslb.com']

export interface DanmakuSendRequest { cid: number; content: string; color?: number; mode?: 1 | 4 | 5 }

export function sendDanmaku(request: DanmakuSendRequest) {
  window.dispatchEvent(new CustomEvent('bilihub:danmaku:send', { detail: { ...request, color: request.color ?? 0xffffff, mode: request.mode ?? 1 } }))
}

export function canLookupSender(url: string) {
  try { return allowedSenderHosts.some((host) => new URL(url).hostname.endsWith(host)) } catch { return false }
}

export const danmakuTools: RuntimeModule = {
  id: 'danmaku-tools', name: '弹幕工具', category: 'danmaku', version: '0.1.0', description: '发送弹幕并查询弹幕发送人信息',
  settings: [{ key: 'showSenderHash', type: 'boolean', default: false, label: '显示发送人标识' }, { key: 'sendMode', type: 'select', default: 'bottom', label: '发送位置', options: [{ label: '滚动', value: 'scroll' }, { label: '底部', value: 'bottom' }, { label: '顶部', value: 'top' }] }],
  onLoad() {},
  onUnload() {},
}

export async function lookupSender(senderHash: string) {
  const native = (window as Window & { bilihubNative?: { httpRequest?: (options: unknown) => Promise<{ status: number; data: unknown }> } }).bilihubNative
  if (!native?.httpRequest) return { supported: false, data: null }
  return { supported: true, ...(await native.httpRequest({ url: `https://api.bilibili.com/x/web-interface/card?mid_hash=${encodeURIComponent(senderHash)}`, responseType: 'json' })) }
}
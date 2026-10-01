import type { RuntimeModule } from '@bilihub/runtime'
import { injectStyle } from './util.js'

/**
 * 播放增强
 * 倍速记忆、音量增益、画中画按钮、去片头片尾静音段提示。
 */
const STYLE_ID = 'bilihub-video-tools'
const BAR_ID = 'bilihub-video-tools-bar'

export const videoTools: RuntimeModule = {
  id: 'video-tools',
  name: '播放增强',
  category: 'player',
  version: '1.0.0',
  description: '倍速记忆、音量增益、画中画与逐帧步进',

  settings: [
    { key: 'rememberRate', type: 'boolean', default: true, label: '记住上次播放倍速' },
    { key: 'defaultRate', type: 'range', default: 1, min: 0.25, max: 3, step: 0.05, label: '默认倍速' },
    { key: 'volumeBoost', type: 'range', default: 1, min: 0.5, max: 4, step: 0.1, label: '音量增益倍数' },
    { key: 'pipButton', type: 'boolean', default: true, label: '显示画中画按钮' },
    { key: 'frameStep', type: 'boolean', default: true, label: '启用逐帧步进（, 与 .）' },
  ],

  onLoad(context) {
    const remember = context.getSetting<boolean>('rememberRate') !== false
    const defaultRate = Number(context.getSetting<number>('defaultRate') ?? 1)
    const boost = Number(context.getSetting<number>('volumeBoost') ?? 1)
    const showPip = context.getSetting<boolean>('pipButton') !== false
    const frameStep = context.getSetting<boolean>('frameStep') !== false
    const rateKey = 'bilihub:playback-rate'

    const cleanupStyle = injectStyle(STYLE_ID, `
      #${BAR_ID} { position: absolute; right: 16px; top: 12px; z-index: 88; display: flex; gap: 6px; }
      #${BAR_ID} button {
        padding: 6px 12px; border: 0; border-radius: 14px; cursor: pointer;
        background: rgba(24, 26, 32, .82); color: #dfe3ea;
        font: 12px -apple-system, "Segoe UI", sans-serif;
      }
      #${BAR_ID} button:hover { background: rgba(255, 102, 153, .9); color: #fff; }
    `)

    let audioContext: AudioContext | null = null
    let gainNode: GainNode | null = null

    const applyBoost = (video: HTMLVideoElement) => {
      if (boost <= 1.001) return
      try {
        type AudioPatch = HTMLMediaElement & { __bilihubGain?: GainNode }
        const patched = video as AudioPatch
        if (patched.__bilihubGain) {
          patched.__bilihubGain.gain.value = boost
          return
        }
        audioContext = audioContext ?? new AudioContext()
        const source = audioContext.createMediaElementSource(video)
        gainNode = audioContext.createGain()
        gainNode.gain.value = boost
        source.connect(gainNode)
        gainNode.connect(audioContext.destination)
        patched.__bilihubGain = gainNode
      } catch (error) {
        context.log.warn('音量增益不可用（可能是受保护音轨）', error)
      }
    }

    let stopVideo: (() => void) | undefined
    let bar: HTMLElement | null = null

    const unsubscribe = context.adapter.media.onVideoChange((video) => {
      stopVideo?.()
      bar?.remove()
      bar = null
      if (!video) return

      // 倍速记忆
      if (remember) {
        const stored = Number(window.localStorage.getItem(rateKey) ?? '0')
        video.playbackRate = stored > 0 ? stored : defaultRate
        const onRate = () => {
          try {
            window.localStorage.setItem(rateKey, String(video.playbackRate))
          } catch {
            /* 忽略写入失败 */
          }
        }
        video.addEventListener('ratechange', onRate)
        stopVideo = () => video.removeEventListener('ratechange', onRate)
      } else {
        video.playbackRate = defaultRate
      }

      applyBoost(video)

      if (showPip || frameStep) {
        const container = (video.closest('.bpx-player-container, .bilibili-player-video-wrap, #bilibili-player') as HTMLElement | null) ?? document.body
        bar = document.createElement('div')
        bar.id = BAR_ID
        if (showPip) {
          const pip = document.createElement('button')
          pip.textContent = '画中画'
          pip.addEventListener('click', async () => {
            try {
              if (document.pictureInPictureElement) await document.exitPictureInPicture()
              else await video.requestPictureInPicture()
            } catch {
              context.adapter.ui.toast('当前浏览器不支持画中画')
            }
          })
          bar.appendChild(pip)
        }
        if (frameStep) {
          for (const [label, delta] of [['◀帧', -1 / 30], ['帧▶', 1 / 30]] as const) {
            const step = document.createElement('button')
            step.textContent = label
            step.addEventListener('click', () => {
              video.pause()
              video.currentTime = Math.max(0, video.currentTime + delta)
            })
            bar.appendChild(step)
          }
        }
        container.appendChild(bar)
      }
    })

    context.log.info('播放增强已启用')
    ;(videoTools as RuntimeModule & { __cleanup?: () => void }).__cleanup = () => {
      stopVideo?.()
      unsubscribe()
      cleanupStyle()
      bar?.remove()
      void audioContext?.close().catch(() => {})
    }
  },

  onUnload() {
    ;(videoTools as RuntimeModule & { __cleanup?: () => void }).__cleanup?.()
    document.getElementById(BAR_ID)?.remove()
    document.getElementById(STYLE_ID)?.remove()
  },
}

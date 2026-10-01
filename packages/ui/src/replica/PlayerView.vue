<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  fetchComments,
  fetchDanmakuXml,
  fetchPlayUrl,
  fetchRelated,
  fetchVideo,
  formatCount,
  formatDate,
  formatDuration,
  formatRelative,
  lookupDanmakuSender,
  mediaUrl,
  qualityLabel,
  sendDanmaku,
} from '../bili.js'
import { api } from '../api.js'
import { user } from '../user.js'
import { brand } from '../brand.js'

const props = defineProps({ bvid: { type: String, required: true } })
const emit = defineEmits(['close', 'play'])

const sideTab = ref('简介')
const detail = ref(null)
const playUrl = ref('')
const error = ref('')
const loading = ref(true)
const recommends = ref([])
const videoEl = ref(null)
const stageEl = ref(null)
const progressEl = ref(null)

const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const fullscreen = ref(false)
const showControls = ref(true)
const showDanmakuPanel = ref(false)

// 播放选项
const playInfo = ref(null)
const quality = ref(0)
const qualityOptions = ref([])
const rate = ref(1)
const volume = ref(0.8)
const muted = ref(false)
const showQuality = ref(false)
const showRate = ref(false)
const busy = ref('')
const toast = ref('')
let toastTimer = null
let pendingSeek = 0

// 弹幕发送 / 发送人查询
const danmakuText = ref('')
const danmakuColor = ref('#ffffff')
const danmakuMode = ref(1)
const sendingDanmaku = ref(false)
const senderInfo = ref(null)

// 评论区
const comments = ref({ items: [], total: 0, loading: false, error: '' })

// 弹幕设置：项名与默认值对齐原包播放器设置面板
const dm = ref({
  on: true,
  opacity: 1,
  fontSize: 22,
  speed: 1,
  area: 1,
  showMove: true,
  showTop: true,
  showBottom: true,
  shieldMove: false,
  shieldTop: false,
  shieldBottom: false,
  shieldSame: false,
  shieldColor: false,
  shieldSenior: false,
})

const danmakuList = ref([])
const activeDanmaku = ref([])
let pointer = 0
let lastTime = 0
let timer = null
let hideTimer = null
let seq = 0
const seenContent = new Map()
const rowBusy = new Array(12).fill(0)

const progressPercent = computed(() => (duration.value ? (currentTime.value / duration.value) * 100 : 0))
const timeText = computed(() => `${formatDuration(currentTime.value)} / ${formatDuration(duration.value)}`)
const maxRow = computed(() => Math.max(1, Math.round(10 * dm.value.area)))

function pokeControls() {
  showControls.value = true
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    if (!playing.value) return
    showControls.value = false
    showDanmakuPanel.value = false
  }, 3200)
}

function togglePlay() {
  const el = videoEl.value
  if (!el) return
  if (el.paused) el.play().catch(() => {})
  else el.pause()
}

function seekTo(event) {
  const bar = progressEl.value
  const el = videoEl.value
  if (!bar || !el || !duration.value) return
  const rect = bar.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  el.currentTime = ratio * duration.value
}

function toggleFullscreen() {
  const node = stageEl.value?.parentElement ?? document.documentElement
  if (!document.fullscreenElement) node.requestFullscreen?.().catch(() => {})
  else document.exitFullscreen?.().catch(() => {})
}

function setVolume(value) {
  const el = videoEl.value
  if (el) el.volume = Number(value)
}

async function load(bvid) {
  loading.value = true
  error.value = ''
  playUrl.value = ''
  detail.value = null
  playInfo.value = null
  qualityOptions.value = []
  danmakuList.value = []
  activeDanmaku.value = []
  comments.value = { items: [], total: 0, loading: false, error: '' }
  senderInfo.value = null
  pointer = 0
  lastTime = 0
  pendingSeek = 0
  seenContent.clear()
  rowBusy.fill(0)

  try {
    const info = await fetchVideo(bvid)
    detail.value = info
    await loadStream(0, true)
    // 相关推荐：需登录的接口拿不到时保留上一次结果
    fetchRelated(bvid)
      .then((list) => { if (list.length) recommends.value = list.slice(0, 8) })
      .catch(() => {})
    fetchDanmakuXml(info.cid)
      .then((list) => { danmakuList.value = list })
      .catch(() => {})
  } catch (e) {
    error.value = `播放失败：${e.message}`
  } finally {
    loading.value = false
  }
}

/** 拉取播放地址；qn 为 0 时用默认清晰度。切换清晰度会尽量保持当前进度 */
async function loadStream(qn = 0, reset = false) {
  const info = detail.value
  if (!info) return
  busy.value = 'stream'
  const keep = reset ? 0 : (videoEl.value?.currentTime ?? 0)
  try {
    const play = await fetchPlayUrl(props.bvid, info.cid, { qn: qn || 80, fnval: 0 })
    const direct = play.kind === 'durl' ? play.urls[0] : (play.videos?.[0]?.url ?? '')
    if (!direct) throw new Error('没有可用的播放地址')
    playInfo.value = play
    quality.value = play.quality ?? 0
    qualityOptions.value = play.formats ?? []
    playUrl.value = mediaUrl(direct)
    pendingSeek = keep
  } catch (e) {
    error.value = `播放失败：${e.message}`
  } finally {
    busy.value = ''
  }
}

function showToast(text) {
  toast.value = text
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = '' }, 2400)
}

async function switchQuality(option) {
  showQuality.value = false
  if (option.quality === quality.value) return
  await loadStream(option.quality)
  showToast(`已切换到 ${option.label || qualityLabel(option.quality)}`)
}

function setRate(value) {
  rate.value = value
  if (videoEl.value) videoEl.value.playbackRate = value
  showRate.value = false
}

function onVolume(value) {
  volume.value = Number(value)
  if (videoEl.value) {
    videoEl.value.volume = volume.value
    videoEl.value.muted = volume.value === 0
  }
  muted.value = volume.value === 0
}

function toggleMute() {
  const el = videoEl.value
  if (!el) return
  el.muted = !el.muted
  muted.value = el.muted
}

/** 画中画 */
async function togglePip() {
  const el = videoEl.value
  if (!el) return
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture()
    else await el.requestPictureInPicture()
  } catch (e) {
    showToast(`画中画不可用：${e.message}`)
  }
}

/** 截取当前帧并保存 */
async function snapshot() {
  const el = videoEl.value
  if (!el || !el.videoWidth) return showToast('画面尚未就绪')
  const canvas = document.createElement('canvas')
  canvas.width = el.videoWidth
  canvas.height = el.videoHeight
  const context = canvas.getContext('2d')
  context.drawImage(el, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/png')
  const ok = await api.saveData({ dataUrl, filename: `bilihub-${props.bvid}-${Math.floor(el.currentTime)}s.png` })
  showToast(ok ? '已保存截图' : '已取消保存')
}

// ---- 下载：视频 / 封面 / 弹幕 / 元数据 ----
async function downloadVideo() {
  const direct = playInfo.value?.kind === 'durl' ? playInfo.value.urls[0] : playInfo.value?.videos?.[0]?.url
  if (!direct) return showToast('没有可下载的直链')
  await api.createDownload({
    type: 'video',
    url: direct,
    title: detail.value?.title,
    filename: `${detail.value?.title || props.bvid}-${qualityLabel(quality.value)}.mp4`,
    bvid: props.bvid,
    cid: detail.value?.cid,
  })
  showToast('已加入下载队列')
}

async function downloadCover() {
  if (!detail.value?.cover) return
  await api.createDownload({ type: 'cover', url: detail.value.cover, title: `${detail.value.title}-封面`, filename: `${detail.value.title}-封面.jpg` })
  showToast('封面已加入下载队列')
}

async function downloadDanmaku() {
  if (!danmakuList.value.length) return showToast('弹幕尚未加载')
  const lines = danmakuList.value.map((item) => `${item.time.toFixed(2)},${item.mode},${item.fontSize},${item.color},${item.timestamp},0,${item.senderHash},${item.id}:${item.content}`)
  await api.createDownload({
    type: 'danmaku',
    url: `https://api.bilibili.com/x/v1/dm/list.so?oid=${detail.value?.cid}`,
    title: `${detail.value?.title}-弹幕`,
    filename: `${detail.value?.title}-弹幕.xml`,
    content: `<?xml version="1.0" encoding="UTF-8"?>\n<i>\n${lines.join('\n')}\n</i>\n`,
  })
  showToast('弹幕已保存')
}

async function downloadMetadata() {
  if (!detail.value) return
  await api.createDownload({
    type: 'metadata',
    url: `bilihub://metadata/${props.bvid}`,
    title: `${detail.value.title}-信息`,
    filename: `${detail.value.title}-info.json`,
    content: JSON.stringify({ ...detail.value, quality: quality.value, formats: qualityOptions.value }, null, 2),
  })
  showToast('视频信息已保存')
}

// ---- 弹幕发送 ----
async function submitDanmaku() {
  const text = danmakuText.value.trim()
  if (!text) return
  if (!user.value?.isLogin) return showToast('请先登录后再发送弹幕')
  const el = videoEl.value
  sendingDanmaku.value = true
  try {
    await sendDanmaku({
      bvid: props.bvid,
      cid: detail.value.cid,
      text,
      mode: danmakuMode.value,
      color: parseInt(danmakuColor.value.replace('#', ''), 16),
      fontSize: 25,
      progress: el?.currentTime ?? 0,
    })
    danmakuText.value = ''
    showToast('弹幕已发送')
  } catch (e) {
    showToast(e.message)
  } finally {
    sendingDanmaku.value = false
  }
}

/** 弹幕发送人查询 */
async function querySender(item) {
  if (!item?.hash) return
  senderInfo.value = { loading: true, content: item.content, hash: item.hash }
  const result = await lookupDanmakuSender({ cid: detail.value?.cid, danmaku: { senderHash: item.hash } })
  senderInfo.value = { ...result, content: item.content }
}

// ---- 评论区 ----
async function loadComments() {
  if (!detail.value || comments.value.loading) return
  comments.value = { ...comments.value, loading: true, error: '' }
  try {
    const page = await fetchComments({ bvid: props.bvid, cid: detail.value.cid })
    comments.value = { items: page.items, total: page.total, loading: false, error: '' }
  } catch (e) {
    comments.value = { items: [], total: 0, loading: false, error: e.message }
  }
}

watch(sideTab, (tab) => { if (tab === '评论' && !comments.value.items.length) loadComments() })

/** 弹幕筛选：类型开关 + 屏蔽规则，对齐原包设置项 */
function accept(item) {
  const s = dm.value
  if (item.mode === 1 && !s.showMove) return false
  if (item.mode === 5 && !s.showTop) return false
  if (item.mode === 4 && !s.showBottom) return false
  if (item.mode === 1 && s.shieldMove) return false
  if (item.mode === 5 && s.shieldTop) return false
  if (item.mode === 4 && s.shieldBottom) return false
  if (s.shieldColor && item.color !== 16777215) return false
  if (s.shieldSenior && item.fontSize > 25) return false
  if (s.shieldSame) {
    const count = (seenContent.get(item.content) ?? 0) + 1
    seenContent.set(item.content, count)
    if (count > 1) return false
  }
  return true
}

function allocateRow() {
  const limit = maxRow.value
  let best = 0
  for (let i = 0; i < limit; i++) {
    if (rowBusy[i] <= lastTime) { best = i; rowBusy[i] = lastTime + 3; return i }
    if (rowBusy[i] < rowBusy[best]) best = i
  }
  rowBusy[best] = lastTime + 3
  return best
}

function tick() {
  const el = videoEl.value
  if (!el) return
  const t = el.currentTime
  currentTime.value = t
  const list = danmakuList.value
  if (!dm.value.on) { lastTime = t; return }

  if (t < lastTime - 0.8 || t > lastTime + 1.6) {
    activeDanmaku.value = []
    pointer = 0
    rowBusy.fill(0)
    while (pointer < list.length && list[pointer].time < t - 0.2) pointer++
  }

  while (pointer < list.length && list[pointer].time <= t) {
    const item = list[pointer]
    if (item.time >= t - 0.35 && accept(item)) {
      const fixed = item.mode === 4 || item.mode === 5
      activeDanmaku.value.push({
        key: `${item.id}-${seq++}`,
        content: item.content,
        hash: item.senderHash,
        color: item.color === 16777215 ? '#ffffff' : `#${item.color.toString(16).padStart(6, '0')}`,
        fixed: item.mode === 5 ? 'top' : item.mode === 4 ? 'bottom' : '',
        row: fixed ? 0 : allocateRow(),
        duration: (9 + (item.content.length % 4)) / Math.max(0.4, dm.value.speed),
      })
      if (activeDanmaku.value.length > 80) activeDanmaku.value.splice(0, 16)
    }
    pointer++
  }
  lastTime = t
}

function onLoadedMetadata() {
  const el = videoEl.value
  if (!el) return
  duration.value = el.duration || 0
  el.volume = volume.value
  el.muted = muted.value
  el.playbackRate = rate.value
  // 切换清晰度后恢复到原来的观看进度
  if (pendingSeek > 0 && Number.isFinite(pendingSeek)) {
    el.currentTime = Math.min(pendingSeek, Math.max(0, (el.duration || pendingSeek) - 0.5))
    pendingSeek = 0
  }
  activeDanmaku.value = []
  pointer = 0
  lastTime = 0
  rowBusy.fill(0)
}

function onKey(event) {
  if (event.target instanceof HTMLInputElement) return
  if (event.code === 'Space') { event.preventDefault(); togglePlay() }
  else if (event.key === 'f') toggleFullscreen()
  else if (event.key === 'd') dm.value.on = !dm.value.on
  pokeControls()
}

function onFullscreenChange() { fullscreen.value = Boolean(document.fullscreenElement) }

onMounted(() => {
  load(props.bvid)
  timer = window.setInterval(tick, 100)
  window.addEventListener('keydown', onKey)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  pokeControls()
})

onBeforeUnmount(() => {
  window.clearInterval(timer)
  window.clearTimeout(hideTimer)
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})

watch(() => props.bvid, (bvid) => bvid && load(bvid))
</script>

<template>
  <div class="rp-player">
    <div class="rp-player-video">
      <div ref="stageEl" class="rp-player-stage" @mousemove="pokeControls">
        <video
          v-if="playUrl"
          ref="videoEl"
          class="rp-video"
          :src="playUrl"
          autoplay
          playsinline
          @loadedmetadata="onLoadedMetadata"
          @play="playing = true"
          @pause="playing = false"
          @click="togglePlay"
        ></video>
        <div v-else class="rp-player-placeholder">{{ loading ? '正在解析播放地址…' : error }}</div>

        <div v-if="dm.on" class="rp-danmaku-layer">
          <span
            v-for="item in activeDanmaku"
            :key="item.key"
            class="rp-danmaku"
            :class="{ fixed: item.fixed, bottom: item.fixed === 'bottom' }"
            :style="{
              top: item.fixed === 'bottom' ? 'auto' : `${4 + item.row * (76 / maxRow)}%`,
              color: item.color,
              fontSize: `${dm.fontSize}px`,
              opacity: dm.opacity,
              animationDuration: `${item.duration}s`,
            }"
            @click="querySender(item)"
          >{{ item.content }}</span>
        </div>

        <!-- 播放器控制层：尺寸与间距取自原包 bili_player_controller_half_screen -->
        <div v-show="showControls" class="rp-ctl">
          <div class="rp-ctl-top">
            <button class="rp-ctl-back" title="返回" @click="emit('close')">‹</button>
            <div class="rp-ctl-title">{{ detail?.title }}</div>
          </div>

          <div class="rp-ctl-bottom">
            <button class="rp-ctl-play" :title="playing ? '暂停' : '播放'" @click="togglePlay">
              <img :src="brand(playing ? 'player-pause.svg' : 'player-play.svg')" alt="播放" />
            </button>

            <div ref="progressEl" class="rp-ctl-seek" @click="seekTo">
              <div class="rp-ctl-seek-track"></div>
              <div class="rp-ctl-seek-played" :style="{ width: `${progressPercent}%` }"></div>
              <div class="rp-ctl-seek-thumb" :style="{ left: `${progressPercent}%` }"></div>
            </div>

            <div class="rp-ctl-time">{{ timeText }}</div>

            <button class="rp-ctl-icon" title="弹幕开关" @click="dm.on = !dm.on">
              <img :src="brand(dm.on ? 'player-danmaku-on.png' : 'player-danmaku-off.png')" alt="弹幕" />
            </button>
            <button class="rp-ctl-icon" title="弹幕设置" @click="showDanmakuPanel = !showDanmakuPanel">
              <img :src="brand('dm-setting.png')" alt="弹幕设置" />
            </button>
            <button class="rp-ctl-text" :title="'清晰度'" @click="showQuality = !showQuality; showRate = false">
              {{ qualityLabel(quality, qualityOptions.find((item) => item.quality === quality)?.label) || '清晰度' }}
            </button>
            <button class="rp-ctl-text" :class="{ on: rate !== 1 }" title="倍速" @click="showRate = !showRate; showQuality = false">{{ rate }}x</button>
            <button class="rp-ctl-icon" title="画中画" @click="togglePip">
              <img :src="brand('player-pip.svg')" alt="画中画" />
            </button>
            <button class="rp-ctl-icon" title="截图" @click="snapshot">
              <img :src="brand('player-shot.svg')" alt="截图" />
            </button>
            <button class="rp-ctl-icon" title="下载" @click="downloadVideo">
              <img :src="brand('player-download.svg')" alt="下载" />
            </button>
            <button class="rp-ctl-icon" title="全屏" @click="toggleFullscreen">
              <img :src="brand('player-right.svg')" alt="全屏" />
            </button>
          </div>

          <div v-if="showQuality" class="rp-ctl-menu" @click.stop>
            <button v-for="option in qualityOptions" :key="option.quality" :class="{ on: option.quality === quality }" @click="switchQuality(option)">
              {{ option.label || qualityLabel(option.quality) }}
            </button>
            <div v-if="!qualityOptions.length" class="rp-ctl-menu-empty">未获取到清晰度列表</div>
          </div>

          <div v-if="showRate" class="rp-ctl-menu rate" @click.stop>
            <button v-for="value in [2, 1.5, 1.25, 1, 0.75, 0.5]" :key="value" :class="{ on: value === rate }" @click="setRate(value)">{{ value }}x</button>
          </div>

          <div class="rp-dm-input-bar" @click.stop>
            <input v-model="danmakuText" type="text" maxlength="100" placeholder="发送弹幕，回车确认" @keydown.enter="submitDanmaku" />
            <input v-model="danmakuColor" type="color" title="弹幕颜色" />
            <select v-model.number="danmakuMode" title="弹幕类型">
              <option :value="1">滚动</option>
              <option :value="4">底部</option>
              <option :value="5">顶部</option>
            </select>
            <button :disabled="sendingDanmaku || !danmakuText.trim()" @click="submitDanmaku">{{ sendingDanmaku ? '发送中' : '发送' }}</button>
          </div>

          <div v-if="showDanmakuPanel" class="rp-dm-panel" @click.stop>
            <div class="rp-dm-group">
              <div class="rp-dm-label">弹幕类型</div>
              <div class="rp-dm-row">
                <button class="rp-dm-item" :class="{ on: dm.showMove }" @click="dm.showMove = !dm.showMove">
                  <img :src="brand('dm-mode-move.svg')" alt="滚动" /><span>滚动</span>
                </button>
                <button class="rp-dm-item" :class="{ on: dm.showTop }" @click="dm.showTop = !dm.showTop">
                  <img :src="brand('dm-mode-top.svg')" alt="顶部" /><span>顶部</span>
                </button>
                <button class="rp-dm-item" :class="{ on: dm.showBottom }" @click="dm.showBottom = !dm.showBottom">
                  <img :src="brand('dm-mode-bottom.svg')" alt="底部" /><span>底部</span>
                </button>
              </div>
            </div>

            <div class="rp-dm-group">
              <div class="rp-dm-label">屏蔽类型</div>
              <div class="rp-dm-row">
                <button class="rp-dm-item" :class="{ on: dm.shieldMove }" @click="dm.shieldMove = !dm.shieldMove">
                  <img :src="brand('dm-shield-move.svg')" alt="滚动" /><span>滚动</span>
                </button>
                <button class="rp-dm-item" :class="{ on: dm.shieldTop }" @click="dm.shieldTop = !dm.shieldTop">
                  <img :src="brand('dm-shield-top.svg')" alt="顶部" /><span>顶部</span>
                </button>
                <button class="rp-dm-item" :class="{ on: dm.shieldBottom }" @click="dm.shieldBottom = !dm.shieldBottom">
                  <img :src="brand('dm-shield-bottom.svg')" alt="底部" /><span>底部</span>
                </button>
                <button class="rp-dm-item" :class="{ on: dm.shieldSame }" @click="dm.shieldSame = !dm.shieldSame">
                  <img :src="brand('dm-shield-same.svg')" alt="重复" /><span>重复</span>
                </button>
                <button class="rp-dm-item" :class="{ on: dm.shieldColor }" @click="dm.shieldColor = !dm.shieldColor">
                  <img :src="brand('dm-shield-color.svg')" alt="彩色" /><span>彩色</span>
                </button>
                <button class="rp-dm-item" :class="{ on: dm.shieldSenior }" @click="dm.shieldSenior = !dm.shieldSenior">
                  <img :src="brand('dm-shield-senior.svg')" alt="高级" /><span>高级</span>
                </button>
              </div>
            </div>

            <div class="rp-dm-group">
              <div class="rp-dm-slider"><span>不透明度</span><input v-model.number="dm.opacity" type="range" min="0.1" max="1" step="0.05" /><em>{{ Math.round(dm.opacity * 100) }}%</em></div>
              <div class="rp-dm-slider"><span>显示区域</span><input v-model.number="dm.area" type="range" min="0.25" max="1" step="0.25" /><em>{{ Math.round(dm.area * 100) }}%</em></div>
              <div class="rp-dm-slider"><span>弹幕速度</span><input v-model.number="dm.speed" type="range" min="0.5" max="2" step="0.1" /><em>{{ dm.speed.toFixed(1) }}x</em></div>
              <div class="rp-dm-slider"><span>字号</span><input v-model.number="dm.fontSize" type="range" min="14" max="34" step="2" /><em>{{ dm.fontSize }}px</em></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <aside class="rp-player-side">
      <div class="rp-player-tabs">
        <button :class="{ on: sideTab === '简介' }" @click="sideTab = '简介'">简介</button>
        <button :class="{ on: sideTab === '评论' }" @click="sideTab = '评论'">评论 {{ detail ? formatCount(detail.stat.reply) : 0 }}</button>
        <button class="rp-player-close" @click="emit('close')">返回列表</button>
      </div>

      <template v-if="detail">
        <div class="rp-player-up">
          <div class="av"><img v-if="detail.owner.face" :src="mediaUrl(detail.owner.face)" :alt="detail.owner.name" /></div>
          <div class="who"><b>{{ detail.owner.name }}</b><small>{{ formatDuration(detail.duration) }} · {{ detail.pages.length }} P</small></div>
          <button class="rp-follow-btn">＋ 关注</button>
        </div>
        <div class="rp-player-title"><span class="grow">{{ detail.title }}</span></div>
        <div class="rp-player-meta">
          <span>▶ {{ formatCount(detail.stat.view) }}</span>
          <span>💬 {{ formatCount(detail.stat.danmaku) }}</span>
          <span>{{ formatDate(detail.pubdate) }}</span>
          <span class="rp-danmaku-toggle" :class="{ on: dm.on }" @click="dm.on = !dm.on">弹幕 {{ dm.on ? '开' : '关' }}</span>
        </div>
        <div class="rp-player-actions">
          <div class="rp-action"><span class="ic">赞</span>{{ formatCount(detail.stat.like) }}</div>
          <div class="rp-action"><span class="ic">币</span>{{ formatCount(detail.stat.coin) }}</div>
          <div class="rp-action"><span class="ic">藏</span>{{ formatCount(detail.stat.favorite) }}</div>
          <div class="rp-action"><span class="ic">享</span>{{ formatCount(detail.stat.share) }}</div>
        </div>
        <div class="rp-player-downloads">
          <button :disabled="busy === 'stream'" @click="downloadVideo">下载视频</button>
          <button @click="downloadCover">下载封面</button>
          <button @click="downloadDanmaku">下载弹幕</button>
          <button @click="downloadMetadata">导出信息</button>
        </div>
        <div v-if="sideTab === '简介'" class="rp-desc">{{ detail.desc || '暂无简介' }}</div>
        <div v-else-if="sideTab === '评论'" class="rp-comments">
          <div v-if="comments.loading" class="rp-comments-tip">正在加载评论…</div>
          <div v-else-if="comments.error" class="rp-comments-tip">
            {{ comments.error }}
            <button class="rp-comments-retry" @click="loadComments">重试</button>
          </div>
          <div v-else-if="!comments.items.length" class="rp-comments-tip">还没有评论</div>
          <template v-else>
            <div class="rp-comments-head">共 {{ formatCount(comments.total) }} 条评论</div>
            <div v-for="item in comments.items" :key="item.rpid" class="rp-comment">
              <img v-if="item.face" :src="mediaUrl(item.face)" :alt="item.user" loading="lazy" />
              <div class="rp-comment-body">
                <div class="rp-comment-who"><b>{{ item.user }}</b><span v-if="item.level">LV{{ item.level }}</span><em>{{ formatRelative(item.ctime) }}</em></div>
                <p>{{ item.content }}</p>
                <div class="rp-comment-meta"><span>赞 {{ item.like }}</span><span v-if="item.replyCount">回复 {{ item.replyCount }}</span><span v-if="item.location">{{ item.location }}</span></div>
                <div v-for="sub in item.subReplies" :key="sub.rpid" class="rp-comment-sub">
                  <b>{{ sub.user }}：</b>{{ sub.content }}
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>
      <div v-else class="rp-player-placeholder side">{{ loading ? '加载中…' : error }}</div>

      <div v-if="senderInfo" class="rp-sender" @click="senderInfo = null">
        <div class="rp-sender-card" @click.stop>
          <div class="rp-sender-head">弹幕发送人</div>
          <div class="rp-sender-content">「{{ senderInfo.content }}」</div>
          <div v-if="senderInfo.loading" class="rp-sender-tip">查询中…</div>
          <template v-else-if="senderInfo.resolved">
            <div class="rp-sender-user">
              <img v-if="senderInfo.user?.face" :src="mediaUrl(senderInfo.user.face)" :alt="senderInfo.user.name" />
              <div><b>{{ senderInfo.user.name }}</b><small>UID {{ senderInfo.user.mid }}</small></div>
            </div>
            <button class="rp-sender-open" @click="api.openBilibili(`https://space.bilibili.com/${senderInfo.user.mid}`)">打开空间</button>
          </template>
          <div v-else class="rp-sender-tip">
            {{ senderInfo.hint }}<br />
            <code>{{ senderInfo.hash }}</code>
          </div>
        </div>
      </div>

      <div v-if="toast" class="rp-toast">{{ toast }}</div>

      <div class="rp-rec">
        <h5>推荐视频</h5>
        <div v-for="item in recommends" :key="item.bvid" class="rp-rec-item" @click="emit('play', item)">
          <div class="rp-rec-cover">
            <img :src="mediaUrl(item.cover)" :alt="item.title" loading="lazy" />
            <span>{{ formatDuration(item.duration) }}</span>
          </div>
          <div class="rp-rec-body">
            <h6>{{ item.title }}</h6>
            <div class="row"><span>{{ item.owner }}</span><span>▶ {{ formatCount(item.view) }}</span><span>💬 {{ formatCount(item.danmaku) }}</span></div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

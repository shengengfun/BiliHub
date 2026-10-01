<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fetchDanmakuXml, fetchPlayUrl, fetchPopular, fetchVideo, formatCount, formatDate, formatDuration, mediaUrl } from '../bili.js'
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
  danmakuList.value = []
  activeDanmaku.value = []
  pointer = 0
  lastTime = 0
  seenContent.clear()
  rowBusy.fill(0)

  try {
    const info = await fetchVideo(bvid)
    detail.value = info
    const play = await fetchPlayUrl(bvid, info.cid, 0)
    const direct = play.kind === 'durl' ? play.urls[0] : (play.videos?.[0]?.url ?? '')
    if (!direct) throw new Error('没有可用的播放地址')
    playUrl.value = mediaUrl(direct)
    fetchPopular(10).then((list) => { recommends.value = list.filter((item) => item.bvid !== bvid).slice(0, 6) }).catch(() => {})
    fetchDanmakuXml(info.cid).then((list) => { danmakuList.value = list }).catch(() => {})
  } catch (e) {
    error.value = `播放失败：${e.message}`
  } finally {
    loading.value = false
  }
}

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
  el.volume = 0.8
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
            <button class="rp-ctl-icon" title="全屏" @click="toggleFullscreen">
              <img :src="brand('player-right.svg')" alt="全屏" />
            </button>
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
          <div class="rp-action"><span class="ic">踩</span>不喜欢</div>
          <div class="rp-action"><span class="ic">币</span>{{ formatCount(detail.stat.coin) }}</div>
          <div class="rp-action"><span class="ic">藏</span>{{ formatCount(detail.stat.favorite) }}</div>
          <div class="rp-action"><span class="ic">享</span>{{ formatCount(detail.stat.share) }}</div>
        </div>
        <div v-if="sideTab === '简介'" class="rp-desc">{{ detail.desc || '暂无简介' }}</div>
      </template>
      <div v-else class="rp-player-placeholder side">{{ loading ? '加载中…' : error }}</div>

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

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  fetchDanmakuXml,
  fetchPlayUrl,
  fetchPopular,
  fetchVideo,
  formatCount,
  formatDate,
  formatDuration,
  mediaUrl,
} from '../bili.js'

const props = defineProps({ bvid: { type: String, required: true } })
const emit = defineEmits(['close', 'play'])

const sideTab = ref('简介')
const detail = ref(null)
const playUrl = ref('')
const error = ref('')
const loading = ref(true)
const recommends = ref([])
const videoEl = ref(null)
const danmakuOn = ref(true)

// 弹幕渲染状态
const danmakuList = ref([])
const activeDanmaku = ref([])
let pointer = 0
let lastTime = 0
let timer = null
let rowSeed = 0

const isPortrait = computed(() => {
  const el = videoEl.value
  return el && el.videoHeight > el.videoWidth
})

async function load(bvid) {
  loading.value = true
  error.value = ''
  playUrl.value = ''
  detail.value = null
  danmakuList.value = []
  activeDanmaku.value = []
  pointer = 0
  lastTime = 0

  try {
    const info = await fetchVideo(bvid)
    detail.value = info

    // durl 直链（低清无需登录）优先，失败再尝试 DASH
    const play = await fetchPlayUrl(bvid, info.cid, 0)
    const direct = play.kind === 'durl' ? play.urls[0] : (play.videos?.[0]?.url ?? '')
    if (!direct) throw new Error('没有可用的播放地址')
    playUrl.value = mediaUrl(direct)

    fetchPopular(8).then((list) => { recommends.value = list.filter((item) => item.bvid !== bvid).slice(0, 5) }).catch(() => {})
    fetchDanmakuXml(info.cid).then((list) => { danmakuList.value = list }).catch(() => {})
  } catch (e) {
    error.value = `播放失败：${e.message}`
  } finally {
    loading.value = false
  }
}

function resetDanmaku() {
  pointer = 0
  lastTime = 0
  activeDanmaku.value = []
}

function tick() {
  const el = videoEl.value
  if (!el || !danmakuOn.value) return
  const t = el.currentTime
  const list = danmakuList.value

  // 拖动进度条后重置
  if (t < lastTime - 0.8 || t > lastTime + 1.6) {
    activeDanmaku.value = []
    pointer = 0
    while (pointer < list.length && list[pointer].time < t - 0.2) pointer++
  }

  while (pointer < list.length && list[pointer].time <= t) {
    const item = list[pointer]
    if (item.time >= t - 0.35 && item.mode !== 4 && item.mode !== 5) {
      activeDanmaku.value.push({
        key: `${item.id}-${rowSeed++}`,
        content: item.content,
        color: item.color === 16777215 ? '#ffffff' : `#${item.color.toString(16).padStart(6, '0')}`,
        row: rowSeed % 9,
        duration: 8 + (item.content.length % 4),
      })
      if (activeDanmaku.value.length > 60) activeDanmaku.value.splice(0, 10)
    }
    pointer++
  }
  lastTime = t
}

function onLoadedMetadata() {
  const el = videoEl.value
  if (!el) return
  el.volume = 0.8
  resetDanmaku()
}

onMounted(() => {
  load(props.bvid)
  timer = window.setInterval(tick, 120)
})

onBeforeUnmount(() => window.clearInterval(timer))
watch(() => props.bvid, (bvid) => bvid && load(bvid))
</script>

<template>
  <div class="rp-player">
    <div class="rp-player-video">
      <div class="rp-player-stage" :class="{ portrait: isPortrait }">
        <video
          v-if="playUrl"
          ref="videoEl"
          class="rp-video"
          :src="playUrl"
          controls
          autoplay
          playsinline
          @loadedmetadata="onLoadedMetadata"
        ></video>
        <div v-else class="rp-player-placeholder">{{ loading ? '正在解析播放地址…' : error }}</div>

        <div v-if="danmakuOn" class="rp-danmaku-layer">
          <span
            v-for="item in activeDanmaku"
            :key="item.key"
            class="rp-danmaku"
            :style="{ top: `${6 + item.row * 9}%`, color: item.color, animationDuration: `${item.duration}s` }"
          >{{ item.content }}</span>
        </div>

        <div v-if="detail" class="rp-player-watermark">{{ detail.owner.name }} &nbsp;bilibili</div>
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
          <div class="av" :style="detail.owner.face ? {} : {}">
            <img v-if="detail.owner.face" :src="mediaUrl(detail.owner.face)" :alt="detail.owner.name" />
          </div>
          <div class="who">
            <b>{{ detail.owner.name }}</b>
            <small>{{ formatDuration(detail.duration) }} · {{ detail.pages.length }} P</small>
          </div>
          <button class="rp-follow-btn">＋ 关注</button>
        </div>

        <div class="rp-player-title"><span class="grow">{{ detail.title }}</span></div>
        <div class="rp-player-meta">
          <span>▶ {{ formatCount(detail.stat.view) }}</span>
          <span>💬 {{ formatCount(detail.stat.danmaku) }}</span>
          <span>{{ formatDate(detail.pubdate) }}</span>
          <span class="rp-danmaku-toggle" :class="{ on: danmakuOn }" @click="danmakuOn = !danmakuOn">弹幕 {{ danmakuOn ? '开' : '关' }}</span>
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
            <div class="row">
              <span>{{ item.owner }}</span>
              <span>▶ {{ formatCount(item.view) }}</span>
              <span>💬 {{ formatCount(item.danmaku) }}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api } from '../api.js'

const state = ref({ items: [], stats: {} })
const dir = ref('')
let timer
let unsubscribe = () => {}

const items = computed(() => state.value.items ?? [])
const stats = computed(() => state.value.stats ?? {})

const TYPE_LABEL = { video: '视频', cover: '封面', danmaku: '弹幕', metadata: '元数据' }
const STATUS_LABEL = { pending: '排队中', running: '下载中', paused: '已暂停', done: '已完成', error: '失败', canceled: '已取消' }

function humanSize(bytes) {
  const value = Number(bytes) || 0
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`
  if (value >= 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${value} B`
}

function speedText(value) {
  return value > 0 ? `${humanSize(value)}/s` : ''
}

async function refresh() {
  state.value = await api.listDownloads()
}

async function init() {
  await refresh()
  dir.value = await api.downloadsDir()
  // 主进程推送进度，避免高频轮询
  unsubscribe = api.onDownloadsChanged((payload) => {
    if (payload?.items) state.value = payload
  })
  timer = window.setInterval(refresh, 2000)
}

onMounted(init)
onUnmounted(() => {
  window.clearInterval(timer)
  unsubscribe()
})
</script>

<template>
  <h2 class="section-title">下载管理 <span class="count">{{ items.length }} 个任务</span></h2>
  <p class="section-desc">
    下载由主进程代理：支持多任务队列、断点续传（HTTP Range）、暂停 / 继续 / 取消。
    <template v-if="dir">保存目录：<code>{{ dir }}</code></template>
  </p>

  <div class="dl-stats">
    <span>进行中 {{ stats.running ?? 0 }}</span>
    <span>等待 / 暂停 {{ stats.paused ?? 0 }}</span>
    <span>已完成 {{ stats.done ?? 0 }}</span>
    <span>失败 {{ stats.error ?? 0 }}</span>
    <span v-if="stats.speed">总速度 {{ speedText(stats.speed) }}</span>
    <button class="action" @click="api.openDownloadFolder()">打开下载目录</button>
  </div>

  <div v-if="!items.length" class="empty">暂无下载任务。在播放页点击「下载视频 / 封面 / 弹幕」即可加入队列。</div>

  <div v-else>
    <div v-for="item in items" :key="item.id" class="row">
      <div class="row-main">
        <h4>{{ item.filename || item.title }}</h4>
        <small>
          {{ TYPE_LABEL[item.type] ?? item.type }} ·
          {{ STATUS_LABEL[item.status] ?? item.status }} ·
          {{ item.percent }}%
          <template v-if="item.total">（{{ humanSize(item.received) }} / {{ humanSize(item.total) }}）</template>
          <template v-if="item.speed"> · {{ speedText(item.speed) }}</template>
          <template v-if="item.error"> · {{ item.error }}</template>
        </small>
        <div class="bar"><i :style="{ width: `${item.percent}%` }"></i></div>
      </div>
      <button v-if="item.status === 'running' || item.status === 'pending'" class="action" @click="api.pauseDownload(item.id)">暂停</button>
      <button v-else-if="item.status === 'paused' || item.status === 'error'" class="action" @click="api.resumeDownload(item.id)">继续</button>
      <button v-if="item.status === 'done'" class="action" @click="api.openDownloadFolder(item.id)">打开位置</button>
      <button v-if="item.status === 'done' || item.status === 'canceled'" class="action" @click="api.removeDownload(item.id)">移除记录</button>
      <button v-else class="action" @click="api.cancelDownload(item.id)">取消</button>
    </div>
  </div>
</template>

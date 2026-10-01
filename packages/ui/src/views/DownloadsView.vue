<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api } from '../api.js'

const state = ref({ items: [], stats: {} })
let timer

const items = computed(() => state.value.items ?? [])

async function refresh() { state.value = await api.listDownloads() }

const label = { video: '视频', cover: '封面', danmaku: '弹幕', metadata: '元数据' }

onMounted(() => { refresh(); timer = window.setInterval(refresh, 800) })
onUnmounted(() => window.clearInterval(timer))
</script>

<template>
  <h2 class="section-title">下载管理 <span class="count">{{ items.length }} 个任务</span></h2>
  <p class="section-desc">下载由主进程代理，支持暂停、继续和取消。</p>

  <div v-if="!items.length" class="empty">暂无下载任务。在 B 站页面使用下载入口即可加入队列。</div>
  <div v-else>
    <div v-for="item in items" :key="item.id" class="row">
      <div class="row-main">
        <h4>{{ item.filename || item.title }}</h4>
        <small>{{ label[item.kind] ?? item.kind }} · {{ item.progress }}%<template v-if="item.error"> · {{ item.error }}</template></small>
        <div class="bar"><i :style="{ width: `${item.progress}%` }"></i></div>
      </div>
      <span class="status" :class="item.status">{{ item.status }}</span>
      <button v-if="item.status === 'downloading'" class="action" @click="api.pauseDownload(item.id)">暂停</button>
      <button v-else-if="item.status === 'paused'" class="action" @click="api.resumeDownload(item.id)">继续</button>
      <button class="action" @click="api.cancelDownload(item.id)">取消</button>
    </div>
  </div>
</template>

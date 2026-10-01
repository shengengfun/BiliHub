<script setup>
import { onMounted, ref, watch } from 'vue'
import { fetchPopular, fetchRanking, formatCount, formatDuration, mediaUrl } from '../bili.js'
import { brand } from '../brand.js'
import { navTabs, topIcons } from '../mock.js'

const emit = defineEmits(['play'])

// 标签 → 真实接口：推荐走热门流，其余走对应分区排行榜
const TAB_SOURCE = {
  推荐: { type: 'popular' },
  热门: { type: 'ranking', rid: 0 },
  影视: { type: 'ranking', rid: 181 },
  追番: { type: 'ranking', rid: 13 },
  直播: { type: 'ranking', rid: 0 },
}

const activeTab = ref('推荐')
const keyword = ref('')
const videos = ref([])
const loading = ref(true)
const error = ref('')

async function load(tab) {
  loading.value = true
  error.value = ''
  try {
    const source = TAB_SOURCE[tab] ?? TAB_SOURCE['推荐']
    videos.value = source.type === 'popular' ? await fetchPopular(24) : await fetchRanking(24, source.rid)
  } catch (e) {
    error.value = `加载失败：${e.message}`
    videos.value = []
  } finally {
    loading.value = false
  }
}

function search() {
  const text = keyword.value.trim()
  if (!text) return load(activeTab.value)
  window.open(`https://search.bilibili.com/all?keyword=${encodeURIComponent(text)}`, '_blank')
}

onMounted(() => load(activeTab.value))
watch(activeTab, (tab) => load(tab))
</script>

<template>
  <header class="rp-top">
    <img class="rp-avatar" :src="brand('ic-avatar.png')" alt="头像" />
    <label class="rp-search">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input v-model="keyword" placeholder="搜索视频、UP主" @keyup.enter="search" />
    </label>
    <nav class="rp-tabs">
      <button v-for="tab in navTabs" :key="tab" :class="{ on: activeTab === tab }" @click="activeTab = tab">{{ tab }}</button>
    </nav>
    <div class="rp-top-icons">
      <img v-for="icon in topIcons" :key="icon" :src="brand(`${icon}.png`)" :alt="icon" />
    </div>
  </header>

  <div class="rp-content">
    <div v-if="loading" class="rp-state">正在加载「{{ activeTab }}」…</div>
    <div v-else-if="error" class="rp-state rp-state-error">{{ error }}</div>
    <div v-else-if="!videos.length" class="rp-state">暂时没有内容</div>
    <div v-else class="rp-feed">
      <article v-for="item in videos" :key="item.bvid" class="rp-card" @click="emit('play', item)">
        <div class="rp-cover">
          <img class="rp-cover-img" :src="mediaUrl(item.cover)" :alt="item.title" loading="lazy" />
          <div class="rp-cover-meta">
            <span>▶ {{ formatCount(item.view) }}</span>
            <span>💬 {{ formatCount(item.danmaku) }}</span>
            <span class="grow"></span>
            <span>{{ formatDuration(item.duration) }}</span>
          </div>
        </div>
        <div class="rp-card-body">
          <h3 class="rp-title">{{ item.title }}</h3>
          <div class="rp-card-foot">
            <span v-if="item.like > 1000" class="rp-like">{{ formatCount(item.like) }}点赞</span>
            <span class="up"><span class="rp-lv">UP</span>{{ item.owner }}</span>
            <span class="rp-more">⋯</span>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

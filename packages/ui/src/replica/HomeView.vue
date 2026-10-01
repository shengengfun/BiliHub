<script setup>
import { onMounted, ref, watch } from 'vue'
import { fetchPopular, fetchRanking, formatCount, formatDuration, mediaUrl } from '../bili.js'
import { brand } from '../brand.js'
import { topIcons } from '../mock.js'
import { user, login, refreshUser, authSupported, startUserSync } from '../user.js'

const emit = defineEmits(['play'])
const toast = ref('')

/**
 * 标签与接口对应关系。原包首页标签为 直播/推荐/热门/追番/影视，
 * 这里用公开排行榜接口提供各分区内容（无需登录）。
 */
const TAB_SOURCE = {
  直播: { type: 'ranking', rid: 0 },
  推荐: { type: 'popular' },
  热门: { type: 'ranking', rid: 0 },
  追番: { type: 'ranking', rid: 13 },
  影视: { type: 'ranking', rid: 181 },
}
// 原包标签顺序：直播 / 推荐 / 热门 / 追番 / 影视
const navTabs = ['直播', '推荐', '热门', '追番', '影视']

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

function notify(message) {
  toast.value = message
  window.clearTimeout(notify.timer)
  notify.timer = window.setTimeout(() => { toast.value = '' }, 2600)
}

/** 未登录时点击头像发起登录（依赖桌面客户端的持久会话） */
async function onAvatar() {
  if (user.value.isLogin) return
  if (!authSupported) {
    notify('登录需要在 BiliHub 桌面客户端中进行')
    return
  }
  notify('已打开登录窗口，请在窗口中完成登录')
  const result = await login()
  notify(result?.isLogin ? `欢迎回来，${result.name}` : '未完成登录')
}

onMounted(() => {
  load(activeTab.value)
  refreshUser()
  startUserSync()
})
watch(activeTab, (tab) => load(tab))
</script>

<template>
  <header class="rp-top">
    <button class="rp-avatar-btn" title="账号" @click="onAvatar">
      <img
        class="rp-avatar"
        :src="user.isLogin && user.face ? mediaUrl(user.face) : brand('ic-avatar.png')"
        :alt="user.isLogin ? user.name : '未登录'"
      />
    </button>
    <label class="rp-search">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" stroke-linecap="round" /></svg>
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
            <span class="rp-cover-stat">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 3.5 20.5 12 4 20.5z" /></svg>{{ formatCount(item.view) }}
            </span>
            <span class="rp-cover-stat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M20 12.5c0 3.6-3.6 6.5-8 6.5-1 0-2-.15-2.9-.42L4.5 20l1.2-3.3C4.6 15.6 4 14.1 4 12.5 4 8.9 7.6 6 12 6s8 2.9 8 6.5z" /></svg>{{ formatCount(item.danmaku) }}
            </span>
            <span class="grow"></span>
            <span>{{ formatDuration(item.duration) }}</span>
          </div>
        </div>
        <div class="rp-card-body">
          <h3 class="rp-title">{{ item.title }}</h3>
          <div class="rp-card-foot">
            <span v-if="item.like >= 1000" class="rp-like">{{ formatCount(item.like) }}点赞</span>
            <span class="up">
              <span class="rp-up-badge">UP</span>
              <span>{{ item.owner }}</span>
            </span>
            <span class="rp-more">⋮</span>
          </div>
        </div>
      </article>
    </div>
  </div>

  <div v-if="toast" class="rp-toast">{{ toast }}</div>
</template>

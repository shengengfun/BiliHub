<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fetchHotWords, fetchPlayUrl, fetchPopular, fetchRanking, fetchVideo, formatCount, formatDuration, formatShort, mediaUrl } from '../bili.js'
import { brand } from '../brand.js'
import { fallbackHotWords, topIcons } from '../mock.js'
import { user, login, refreshUser, authSupported, startUserSync } from '../user.js'
import { api } from '../api.js'
import { openMenu } from '../context-menu.js'
import UserAvatar from './UserAvatar.vue'

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

// 搜索框占位词：原包轮播实时热搜词
const hotWords = ref([...fallbackHotWords])
const hotIndex = ref(0)
let hotTimer = null

async function loadHotWords() {
  try {
    const list = await fetchHotWords()
    if (list.length) {
      hotWords.value = list
      hotIndex.value = 0
    }
  } catch {
    /* 取不到就沿用兜底文案 */
  }
}

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

const videoUrl = (bvid) => `https://www.bilibili.com/video/${bvid}`

/** 桌面语义：Ctrl/⌘ + 点击在新窗口打开；Enter 等同单击 */
function onCardClick(event, item) {
  if (event.ctrlKey || event.metaKey) {
    api.openBilibili(videoUrl(item.bvid))
    return
  }
  emit('play', item)
}

/** 返回顶部（Home）与卡片聚焦时 Ctrl+C 复制链接；刷新由 Replica.vue 统一派发 */
function onKeyNav(event) {
  if (event.key === 'Home' && !event.ctrlKey) {
    document.querySelector('.rp-content')?.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
    const focused = document.activeElement
    const bvid = focused?.dataset?.bvid
    const item = videos.value.find((video) => video.bvid === bvid)
    if (!item) return
    event.preventDefault()
    copy(videoUrl(item.bvid), '链接已复制')
  }
}

/** 桌面端右键菜单：不改动原包外观，但把常用操作从「多点一步」变成「一点」 */
function onCardContext(event, item) {
  openMenu(event, [
    { label: '播放', action: () => emit('play', item) },
    { label: '在浏览器中打开', action: () => api.openBilibili(videoUrl(item.bvid)) },
    { label: '复制视频链接', action: () => copy(videoUrl(item.bvid), '链接已复制') },
    { label: '复制标题', action: () => copy(item.title, '标题已复制') },
    { divider: true },
    { label: '下载视频', action: () => downloadVideo(item) },
    { label: '下载封面', action: () => downloadCover(item) },
    { divider: true },
    { label: '不感兴趣', danger: true, action: () => {
      videos.value = videos.value.filter((video) => video.bvid !== item.bvid)
      notify('已减少此类内容推荐')
    } },
  ])
}

async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text)
    notify(message)
  } catch {
    notify(text)
  }
}

async function downloadVideo(item) {
  notify('正在解析下载地址…')
  try {
    const play = await fetchPlayUrl(item.bvid, (await fetchVideo(item.bvid)).cid, { qn: 80, fnval: 0 })
    const direct = play.kind === 'durl' ? play.urls[0] : play.videos?.[0]?.url
    if (!direct) throw new Error('没有可用的下载直链')
    await api.createDownload({ type: 'video', url: direct, title: item.title, filename: `${item.title}.mp4`, bvid: item.bvid })
    notify('已加入下载队列')
  } catch (e) {
    notify(`下载失败：${e.message}`)
  }
}

async function downloadCover(item) {
  if (!item.cover) return
  await api.createDownload({ type: 'cover', url: item.cover, title: `${item.title}-封面`, filename: `${item.title}-封面.jpg` })
  notify('封面已加入下载队列')
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
  loadHotWords()
  hotTimer = window.setInterval(() => {
    hotIndex.value = (hotIndex.value + 1) % hotWords.value.length
  }, 4000)
  window.addEventListener('keydown', onKeyNav)
  window.addEventListener('bilihub:refresh', reload)
})

/** 下拉刷新在桌面没有等价手势，用 F5 并配一个可见按钮作为发现入口 */
function reload() {
  load(activeTab.value)
  loadHotWords()
  notify(`已刷新「${activeTab.value}」`)
}onBeforeUnmount(() => {
  window.clearInterval(hotTimer)
  window.removeEventListener('keydown', onKeyNav)
  window.removeEventListener('bilihub:refresh', reload)
})
watch(activeTab, (tab) => load(tab))
</script>

<template>
  <header class="rp-top">
    <button class="rp-avatar-btn" title="账号" @click="onAvatar">
      <UserAvatar
        :src="user.isLogin ? user.face : ''"
        :pendant="user.isLogin ? user.pendant : null"
        :vip-icon="user.isLogin ? user.avatarIcon : ''"
        :guest="!user.isLogin"
        :size="39"
      />
    </button>
    <label class="rp-search">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" stroke-linecap="round" /></svg>
      <input v-model="keyword" :placeholder="hotWords[hotIndex]" @keyup.enter="search" />
    </label>
    <nav class="rp-tabs">
      <button v-for="tab in navTabs" :key="tab" :class="{ on: activeTab === tab }" @click="activeTab = tab">{{ tab }}</button>
    </nav>
    <div class="rp-top-icons">
      <button class="rp-icon-btn" title="刷新（F5）" @click="reload">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4.5V11h-6.2" /></svg>
      </button>
      <img v-for="icon in topIcons" :key="icon" :src="brand(`${icon}.png`)" :alt="icon" />
    </div>
  </header>

  <div class="rp-content">
    <div v-if="loading" class="rp-state">正在加载「{{ activeTab }}」…</div>
    <div v-else-if="error" class="rp-state rp-state-error">{{ error }}</div>
    <div v-else-if="!videos.length" class="rp-state">暂时没有内容</div>
    <div v-else class="rp-feed">
      <article
        v-for="item in videos"
        :key="item.bvid"
        class="rp-card"
        tabindex="0"
        :data-bvid="item.bvid"
        @click="onCardClick($event, item)"
        @keydown.enter.prevent="emit('play', item)"
        @contextmenu="onCardContext($event, item)"
      >
        <div class="rp-cover">
          <img class="rp-cover-img" :src="mediaUrl(item.cover)" :alt="item.title" loading="lazy" />
          <div class="rp-cover-play">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3.5 21 12 6 20.5z" /></svg>
          </div>
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
            <span v-if="item.like >= 1000" class="rp-like">{{ formatShort(item.like) }}点赞</span>
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

<script setup>
import { computed, onMounted, ref } from 'vue'
import { fetchDynamicFeed, formatCount, formatRelative, mediaUrl } from '../bili.js'
import { api } from '../api.js'

// 动态流是 WBI 接口：按 guide.md 约定不自行实现签名，
// 而是通过捕获真实页面（t.bilibili.com）自身发出的请求获取数据。
defineEmits(['play'])

const posts = ref([])
const loading = ref(true)
const error = ref('')
const activeTop = ref('综合')
const activeUser = ref('全部动态')

const authors = computed(() => {
  const map = new Map()
  for (const post of posts.value) {
    if (!post.author.mid) continue
    if (!map.has(post.author.mid)) map.set(post.author.mid, post.author)
  }
  return [...map.values()].slice(0, 14)
})

const visible = computed(() => {
  let list = posts.value
  if (activeTop.value === '视频') list = list.filter((post) => post.type === 'video')
  if (activeUser.value !== '全部动态') list = list.filter((post) => post.author.name === activeUser.value)
  return list
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    posts.value = await fetchDynamicFeed()
    if (!posts.value.length) error.value = '动态列表为空'
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

/** 打开动态原页面，顺带刷新捕获缓存 */
function openSource(post) {
  if (post.bvid) return
  api.openBilibili('https://t.bilibili.com/')
}

onMounted(load)
</script>

<template>
  <header class="rp-dyn-top">
    <nav class="rp-dyn-tabs">
      <button :class="{ on: activeTop === '视频' }" @click="activeTop = '视频'">视频</button>
      <button :class="{ on: activeTop === '综合' }" @click="activeTop = '综合'">综合</button>
    </nav>
    <div class="rp-dyn-actions">
      <button class="rp-dyn-reload" :disabled="loading" @click="load">{{ loading ? '加载中' : '刷新' }}</button>
      <button class="rp-dyn-edit" title="发布动态" @click="api.openBilibili('https://t.bilibili.com/')">
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M14 6l4 4" /></svg>
      </button>
    </div>
  </header>

  <div class="rp-content rp-dyn-body">
    <aside class="rp-dyn-users">
      <div class="rp-dyn-user" :class="{ on: activeUser === '全部动态' }" @click="activeUser = '全部动态'">
        <div class="av all">全</div>
        <span>全部动态</span>
      </div>
      <div
        v-for="user in authors"
        :key="user.mid"
        class="rp-dyn-user"
        :class="{ on: activeUser === user.name }"
        @click="activeUser = user.name"
      >
        <div class="av">
          <img v-if="user.face" :src="mediaUrl(user.face)" :alt="user.name" loading="lazy" />
        </div>
        <span>{{ user.name }}</span>
      </div>
    </aside>

    <section class="rp-dyn-feed">
      <div v-if="loading" class="rp-dyn-tip">正在通过页面请求获取动态…</div>
      <div v-else-if="error" class="rp-dyn-tip">
        {{ error }}
        <button class="rp-dyn-retry" @click="load">重试</button>
      </div>
      <div v-else-if="!visible.length" class="rp-dyn-tip">没有符合条件的动态</div>

      <article v-for="post in visible" :key="post.id" class="rp-post">
        <div class="rp-post-head">
          <div class="av">
            <img v-if="post.author.face" :src="mediaUrl(post.author.face)" :alt="post.author.name" loading="lazy" />
          </div>
          <div class="who">
            <b>{{ post.author.name }}</b>
            <small>{{ post.pubText || formatRelative(post.pubTime) }}</small>
          </div>
          <span class="rp-more" title="在浏览器中打开" @click="openSource(post)">⋯</span>
        </div>

        <p v-if="post.text" class="rp-post-text">{{ post.text }}</p>

        <div v-if="post.type === 'video'" class="rp-dyn-video" @click="$emit('play', { bvid: post.bvid })">
          <div class="cover">
            <img :src="mediaUrl(post.cover)" :alt="post.title" loading="lazy" />
            <span v-if="post.duration">{{ post.duration }}</span>
          </div>
          <div class="info">
            <h4>{{ post.title }}</h4>
            <p v-if="post.description">{{ post.description }}</p>
          </div>
        </div>

        <div v-else-if="post.cover" class="rp-dyn-image">
          <img :src="mediaUrl(post.cover)" :alt="post.title || '动态图片'" loading="lazy" />
        </div>

        <div class="rp-dyn-stat">
          <span>转发 {{ formatCount(post.stat.forward) }}</span>
          <span>评论 {{ formatCount(post.stat.comment) }}</span>
          <span>赞 {{ formatCount(post.stat.like) }}</span>
        </div>
      </article>
    </section>
  </div>
</template>

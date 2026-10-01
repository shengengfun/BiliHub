<script setup>
import { ref } from 'vue'
import { feedVideos, navTabs, topIcons } from '../mock.js'
import { brand } from '../brand.js'

const activeTab = ref('推荐')
const keyword = ref('楚汉传奇吐槽')
</script>

<template>
  <header class="rp-top">
    <img class="rp-avatar" :src="brand('ic-avatar.png')" alt="头像" />
    <label class="rp-search">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input v-model="keyword" placeholder="搜索视频、UP主" />
    </label>
    <nav class="rp-tabs">
      <button v-for="tab in navTabs" :key="tab" :class="{ on: activeTab === tab }" @click="activeTab = tab">{{ tab }}</button>
    </nav>
    <div class="rp-top-icons">
      <img v-for="icon in topIcons" :key="icon" :src="brand(`${icon}.png`)" :alt="icon" />
    </div>
  </header>

  <div class="rp-content">
    <div class="rp-feed">
      <article v-for="(item, index) in feedVideos" :key="index" class="rp-card">
        <div class="rp-cover" :class="`t${item.tone}`">
          <span v-if="item.tone === 2" class="rp-cover-top">talongames:鹦鸦电竞</span>
          <span v-else-if="item.tone === 3" class="rp-cover-top">НОВЫЕ ТИКТОКИ ОТ МОНЕСИ!</span>
          <span v-else-if="item.tone === 4" class="rp-cover-top">▲ 排位赛 - 空降地点</span>
          <span v-if="item.tone === 2 || item.tone === 4" class="rp-gif">GIF</span>
          <span v-if="item.tone === 2" class="rp-cover-badge">已读</span>
          <div class="rp-cover-meta">
            <span>▶ {{ item.play }}</span>
            <span>💬 {{ item.danmaku }}</span>
            <span class="grow"></span>
            <span>{{ item.duration }}</span>
          </div>
        </div>
        <div class="rp-card-body">
          <h3 class="rp-title">{{ item.title }}</h3>
          <div class="rp-card-foot">
            <span v-if="item.badge" class="rp-like">{{ item.badge }}</span>
            <span v-if="item.following" class="rp-following">已关注</span>
            <span class="up"><span class="rp-lv">UP</span>{{ item.up }}</span>
            <span class="rp-more">⋯</span>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

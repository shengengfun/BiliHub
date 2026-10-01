<script setup>
import { ref } from 'vue'
import { dynamics, dynamicUsers } from '../mock.js'

// 该页当前为静态数据；动态流接口需 WBI 签名，按 guide 约定不自行实现
defineEmits(['play'])

const activeTop = ref('综合')
const activeUser = ref('全部动态')
</script>

<template>
  <header class="rp-dyn-top">
    <button :class="{ on: activeTop === '视频' }" @click="activeTop = '视频'">视频</button>
    <button :class="{ on: activeTop === '综合' }" @click="activeTop = '综合'">综合</button>
    <svg class="edit" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M14 6l4 4" /></svg>
  </header>

  <div class="rp-content rp-dyn-body">
    <aside class="rp-dyn-users">
      <div v-for="user in dynamicUsers" :key="user.name" class="rp-dyn-user" :class="{ on: activeUser === user.name }" @click="activeUser = user.name">
        <div class="av" :class="`t${user.tone}`">
          <span v-if="user.live" class="live-tag">直播中</span>
        </div>
        <span>{{ user.name }}</span>
      </div>
    </aside>

    <section class="rp-dyn-feed">
      <article v-for="post in dynamics" :key="post.user" class="rp-post">
        <div class="rp-post-head">
          <div class="av" :class="`t${post.avatarTone}`"></div>
          <div class="who">
            <b>{{ post.user }}</b>
            <small>{{ post.time }}</small>
          </div>
          <span class="rp-more">⋯</span>
        </div>
        <p class="rp-post-text">{{ post.text }}</p>
        <div v-if="post.image" class="rp-post-img">
          <h4>{{ post.image.caption.split('\n')[0] }}</h4>
          <div class="big">{{ post.image.caption.split('\n')[1] }}</div>
          <div class="sub"><span>{{ post.image.sub }}</span><span>🌐 时区：北京时间</span></div>
          <div class="grid2">
            <div v-for="(row, index) in post.image.rows" :key="index" class="cell">
              <span class="no">第{{ ['一', '二', '三', '四'][index] }}场</span>
              <span class="tm">{{ post.image.times[index] }}</span>
              <div class="vs">{{ row[0] }}<br />vs.{{ row[1] }}</div>
            </div>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { playerInfo, playerRecommends } from '../mock.js'

const sideTab = ref('简介')
</script>

<template>
  <div class="rp-player">
    <div class="rp-player-video">
      <div class="rp-player-stage">
        <div class="rp-player-watermark">小鸡不好惹ooo &nbsp;bilibili</div>
        <div style="color: rgba(255,255,255,.5); font-size: 13px">竖屏视频画面</div>
      </div>
    </div>

    <aside class="rp-player-side">
      <div class="rp-player-tabs">
        <button :class="{ on: sideTab === '简介' }" @click="sideTab = '简介'">简介</button>
        <button :class="{ on: sideTab === '评论' }" @click="sideTab = '评论'">评论 {{ playerInfo.danmaku }}</button>
      </div>

      <div class="rp-player-up">
        <div class="av t1"></div>
        <div class="who">
          <b>{{ playerInfo.up }}</b>
          <small>{{ playerInfo.fans }} · {{ playerInfo.videos }}</small>
        </div>
        <button class="rp-follow-btn">＋ 关注</button>
      </div>

      <div class="rp-player-title"><span class="grow">{{ playerInfo.title }}</span><span class="rp-more">⌄</span></div>
      <div class="rp-player-meta">
        <span>▶ {{ playerInfo.play }}</span>
        <span>💬 {{ playerInfo.danmaku }}</span>
        <span>{{ playerInfo.date }}</span>
        <span>👥 {{ playerInfo.watching }}</span>
      </div>

      <div class="rp-player-actions">
        <div v-for="action in playerInfo.actions" :key="action.icon" class="rp-action">
          <span class="ic">{{ action.icon }}</span>{{ action.label }}
        </div>
      </div>

      <div class="rp-rec">
        <h5>推荐视频</h5>
        <div v-for="item in playerRecommends" :key="item.title" class="rp-rec-item">
          <div class="rp-rec-cover" :class="`t${item.tone}`"><span>{{ item.duration }}</span></div>
          <div class="rp-rec-body">
            <h6>{{ item.title }}</h6>
            <div class="row">
              <span v-if="item.badge" class="rp-like">{{ item.badge }}</span>
              <span>{{ item.up }}</span>
              <span>▶ {{ item.play }}</span>
              <span>💬 {{ item.danmaku }}</span>
            </div>
          </div>
          <span class="rp-more">⋯</span>
        </div>
      </div>
    </aside>
  </div>
</template>

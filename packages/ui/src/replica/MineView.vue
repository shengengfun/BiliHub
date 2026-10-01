<script setup>
import { ref } from 'vue'
import { chatList, messageShortcuts, mineMenus, settingsItems } from '../mock.js'
import { brand } from '../brand.js'

defineEmits(['play'])

const section = ref('消息')
const activeMenu = ref('我的消息')
</script>

<template>
  <div class="rp-content rp-mine-body">
    <aside class="rp-mine-left">
      <div class="rp-profile">
        <div class="rp-profile-top">
          <div class="av"></div>
          <div class="info">
            <div class="rp-nick">玩魔爪丶m0NSTER <span class="rp-lv">LV6</span></div>
            <div class="rp-vip">👑 年度大会员</div>
            <div class="rp-coins"><span>硬币：1968</span><span>B币：0.0</span></div>
          </div>
        </div>
        <div class="rp-stats">
          <div><b>5086</b>动态</div>
          <div><b>382</b>关注</div>
          <div><b>7980</b>粉丝</div>
        </div>
      </div>

      <div class="rp-promo">
        <b>三角洲行动S10新赛季！</b>
        <small>大会员点击领好礼</small>
        <button>大会员中心</button>
      </div>

      <div v-for="group in mineMenus" :key="group.group" class="rp-menu-group">
        <span>{{ group.group }}</span>
        <div
          v-for="item in group.items"
          :key="item.label"
          class="rp-menu-item"
          :class="{ on: activeMenu === item.label }"
          @click="activeMenu = item.label; section = item.label === '设置' ? '设置' : section"
        >
          <img :src="brand(`${item.icon}.png`)" :alt="item.label" />{{ item.label }}
        </div>
      </div>
    </aside>

    <section class="rp-mine-right">
      <div class="rp-right-head">
        {{ section }}
        <span class="tools">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></svg>
          <span>⋮</span>
        </span>
      </div>

      <template v-if="section !== '设置'">
        <div class="rp-shortcuts">
          <div v-for="item in messageShortcuts" :key="item.label" class="rp-shortcut">
            <span class="ic" :style="{ background: item.tone }">{{ item.label.slice(0, 1) }}</span>
            {{ item.label }}
          </div>
        </div>
        <div class="rp-list-title">聊天列表</div>
        <div v-for="chat in chatList" :key="chat.name" class="rp-chat">
          <div class="av" :class="`t${chat.tone}`"></div>
          <div class="body">
            <div class="name">{{ chat.name }} <span v-if="chat.badge" class="rp-lv">{{ chat.badge }}</span><span v-if="chat.lv" class="rp-lv">{{ chat.lv }}</span></div>
            <div class="desc">{{ chat.desc }}</div>
          </div>
          <div class="tail">
            <div>{{ chat.time }}</div>
            <span v-if="chat.unread" class="rp-unread">{{ chat.unread }}</span>
          </div>
        </div>
      </template>

      <template v-else>
        <div v-for="(group, index) in settingsItems" :key="index" class="rp-setting-group">
          <div v-for="item in group" :key="item" class="rp-setting-item">
            <span>{{ item }}</span><span class="arrow">›</span>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

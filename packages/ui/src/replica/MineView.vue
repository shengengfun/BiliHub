<script setup>
import { onMounted, ref } from 'vue'
import { chatList, messageShortcuts, mineMenus, settingsItems } from '../mock.js'
import { brand, brandIcon } from '../brand.js'
import { formatCount, mediaUrl } from '../bili.js'
import { user, login, refreshUser, logout, authSupported, startUserSync } from '../user.js'
import ExtendPanel from './ExtendPanel.vue'

/**
 * 版面按截图实测：
 *   左栏 637 设备像素 → 291 CSS，白底，含账号卡片 / 大会员推广 / 分组菜单
 *   右栏 1900 设备像素 → 868 CSS，头部高 74，标题居中
 */
const BUILTIN = { 插件: 'plugin', 功能模块: 'module', 下载管理: 'download' }

defineEmits(['play'])

const section = ref('消息')
const activeMenu = ref('我的消息')
const toast = ref('')

function notify(message) {
  toast.value = message
  window.clearTimeout(notify.timer)
  notify.timer = window.setTimeout(() => { toast.value = '' }, 2600)
}

async function onAccount() {
  if (!authSupported) {
    notify('登录需要在 BiliHub 桌面客户端中进行')
    return
  }
  if (user.value.isLogin) {
    await logout()
    notify('已退出登录')
    return
  }
  notify('已打开登录窗口，请在窗口中完成登录')
  const result = await login()
  notify(result?.isLogin ? `欢迎回来，${result.name}` : '未完成登录')
}

/** 未登录时点击「我的消息 / 我的收藏」等需要账号的入口 */
async function onMenu(label) {
  activeMenu.value = label
  if (label === '设置') { section.value = '设置'; return }
  // 插件 / 功能模块 / 下载管理 属于本地能力，不需要登录
  if (BUILTIN[label]) { section.value = label; return }
  if (!user.value.isLogin) {
    if (!authSupported) return notify('该功能需要在桌面客户端登录后使用')
    notify('已打开登录窗口，请在窗口中完成登录')
    const result = await login()
    if (!result?.isLogin) return notify('未完成登录')
  }
  section.value = label
}

onMounted(() => {
  refreshUser()
  startUserSync()
})
</script>

<template>
  <div class="rp-mine-body">
    <aside class="rp-mine-left">
      <div class="rp-profile">
        <div class="rp-profile-top">
          <button class="rp-avatar-btn" title="账号" @click="onAccount">
            <img
              class="av-img"
              :src="user.isLogin && user.face ? mediaUrl(user.face) : brand('ic-avatar.png')"
              :alt="user.isLogin ? user.name : '未登录'"
            />
          </button>
          <div class="info">
            <div class="rp-nick">
              <span>{{ user.isLogin ? user.name : '未登录' }}</span>
              <span v-if="user.isLogin" class="rp-lv">LV{{ user.level }}</span>
            </div>
            <div v-if="user.isLogin && user.vip" class="rp-vip">👑 {{ user.vipLabel || '年度大会员' }}</div>
            <div v-else-if="!user.isLogin" class="rp-login-hint" @click="onAccount">点击登录哔哩哔哩账号</div>
            <div v-if="user.isLogin" class="rp-coins">
              <span>硬币：{{ user.coin }}</span><span>B币：{{ user.bcoin }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="user.isLogin" class="rp-stats">
        <div><b>—</b>动态</div>
        <div><b>{{ formatCount(user.following) }}</b>关注</div>
        <div><b>{{ formatCount(user.follower) }}</b>粉丝</div>
      </div>
      <div v-else class="rp-stats rp-stats-empty">登录后可查看关注、粉丝与动态数据</div>

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
          @click="onMenu(item.label)"
        >
          <img :src="brandIcon(item.icon)" :alt="item.label" />{{ item.label }}
        </div>
      </div>
    </aside>

    <section class="rp-mine-right">
      <div class="rp-right-head">
        {{ section }}
        <span v-if="section === '消息'" class="tools">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="8" r="3.4" /><path d="M3.5 19c0-3.4 2.9-5.6 6.5-5.6" /><path d="M18 11v6M15 14h6" /></svg>
          <span>⋮</span>
        </span>
      </div>

      <!-- 插件 / 功能模块 / 下载管理 -->
      <ExtendPanel v-if="BUILTIN[section]" :key="section" :kind="BUILTIN[section]" />

      <!-- 设置 -->
      <template v-else-if="section === '设置'">
        <template v-for="(group, index) in settingsItems" :key="index">
          <div v-if="index" class="rp-band"></div>
          <div class="rp-setting-group">
            <div v-for="item in group" :key="item" class="rp-setting-item">
              <span>{{ item }}</span><span class="arrow">›</span>
            </div>
          </div>
        </template>
      </template>

      <!-- 消息 -->
      <template v-else>
        <div class="rp-shortcuts">
          <div v-for="item in messageShortcuts" :key="item.label" class="rp-shortcut">
            <span class="ic" :style="{ background: item.tone }">{{ item.label.slice(0, 1) }}</span>
            {{ item.label }}
          </div>
        </div>
        <div class="rp-band"></div>
        <div class="rp-list-title">聊天列表</div>
        <div v-for="chat in chatList" :key="chat.name" class="rp-chat">
          <div class="av" :class="`t${chat.tone}`"></div>
          <div class="body">
            <div class="name">
              {{ chat.name }}
              <span v-if="chat.badge" class="rp-lv">{{ chat.badge }}</span>
              <span v-if="chat.lv" class="rp-lv">{{ chat.lv }}</span>
            </div>
            <div class="desc">{{ chat.desc }}</div>
          </div>
          <div class="tail">
            <div>{{ chat.time }}</div>
            <span v-if="chat.unread" class="rp-unread">{{ chat.unread }}</span>
          </div>
        </div>
      </template>

      <div v-if="toast" class="rp-toast">{{ toast }}</div>
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { chatList, messageShortcuts, mineMenus, settingsItems } from '../mock.js'
import { brand, brandIcon } from '../brand.js'
import { formatCount } from '../bili.js'
import { user, login, refreshUser, logout, authSupported, startUserSync } from '../user.js'
import { api } from '../api.js'
import { mineGuestStatus, mineGuestLogin, messageGuestTip, favoriteGuestTip } from '../tokens.js'
import ExtendPanel from './ExtendPanel.vue'
import UserAvatar from './UserAvatar.vue'

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

/** 刷新账号信息；F5 与头部刷新按钮走同一条路径 */
async function onRefresh() {
  await refreshUser()
  notify('账号信息已刷新')
}

onMounted(() => {
  refreshUser()
  startUserSync()
  window.addEventListener('bilihub:refresh', onRefresh)
})
onBeforeUnmount(() => window.removeEventListener('bilihub:refresh', onRefresh))
</script>

<template>
  <div class="rp-mine-body">
    <aside class="rp-mine-left">
      <div class="rp-profile">
        <div class="rp-profile-top">
          <button class="rp-avatar-btn" :title="user.isLogin ? '账号' : '登录'" @click="onAccount">
            <UserAvatar
              :src="user.isLogin ? user.face : ''"
              :pendant="user.isLogin ? user.pendant : null"
              :nameplate="user.isLogin ? user.nameplate : null"
              :vip-icon="user.isLogin ? user.avatarIcon : ''"
              :guest="!user.isLogin"
              :size="67"
              :round="false"
            />
          </button>
          <div class="info">
            <div class="rp-nick">
              <span :style="user.isLogin && user.nicknameColor ? { color: user.nicknameColor } : null">
                {{ user.isLogin ? user.name : mineGuestStatus }}
              </span>
              <span v-if="user.isLogin" class="rp-lv">LV{{ user.level }}</span>
            </div>
            <img v-if="user.isLogin && user.vipLabelImage" class="rp-vip-label" :src="user.vipLabelImage" :alt="user.vipLabel" />
            <span v-else-if="user.isLogin && user.vip" class="rp-vip" :style="{ background: user.vipBgColor, color: user.vipTextColor }">{{ user.vipLabel || '大会员' }}</span>
            <div v-else-if="!user.isLogin" class="rp-login-hint" @click="onAccount">{{ mineGuestLogin }}</div>
            <div v-if="user.isLogin" class="rp-coins">
              <span>硬币：{{ user.coin }}</span><span>B币：{{ user.bcoin }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="user.isLogin" class="rp-stats">
        <div><b>{{ user.dynamicCount ?? '—' }}</b>动态</div>
        <div><b>{{ formatCount(user.following) }}</b>关注</div>
        <div><b>{{ formatCount(user.follower) }}</b>粉丝</div>
      </div>
      <div v-else class="rp-stats">
        <div><b>—</b>动态</div>
        <div><b>—</b>关注</div>
        <div><b>—</b>粉丝</div>
      </div>

      <div class="rp-promo">
        <div class="rp-promo-title">
          <span class="rp-promo-badge">大</span>
          <div class="rp-promo-text">
            <b>三角洲行动S10新赛季！</b>
            <small>大会员点击领好礼</small>
          </div>
        </div>
        <button @click="api.openBilibili('https://account.bilibili.com/big')">大会员中心</button>
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
        <span class="tools">
          <svg v-if="section === '消息'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="8" r="3.4" /><path d="M3.5 19c0-3.4 2.9-5.6 6.5-5.6" /><path d="M18 11v6M15 14h6" /></svg>
          <button class="rp-icon-btn" title="刷新（F5）" @click="onRefresh">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4.5V11h-6.2" /></svg>
          </button>
          <span v-if="section === '消息'">⋮</span>
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

      <!-- 消息：未登录时不能展示聊天列表，改为原包的游客提示 -->
      <template v-else-if="!user.isLogin">
        <div class="rp-guest">
          <div class="rp-guest-icon">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 12.5c0 3.6-3.6 6.5-8 6.5-1 0-2-.15-2.9-.42L4.5 20l1.2-3.3C4.6 15.6 4 14.1 4 12.5 4 8.9 7.6 6 12 6s8 2.9 8 6.5z" /></svg>
          </div>
          <p class="rp-guest-text">{{ messageGuestTip }}</p>
          <p class="rp-guest-sub">{{ favoriteGuestTip }}</p>
          <button class="rp-guest-btn" @click="onAccount">{{ mineGuestLogin }}</button>
        </div>
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

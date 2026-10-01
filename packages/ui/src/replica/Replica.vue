<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import HomeView from './HomeView.vue'
import DynamicView from './DynamicView.vue'
import MineView from './MineView.vue'
import PlayerView from './PlayerView.vue'
import ContextMenu from './ContextMenu.vue'
import { brand } from '../brand.js'

const emit = defineEmits(['open-panel'])

// 图标来自用户提供的 iBiliPlayer-bili.apk（ic_vector_tab_bar_*_hd），仅本地使用
const tabs = [
  { id: 'home', label: '首页', icon: 'tab-home', view: HomeView },
  { id: 'dynamic', label: '动态', icon: 'tab-dynamic', view: DynamicView },
  { id: 'mine', label: '我的', icon: 'tab-mine', view: MineView },
]
const active = ref('home')
const currentBvid = ref('')
const helpOpen = ref(false)

function openPlayer(video) {
  currentBvid.value = video?.bvid ?? ''
  if (currentBvid.value) window.scrollTo(0, 0)
}

/** 桌面端快捷键：数字切页、Ctrl+F 聚焦搜索、F1 快捷键说明、F5 刷新当前页 */
function onKey(event) {
  const target = event.target
  if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  if (currentBvid.value) return

  if (event.key === 'F1') {
    event.preventDefault()
    helpOpen.value = !helpOpen.value
    return
  }
  // F5 对应原包的下拉刷新。各页自行监听 bilihub:refresh，
  // 这样「刷新」只有一套语义，不必每个页面各写一遍键处理。
  if (event.key === 'F5') {
    event.preventDefault()
    window.dispatchEvent(new Event('bilihub:refresh'))
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault()
    document.querySelector('.rp-search input')?.focus()
    return
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return
  const index = Number(event.key) - 1
  if (index >= 0 && index < tabs.length) active.value = tabs[index].id
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <PlayerView v-if="currentBvid" :bvid="currentBvid" @close="currentBvid = ''" @play="openPlayer" />
  <div v-else class="rp">
    <component :is="tabs.find((tab) => tab.id === active)?.view" @play="openPlayer" />
    <nav class="rp-tabbar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="{ on: active === tab.id }"
        @click="active = tab.id"
      >
        <img class="rp-tabbar-icon" :src="brand(`${tab.icon}${active === tab.id ? '-on' : ''}.svg`)" :alt="tab.label" />
        {{ tab.label }}
      </button>
    </nav>
    <div class="rp-devbar">
      <button @click="emit('open-panel')">功能面板</button>
      <button style="margin-left: 8px" @click="helpOpen = true">快捷键</button>
    </div>

    <div v-if="helpOpen" class="rp-sender" @click="helpOpen = false">
      <div class="rp-sender-card" style="width: 420px" @click.stop>
        <div class="rp-sender-head">桌面端快捷键</div>
        <div class="rp-shortcuts-help" style="padding: 0">
          <dl>
            <dt><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></dt><dd>切换首页 / 动态 / 我的</dd>
            <dt><kbd>Ctrl</kbd>+<kbd>F</kbd></dt><dd>聚焦搜索框</dd>
            <dt><kbd>F1</kbd></dt><dd>显示本说明</dd>
            <dt>右键卡片</dt><dd>播放 / 复制链接 / 下载 / 不感兴趣</dd>
            <dt>播放页滚轮</dt><dd>调节音量（按住 Shift 为快进后退）</dd>
            <dt>播放页双击</dt><dd>切换全屏</dd>
            <dt>拖拽进度条</dt><dd>任意跳转</dd>
            <dt><kbd>Space</kbd> / <kbd>F</kbd> / <kbd>D</kbd></dt><dd>播放暂停 / 全屏 / 弹幕开关</dd>
          </dl>
        </div>
        <button class="rp-sender-open" @click="helpOpen = false">知道了</button>
      </div>
    </div>
  </div>
  <ContextMenu />
</template>

<script setup>
import { ref } from 'vue'
import HomeView from './HomeView.vue'
import DynamicView from './DynamicView.vue'
import MineView from './MineView.vue'
import PlayerView from './PlayerView.vue'
import { brand } from '../brand.js'

const emit = defineEmits(['open-panel'])

// 图标来自用户提供的 iBiliPlayer-bili.apk（ic_vector_tab_bar_*_hd），仅本地使用
const tabs = [
  { id: 'home', label: '首页', icon: 'tab-home', view: HomeView },
  { id: 'dynamic', label: '动态', icon: 'tab-dynamic', view: DynamicView },
  { id: 'mine', label: '我的', icon: 'tab-mine', view: MineView },
]
const active = ref('home')
const playing = ref(false)
</script>

<template>
  <PlayerView v-if="playing" />
  <div v-else class="rp">
    <component :is="tabs.find((tab) => tab.id === active)?.view" />
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
      <button @click="playing = true">播放页</button>
      <button @click="emit('open-panel')">功能面板</button>
    </div>
  </div>
</template>

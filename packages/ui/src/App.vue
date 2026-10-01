<script setup>
import { ref } from 'vue'
import Replica from './replica/Replica.vue'
import Panel from './Panel.vue'

// 默认展示客户端界面复刻；可切换到 BiliHub 功能面板
const view = ref('replica')
</script>

<template>
  <Replica v-if="view === 'replica'" @open-panel="view = 'panel'" />
  <div v-else class="panel-switch">
    <button class="panel-switch-back" @click="view = 'replica'">← 返回客户端界面</button>
    <Panel />
  </div>
</template>


<script setup>
import { onMounted, ref } from 'vue'
import { api } from './api.js'
import ModulesView from './views/ModulesView.vue'
import DownloadsView from './views/DownloadsView.vue'
import PluginsView from './views/PluginsView.vue'
import AboutView from './views/AboutView.vue'

const tabs = [
  { id: 'modules', label: '功能模块', view: ModulesView },
  { id: 'downloads', label: '下载管理', view: DownloadsView },
  { id: 'plugins', label: '插件', view: PluginsView },
  { id: 'about', label: '关于', view: AboutView },
]
const active = ref('modules')
const mode = ref('browser')

onMounted(async () => { mode.value = api.mode })
</script>

<template>
  <div class="panel">
    <header class="panel-header">
      <div class="brand"><span>B</span><strong>BiliHub</strong><em>客户端面板</em></div>
      <nav>
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="{ active: active === tab.id }"
          @click="active = tab.id"
        >{{ tab.label }}</button>
      </nav>
      <div class="header-actions">
        <span class="mode-pill" :class="mode">{{ mode === 'electron' ? 'ELECTRON' : 'BROWSER' }}</span>
        <button class="icon" title="打开 B 站" @click="api.openBilibili()">↗</button>
        <button class="icon" title="关闭面板" @click="api.closePanel()">×</button>
      </div>
    </header>
    <main class="panel-body">
      <component :is="tabs.find((tab) => tab.id === active)?.view" />
    </main>
  </div>
</template>

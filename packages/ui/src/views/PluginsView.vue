<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api.js'

const plugins = ref([])
const loading = ref(true)

async function refresh() { plugins.value = await api.listPlugins(); loading.value = false }
async function toggle(plugin) { await api.setPluginEnabled(plugin.id, !plugin.enabled); await refresh() }

onMounted(refresh)
</script>

<template>
  <h2 class="section-title">插件 <span class="count">{{ plugins.length }} 个</span></h2>
  <p class="section-desc">插件通过权限沙箱运行，只可调用 manifest 中声明的能力。</p>

  <div class="card" style="margin-bottom: 14px">
    <div class="card-head">
      <div>
        <h3>插件目录</h3>
        <p>插件安装在用户数据目录下的 plugins 文件夹，可手动放入以 manifest.json 为入口的插件。</p>
      </div>
      <button class="action" @click="api.revealPluginFolder()">打开目录</button>
    </div>
  </div>

  <div v-if="loading" class="empty">正在读取插件…</div>
  <div v-else-if="!plugins.length" class="empty">尚未安装插件。</div>
  <div v-else class="grid">
    <article v-for="plugin in plugins" :key="plugin.id" class="card">
      <div class="card-head">
        <h3>{{ plugin.name }}</h3>
        <button class="switch" :class="{ on: plugin.enabled }" @click="toggle(plugin)"><i></i></button>
      </div>
      <p>{{ plugin.description }}</p>
      <div class="tag-row">
        <span class="tag">v{{ plugin.version }}</span>
        <span v-for="permission in plugin.permissions" :key="permission" class="tag">{{ permission }}</span>
      </div>
    </article>
  </div>
</template>

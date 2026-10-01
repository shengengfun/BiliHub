<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../api.js'

const plugins = ref([])
const loading = ref(true)
const message = ref('')
const installed = computed(() => plugins.value.filter((plugin) => plugin.valid))
const broken = computed(() => plugins.value.filter((plugin) => !plugin.valid))

async function refresh() {
  plugins.value = await api.listPlugins()
  loading.value = false
}

async function toggle(plugin) {
  const result = await api.setPluginEnabled(plugin.id, !plugin.enabled)
  if (result && result.ok === false) message.value = result.error
  else message.value = `${plugin.name} 已${plugin.enabled ? '停用' : '启用'}（重启页面后生效）`
  await refresh()
}

onMounted(refresh)
</script>

<template>
  <h2 class="section-title">插件 <span class="count">{{ installed.length }} 个可用</span></h2>
  <p class="section-desc">插件通过权限沙箱运行，只能调用 manifest 中声明的能力，未声明的调用会被拒绝。</p>

  <div class="card" style="margin-bottom: 14px">
    <div class="card-head">
      <div>
        <h3>插件目录</h3>
        <p>把插件文件夹放入用户数据目录下的 plugins 目录即可安装，入口文件由 manifest.json 的 main 字段指定。</p>
      </div>
      <button class="action" @click="api.revealPluginFolder()">打开目录</button>
    </div>
    <div class="tag-row" style="margin-top: 12px">
      <span class="tag">storage</span>
      <span class="tag">ui.page</span>
      <span class="tag">notify</span>
      <span class="tag">danmaku.read</span>
      <span class="tag">danmaku.write</span>
      <span class="tag">download</span>
      <span class="tag">player</span>
    </div>
  </div>

  <div v-if="message" class="plugin-message">{{ message }}</div>

  <div v-if="loading" class="empty">正在读取插件…</div>
  <div v-else-if="!plugins.length" class="empty">尚未安装插件。</div>

  <template v-else>
    <div v-if="installed.length" class="grid">
      <article v-for="plugin in installed" :key="plugin.id" class="card">
        <div class="card-head">
          <h3>{{ plugin.name }} <span v-if="plugin.version" class="plugin-version">v{{ plugin.version }}</span></h3>
          <button class="switch" :class="{ on: plugin.enabled }" :title="plugin.enabled ? '停用' : '启用'" @click="toggle(plugin)"><i></i></button>
        </div>
        <p>{{ plugin.description || '该插件没有填写描述' }}</p>
        <div class="tag-row">
          <span v-if="plugin.author" class="tag">作者 {{ plugin.author }}</span>
          <span v-for="permission in plugin.permissions" :key="permission" class="tag">{{ permission }}</span>
          <span v-if="!plugin.permissions.length" class="tag">无权限声明</span>
        </div>
      </article>
    </div>

    <template v-if="broken.length">
      <h3 class="section-title" style="font-size: 15px; margin-top: 22px">无法加载 <span class="count">{{ broken.length }} 个</span></h3>
      <div v-for="plugin in broken" :key="plugin.id" class="plugin-broken">
        <b>{{ plugin.folder }}</b>
        <ul>
          <li v-for="error in plugin.errors" :key="error">{{ error }}</li>
        </ul>
      </div>
    </template>
  </template>
</template>

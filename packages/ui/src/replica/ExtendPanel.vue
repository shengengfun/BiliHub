<script setup>
// 「我的」页里的扩展管理：插件 / 功能模块 / 下载管理
// 样式独立于控制面板，保持与原包一致的分组列表观感。
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api } from '../api.js'

const props = defineProps({ kind: { type: String, required: true } })

const plugins = ref([])
const modules = ref([])
const moduleValues = ref({})
const downloads = ref({ items: [], stats: {} })
const directory = ref('')
const message = ref('')
const loading = ref(true)
let timer
let unsubscribe = () => {}

const installedPlugins = computed(() => plugins.value.filter((plugin) => plugin.valid))
const brokenPlugins = computed(() => plugins.value.filter((plugin) => !plugin.valid))

const TYPE_LABEL = { video: '视频', cover: '封面', danmaku: '弹幕', metadata: '元数据' }
const STATUS_LABEL = { pending: '排队中', running: '下载中', paused: '已暂停', done: '已完成', error: '失败', canceled: '已取消' }

function notify(text) {
  message.value = text
  window.clearTimeout(notify.timer)
  notify.timer = window.setTimeout(() => { message.value = '' }, 3200)
}

function humanSize(bytes) {
  const value = Number(bytes) || 0
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`
  if (value >= 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${value} B`
}

async function loadPlugins() {
  plugins.value = await api.listPlugins()
}

async function loadModules() {
  modules.value = await api.listModules()
  for (const module of modules.value) {
    moduleValues.value[module.id] = await api.getModuleSettings(module.id)
  }
}

async function loadDownloads() {
  downloads.value = await api.listDownloads()
}

async function reload() {
  loading.value = true
  try {
    if (props.kind === 'plugin') await loadPlugins()
    else if (props.kind === 'module') await loadModules()
    else await loadDownloads()
    directory.value = await api.downloadsDir()
  } finally {
    loading.value = false
  }
}

async function togglePlugin(plugin) {
  const result = await api.setPluginEnabled(plugin.id, !plugin.enabled)
  if (result && result.ok === false) notify(result.error)
  else notify(`${plugin.name} 已${plugin.enabled ? '停用' : '启用'}，重新打开 B 站页面后生效`)
  await loadPlugins()
}

/** 安装仓库内置的示例插件，让插件能力可直接试用 */
async function installBundled() {
  const result = await api.installBundledPlugins()
  if (result?.error) return notify(result.error)
  const parts = []
  if (result.installed?.length) parts.push(`已安装 ${result.installed.join('、')}`)
  if (result.skipped?.length) parts.push(`已存在 ${result.skipped.join('、')}`)
  notify(parts.join('；') || '没有可安装的内置插件')
  await loadPlugins()
}

async function toggleModule(module) {
  const next = module.enabled === false
  await api.setModuleEnabled(module.id, next)
  module.enabled = next
  notify(`${module.name} 已${next ? '启用' : '停用'}`)
}

async function updateSetting(moduleId, schema, value) {
  moduleValues.value[moduleId] = { ...moduleValues.value[moduleId], [schema.key]: value }
  await api.setModuleSetting(moduleId, schema.key, value)
}

function settingOn(moduleId, schema) {
  return Boolean(moduleValues.value[moduleId]?.[schema.key])
}

onMounted(async () => {
  await reload()
  if (props.kind === 'download') {
    unsubscribe = api.onDownloadsChanged((payload) => { if (payload?.items) downloads.value = payload })
    timer = window.setInterval(loadDownloads, 2500)
  }
})

onUnmounted(() => {
  window.clearInterval(timer)
  unsubscribe()
})
</script>

<template>
  <div class="ext">
    <div class="ext-head">
      <div>
        <b v-if="kind === 'plugin'">插件</b>
        <b v-else-if="kind === 'module'">功能模块</b>
        <b v-else>下载管理</b>
        <small v-if="kind === 'plugin'">已安装 {{ installedPlugins.length }} 个，运行在权限沙箱中</small>
        <small v-else-if="kind === 'module'">共 {{ modules.length }} 个模块，在 B 站页面中生效</small>
        <small v-else>主进程下载队列，支持断点续传</small>
      </div>
      <div class="ext-actions">
        <button v-if="kind === 'plugin'" @click="installBundled()">安装内置示例</button>
        <button v-if="kind === 'plugin'" @click="api.revealPluginFolder()">打开插件目录</button>
        <button v-if="kind === 'download'" @click="api.openDownloadFolder()">打开下载目录</button>
        <button :disabled="loading" @click="reload">{{ loading ? '读取中' : '刷新' }}</button>
      </div>
    </div>

    <p v-if="kind === 'plugin'" class="ext-note">
      把插件文件夹放进用户数据目录下的 plugins 目录即可安装，入口文件由 manifest.json 的 main 字段指定。
    </p>
    <p v-if="kind === 'module'" class="ext-note">
      模块总开关关闭后，该模块不会在 B 站页面中执行。
    </p>

    <div v-if="message" class="ext-message">{{ message }}</div>

    <div v-if="loading" class="ext-empty">正在读取…</div>

    <!-- 插件 -->
    <template v-else-if="kind === 'plugin'">
      <div v-if="!plugins.length" class="ext-empty">尚未安装插件。</div>
      <div v-for="plugin in installedPlugins" :key="plugin.id" class="ext-card">
        <div class="ext-card-head">
          <div>
            <b>{{ plugin.name }}<em v-if="plugin.version"> v{{ plugin.version }}</em></b>
            <small>{{ plugin.author || '未知作者' }}</small>
          </div>
          <button class="ext-switch" :class="{ on: plugin.enabled }" @click="togglePlugin(plugin)"><i></i></button>
        </div>
        <p>{{ plugin.description || '该插件没有填写描述' }}</p>
        <div class="ext-tags">
          <span v-for="permission in plugin.permissions" :key="permission">{{ permission }}</span>
          <span v-if="!plugin.permissions.length">无权限声明</span>
        </div>
      </div>

      <template v-if="brokenPlugins.length">
        <div class="ext-sub">无法加载（{{ brokenPlugins.length }}）</div>
        <div v-for="plugin in brokenPlugins" :key="plugin.id" class="ext-broken">
          <b>{{ plugin.folder }}</b>
          <ul><li v-for="error in plugin.errors" :key="error">{{ error }}</li></ul>
        </div>
      </template>
    </template>

    <!-- 功能模块 -->
    <template v-else-if="kind === 'module'">
      <div v-if="!modules.length" class="ext-empty">当前环境没有可用的模块运行时。</div>
      <div v-for="module in modules" :key="module.id" class="ext-card" :class="{ off: module.enabled === false }">
        <div class="ext-card-head">
          <div>
            <b>{{ module.name }}</b>
            <small>{{ module.category }} · v{{ module.version }}</small>
          </div>
          <button class="ext-switch" :class="{ on: module.enabled !== false }" @click="toggleModule(module)"><i></i></button>
        </div>
        <p>{{ module.description }}</p>

        <div v-for="schema in (module.settings ?? [])" :key="schema.key" class="ext-field">
          <div v-if="schema.type === 'boolean'" class="ext-field-row">
            <span>{{ schema.label }}</span>
            <button class="ext-switch small" :class="{ on: settingOn(module.id, schema) }" @click="updateSetting(module.id, schema, !settingOn(module.id, schema))"><i></i></button>
          </div>
          <template v-else>
            <div class="ext-field-row"><span>{{ schema.label }}</span><em>{{ moduleValues[module.id]?.[schema.key] }}</em></div>
            <input
              v-if="schema.type === 'range'"
              type="range"
              :min="schema.min ?? 0"
              :max="schema.max ?? 1"
              :step="schema.step ?? 0.05"
              :value="moduleValues[module.id]?.[schema.key]"
              @input="updateSetting(module.id, schema, Number($event.target.value))"
            />
            <input
              v-else-if="schema.type === 'number'"
              type="number"
              :value="moduleValues[module.id]?.[schema.key]"
              @change="updateSetting(module.id, schema, Number($event.target.value))"
            />
            <select
              v-else
              :value="moduleValues[module.id]?.[schema.key]"
              @change="updateSetting(module.id, schema, $event.target.value)"
            >
              <option v-for="option in schema.options ?? []" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
            </select>
          </template>
        </div>
      </div>
    </template>

    <!-- 下载管理 -->
    <template v-else>
      <div class="ext-note" v-if="directory">保存目录：<code>{{ directory }}</code></div>
      <div v-if="!downloads.items?.length" class="ext-empty">暂无下载任务。</div>
      <div v-for="item in downloads.items" :key="item.id" class="ext-card">
        <div class="ext-card-head">
          <div>
            <b>{{ item.filename || item.title }}</b>
            <small>
              {{ TYPE_LABEL[item.type] ?? item.type }} · {{ STATUS_LABEL[item.status] ?? item.status }} ·
              {{ item.percent }}%<template v-if="item.total">（{{ humanSize(item.received) }} / {{ humanSize(item.total) }}）</template>
            </small>
          </div>
          <div class="ext-task-actions">
            <button v-if="item.status === 'running' || item.status === 'pending'" @click="api.pauseDownload(item.id)">暂停</button>
            <button v-else-if="item.status === 'paused' || item.status === 'error'" @click="api.resumeDownload(item.id)">继续</button>
            <button v-if="item.status === 'done'" @click="api.openDownloadFolder(item.id)">打开位置</button>
            <button v-if="item.status === 'done' || item.status === 'canceled'" @click="api.removeDownload(item.id)">移除</button>
            <button v-else @click="api.cancelDownload(item.id)">取消</button>
          </div>
        </div>
        <div class="ext-bar"><i :style="{ width: `${item.percent}%` }"></i></div>
        <p v-if="item.error" class="ext-error">{{ item.error }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ext { padding: 14px 22px 24px; }
.ext-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ext-head b { display: block; font-size: 15px; }
.ext-head small { color: var(--rp-text-3); font-size: 12px; }
.ext-actions { display: flex; gap: 8px; }
.ext-actions button { padding: 6px 12px; border-radius: 14px; background: var(--rp-group); color: var(--rp-text-2); font-size: 12px; }
.ext-actions button:hover { background: var(--rp-orange-bg); color: var(--rp-orange); }
.ext-actions button:disabled { opacity: .55; cursor: default; }
.ext-note { margin: 12px 0 0; color: var(--rp-text-3); font-size: 12px; line-height: 1.7; }
.ext-note code { padding: 1px 6px; border-radius: 4px; background: var(--rp-group); }
.ext-message { margin-top: 10px; padding: 9px 12px; border-radius: 6px; background: var(--rp-orange-bg); color: var(--rp-orange); font-size: 12px; }
.ext-empty { padding: 46px 0; color: var(--rp-text-3); font-size: 13px; text-align: center; }
.ext-sub { margin: 18px 0 8px; color: var(--rp-text-3); font-size: 12px; }
.ext-card { margin-top: 12px; padding: 14px 16px; border-radius: 8px; background: var(--rp-bg); }
.ext-card.off { opacity: .6; }
.ext-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.ext-card-head b { font-size: 14px; }
.ext-card-head b em { font-style: normal; color: var(--rp-text-3); font-size: 12px; }
.ext-card-head small { display: block; margin-top: 3px; color: var(--rp-text-3); font-size: 12px; }
.ext-card > p { margin: 9px 0 0; color: var(--rp-text-2); font-size: 13px; line-height: 1.65; }
.ext-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.ext-tags span { padding: 2px 9px; border-radius: 10px; background: var(--rp-group); color: var(--rp-text-3); font-size: 11px; }
.ext-broken { margin-top: 8px; padding: 12px 14px; border-radius: 8px; background: var(--rp-orange-bg); }
.ext-broken b { font-size: 13px; color: var(--rp-orange); }
.ext-broken ul { margin: 6px 0 0; padding-left: 18px; color: var(--rp-orange); font-size: 12px; line-height: 1.7; }
.ext-field { margin-top: 12px; padding-top: 11px; border-top: 1px solid var(--rp-line); }
.ext-field-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; color: var(--rp-text-2); font-size: 12px; }
.ext-field-row em { font-style: normal; color: var(--rp-text-3); }
.ext-field input[type='range'] { width: 100%; accent-color: var(--rp-pink); }
.ext-field input[type='number'], .ext-field select { width: 100%; padding: 7px 9px; border: 1px solid var(--rp-line); border-radius: 6px; background: #fff; color: var(--rp-text-1); font-size: 13px; }
.ext-switch { position: relative; width: 42px; height: 24px; border-radius: 14px; background: #d0d3d6; flex: none; transition: background .18s; }
.ext-switch.small { width: 36px; height: 20px; }
.ext-switch i { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform .18s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
.ext-switch.small i { width: 16px; height: 16px; }
.ext-switch.on { background: var(--rp-pink); }
.ext-switch.on i { transform: translateX(18px); }
.ext-switch.small.on i { transform: translateX(16px); }
.ext-bar { height: 4px; margin-top: 10px; border-radius: 3px; background: var(--rp-group); overflow: hidden; }
.ext-bar i { display: block; height: 100%; background: var(--rp-pink); transition: width .25s; }
.ext-error { margin: 8px 0 0; color: #e04a4a; font-size: 12px; }
.ext-task-actions { display: flex; gap: 6px; flex: none; }
.ext-task-actions button { padding: 4px 10px; border-radius: 12px; background: var(--rp-group); color: var(--rp-text-2); font-size: 12px; }
.ext-task-actions button:hover { background: var(--rp-orange-bg); color: var(--rp-orange); }
</style>

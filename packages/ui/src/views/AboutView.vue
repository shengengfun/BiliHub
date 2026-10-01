<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from '../api.js'
import { user, refreshUser, authSupported } from '../user.js'

const platform = ref({ platform: 'unknown', drm: false, touch: false })
const diagnosis = ref(null)
const busy = ref(false)
const update = ref({ status: 'idle', supported: false, packaged: false })
const modules = ref([])
const storageMessage = ref('')
let unsubscribeUpdate = () => {}

const UPDATE_LABEL = {
  idle: '未检查',
  checking: '检查中…',
  available: '发现新版本',
  latest: '已是最新版本',
  downloading: '下载中',
  ready: '已下载，重启后安装',
  error: '检查失败',
}

onMounted(async () => {
  platform.value = await api.platform()
  update.value = await api.update.status()
  modules.value = await api.listModules()
  unsubscribeUpdate = api.update.onChange((payload) => { update.value = { ...update.value, ...payload } })
  await refreshUser()
})

onBeforeUnmount(() => unsubscribeUpdate())

async function checkUpdate() {
  update.value = { ...update.value, status: 'checking' }
  update.value = await api.update.check()
}

async function downloadUpdate() {
  update.value = await api.update.download()
}

async function exportSettings() {
  const result = await api.exportSettings()
  storageMessage.value = result?.ok ? `已导出 ${result.count} 项设置` : (result?.error ?? '已取消')
}

async function importSettings(replace) {
  const result = await api.importSettings({ replace })
  storageMessage.value = result?.ok ? `已导入 ${result.count} 项设置，重启后生效` : (result?.error ?? '已取消')
}

/** 诊断登录链路：Cookie 数量、SESSDATA 是否存在、nav 返回码 */
async function runDiagnose() {
  busy.value = true
  try {
    diagnosis.value = await api.auth.diagnose()
    await refreshUser()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <h2 class="section-title">关于 BiliHub</h2>
  <p class="section-desc">面向 Windows 的第三方 B 站客户端，以真实 B 站页面为承载，通过模块与插件扩展能力。</p>

  <div class="card" style="max-width: 560px">
    <h3>运行环境</h3>
    <dl class="kv" style="margin-top: 13px">
      <dt>平台</dt><dd>{{ platform.platform }}</dd>
      <dt>DRM 能力</dt><dd>{{ platform.drm ? '可用' : '不可用' }}</dd>
      <dt>触控</dt><dd>{{ platform.touch ? '支持' : '不支持' }}</dd>
      <dt>面板模式</dt><dd>{{ api.mode }}</dd>
      <dt>许可证</dt><dd>AGPL-3.0</dd>
    </dl>
  </div>

  <div class="card" style="margin-top: 14px; max-width: 560px">
    <div class="card-head">
      <div>
        <h3>账号状态</h3>
        <p style="margin-top: 7px">
          {{ user.isLogin ? `已登录：${user.name}（UID ${user.mid}）` : '未登录' }}
        </p>
        <p v-if="!authSupported" style="margin-top: 6px">浏览器预览无法登录，请在桌面客户端中操作。</p>
      </div>
      <button class="action" :disabled="busy" @click="runDiagnose()">{{ busy ? '检测中…' : '检测登录链路' }}</button>
    </div>
    <dl v-if="diagnosis" class="kv" style="margin-top: 13px">
      <dt>会话 Cookie 数</dt><dd>{{ diagnosis.cookieCount }}</dd>
      <dt>SESSDATA</dt><dd>{{ diagnosis.hasSESSDATA ? '存在' : '不存在' }}</dd>
      <dt>nav 返回码</dt><dd>{{ diagnosis.nav?.code ?? '请求失败' }}</dd>
      <dt>nav 登录态</dt><dd>{{ diagnosis.nav?.isLogin ? '已登录' : '未登录' }}</dd>
      <dt v-if="diagnosis.error">错误</dt><dd v-if="diagnosis.error">{{ diagnosis.error }}</dd>
    </dl>
  </div>

  <div class="card" style="margin-top: 14px; max-width: 560px">
    <div class="card-head">
      <div>
        <h3>版本与更新</h3>
        <p style="margin-top: 7px">
          {{ UPDATE_LABEL[update.status] ?? update.status }}
          <template v-if="update.version"> · {{ update.version }}</template>
          <template v-if="update.status === 'downloading'"> · {{ update.progress }}%</template>
        </p>
        <p v-if="!update.packaged" style="margin-top: 6px">开发态不检查更新，打包后自动生效。</p>
        <p v-if="update.error" style="margin-top: 6px">{{ update.error }}</p>
      </div>
      <div style="display: flex; gap: 8px">
        <button class="action" :disabled="update.status === 'checking'" @click="checkUpdate">检查更新</button>
        <button v-if="update.status === 'available'" class="action" @click="downloadUpdate">下载</button>
        <button v-if="update.status === 'ready'" class="action" @click="api.update.install()">重启安装</button>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top: 14px; max-width: 560px">
    <div class="card-head">
      <div>
        <h3>设置备份</h3>
        <p style="margin-top: 7px">导出模块设置与插件启用状态，便于换机或重装后恢复。</p>
        <p v-if="storageMessage" style="margin-top: 6px">{{ storageMessage }}</p>
      </div>
      <div style="display: flex; gap: 8px">
        <button class="action" @click="exportSettings">导出</button>
        <button class="action" @click="importSettings(false)">导入并合并</button>
        <button class="action" @click="importSettings(true)">导入并覆盖</button>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top: 14px; max-width: 560px">
    <h3>功能模块 <span class="count">{{ modules.length }} 个</span></h3>
    <dl class="kv" style="margin-top: 13px">
      <dt v-for="item in modules" :key="item.id">{{ item.name }}</dt>
      <dd v-for="item in modules" :key="`${item.id}-v`">{{ item.enabled === false ? '已停用' : `v${item.version}` }}</dd>
    </dl>
  </div>

  <div class="card" style="margin-top: 14px; max-width: 560px">
    <h3>免责声明</h3>
    <p style="margin-top: 9px">
      BiliHub 是独立的第三方客户端，与哔哩哔哩官方无关联。所有内容版权归原作者与平台所有，
      本客户端不提供内容下载的再分发，也不绕过付费、DRM 或登录保护。
    </p>
  </div>

  <div class="card" style="margin-top: 14px; max-width: 560px">
    <h3>贡献者</h3>
    <div class="tag-row" style="margin-top: 10px">
      <span class="tag">小丸</span><span class="tag">shengengfun</span>
      <span class="tag">DeepSeek</span><span class="tag">GitHub Copilot</span>
    </div>
  </div>
</template>

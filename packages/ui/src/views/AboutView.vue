<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api.js'
import { user, refreshUser, authSupported } from '../user.js'

const platform = ref({ platform: 'unknown', drm: false, touch: false })
const diagnosis = ref(null)
const busy = ref(false)

onMounted(async () => {
  platform.value = await api.platform()
  await refreshUser()
})

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

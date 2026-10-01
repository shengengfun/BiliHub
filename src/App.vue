<script setup>
import { computed, onMounted, ref } from 'vue'
import { createBiliHubBridge } from './core/bridge'
import { moduleRegistry } from './core/modules'

const bridge = createBiliHubBridge()
const activeTab = ref('首页')
const search = ref('')
const settingsOpen = ref(false)
const toast = ref('')
const isNight = ref(true)
const ambient = ref(true)
const enabledModules = ref(new Set(moduleRegistry.map((item) => item.id)))
const navItems = ['首页', '番剧', '直播', '动态', '收藏']
const videos = [
  { title: '【4K】在城市灯火亮起之前，去海边散步吧', creator: 'Luna的放映室', meta: '86.4万播放 · 2小时前', cover: 'linear-gradient(135deg, #193c59, #f18a73)' },
  { title: '一份适合周末的爵士歌单', creator: 'Mori Radio', meta: '32.1万播放 · 5小时前', cover: 'linear-gradient(135deg, #5a2f3d, #e5a86f)' },
  { title: '动画里的光，是怎样被画出来的？', creator: '像素研究所', meta: '17.8万播放 · 昨天', cover: 'linear-gradient(135deg, #193b38, #8ab89b)' },
]
const filteredVideos = computed(() => search.value ? videos.filter((item) => `${item.title}${item.creator}`.includes(search.value)) : videos)

function notify(message) { toast.value = message; clearTimeout(notify.timer); notify.timer = setTimeout(() => { toast.value = '' }, 2200) }
function toggleModule(id, title) { const next = new Set(enabledModules.value); next.has(id) ? next.delete(id) : next.add(id); enabledModules.value = next; notify(`${title}已${next.has(id) ? '开启' : '关闭'}`) }
async function openPlayer() { if (bridge.native) await bridge.native.openBilibili(); else notify('浏览器预览模式：启动 Electron 后打开 B 站') }
async function download(kind) { bridge.downloads.add({ title: videos[0].title, kind }); if (bridge.native) await bridge.native.download({ filename: `${videos[0].title}.${kind === 'cover' ? 'jpg' : 'json'}` }); notify(`${kind === 'video' ? '视频' : kind === 'cover' ? '封面' : '弹幕'}已加入下载队列`) }
async function captureScreen() { if (bridge.native) await bridge.native.screenshot(); else notify('截图功能需要 Electron 运行模式') }
onMounted(() => window.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector('.search-input')?.focus() } }))
</script>

<template>
  <div class="home-client" :class="{ 'home-night': isNight, 'home-ambient': ambient }">
    <header class="home-header">
      <div class="home-brand"><span>B</span><strong>BiliHub</strong></div>
      <nav><button v-for="item in navItems" :key="item" :class="{ active: activeTab === item }" @click="activeTab = item">{{ item }}</button></nav>
      <label class="home-search"><span>⌕</span><input v-model="search" class="search-input" placeholder="搜索视频、UP主" /><kbd>Ctrl K</kbd></label>
      <button class="home-icon" @click="isNight = !isNight">{{ isNight ? '☾' : '☀' }}</button><button class="home-icon" @click="settingsOpen = true">⚙</button><div class="home-avatar">B</div>
    </header>
    <div class="home-body">
      <aside class="home-rail"><button class="rail-active">⌂<small>首页</small></button><button>▣<small>频道</small></button><button>◷<small>历史</small></button><button>♡<small>收藏</small></button><span></span><button @click="download('video')">↓<small>下载</small></button><button @click="settingsOpen = true">⚙<small>设置</small></button></aside>
      <main class="home-main">
        <section class="reference-hero"><img src="/Screenshot_2026-10-01-09-18-49-645_tv.danmaku.bi.jpg" alt="Bilibili 主界面参考" /><div class="reference-shade"></div><div class="reference-copy"><span class="live-pulse"></span><small>BILIHUB CLIENT</small><h1>发现你喜欢的视频</h1><p>更干净的首页，更顺手的观看体验</p><button class="watch-button" @click="openPlayer">立即观看 <b>→</b></button></div></section>
        <div class="home-tabs"><button v-for="item in ['推荐', '热门', '影视', '知识', '音乐', '游戏']" :key="item" :class="{ active: item === '推荐' }">{{ item }}</button><button class="tool-link" @click="settingsOpen = true">工具与插件 ⚙</button></div>
        <section class="content-section"><div class="content-heading"><div><small>FOR YOU</small><h2>为你推荐</h2></div><button @click="notify('已刷新推荐')">换一换 ↻</button></div><div class="home-video-grid"><article v-for="video in filteredVideos" :key="video.title" class="home-video" @click="openPlayer"><div class="home-cover" :style="{ background: video.cover }"><span>▶</span><small>16:24</small></div><h3>{{ video.title }}</h3><p>{{ video.creator }} · {{ video.meta }}</p></article></div></section>
        <section class="content-section"><div class="content-heading"><div><small>ENHANCED BY BILIHUB</small><h2>播放工具</h2></div><button @click="settingsOpen = true">管理模块 →</button></div><div class="feature-row"><button v-for="(module, index) in moduleRegistry.slice(0, 5)" :key="module.id" :class="{ disabled: !enabledModules.has(module.id) }" @click="toggleModule(module.id, module.title)"><i>{{ ['✦', '↓', '≋', '⌘', '◉'][index] }}</i><span>{{ module.title }}</span><small>{{ module.description }}</small></button><button @click="captureScreen"><i>▣</i><span>画面截图</span><small>保存当前客户端画面</small></button></div></section>
      </main>
    </div>
    <div v-if="toast" class="toast"><span>✓</span>{{ toast }}</div>
    <div v-if="settingsOpen" class="modal-backdrop" @click.self="settingsOpen = false"><section class="settings-modal"><div class="modal-header"><div><span class="section-kicker">BILIHUB CLIENT</span><h2>客户端设置</h2></div><button class="close-button" @click="settingsOpen = false">×</button></div><div class="setting-row"><div><strong>AmbientLight 沉浸背景</strong><small>根据画面采样生成背景光</small></div><button class="switch" :class="{ checked: ambient }" @click="ambient = !ambient"><i></i></button></div><div class="setting-row"><div><strong>Windows + DRM 优先</strong><small>优先使用系统媒体能力播放受保护内容</small></div><span class="ready-pill">READY</span></div><div class="setting-row"><div><strong>安卓平板布局</strong><small>触控友好的导航与播放器控件</small></div><span class="ready-pill">BETA</span></div><button class="primary-button modal-button" @click="settingsOpen = false">完成 <span>→</span></button></section></div>
  </div>
</template>

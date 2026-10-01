<script setup>
// 带装扮的头像：底图 + 头像挂件 + 铭牌 + 大会员角标
// 挂件图由 nav.pendant.image 提供，按原包观感放大到约 1.7 倍居中覆盖；
// 有挂件时给底图加白色描边（bili_mine_avatar_border）。
import { computed } from 'vue'
import { brand } from '../brand.js'
import { mediaUrl } from '../bili.js'

const props = defineProps({
  src: { type: String, default: '' },
  size: { type: Number, default: 39 },
  pendant: { type: Object, default: null },
  vipIcon: { type: String, default: '' },
  round: { type: Boolean, default: true },
  nameplate: { type: Object, default: null },
  /** 未登录时用 APK 自带的占位头像 */
  guest: { type: Boolean, default: false },
})

const boxStyle = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }))
const imageSrc = computed(() => {
  if (props.src) return mediaUrl(props.src)
  return brand(props.guest ? 'bili_nologin_avatar.png' : 'ic-avatar.png')
})
</script>

<template>
  <span class="rp-av" :class="{ round, 'has-pendant': Boolean(pendant?.image) }" :style="boxStyle">
    <img class="rp-av-img" :src="imageSrc" alt="" loading="lazy" />
    <img v-if="pendant?.image" class="rp-av-pendant" :src="mediaUrl(pendant.image)" :alt="pendant.name || '装扮'" loading="lazy" />
    <img v-if="nameplate?.image" class="rp-av-nameplate" :src="mediaUrl(nameplate.image)" :alt="nameplate.name || '铭牌'" loading="lazy" />
    <img v-if="vipIcon" class="rp-av-vip" :src="mediaUrl(vipIcon)" alt="大会员" loading="lazy" />
  </span>
</template>

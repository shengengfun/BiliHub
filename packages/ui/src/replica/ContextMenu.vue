<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { closeMenu, menuState } from '../context-menu.js'

function onGlobalClick() {
  closeMenu()
}
function onKey(event) {
  if (event.key === 'Escape') closeMenu()
}

onMounted(() => {
  window.addEventListener('click', onGlobalClick)
  window.addEventListener('resize', onGlobalClick)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('click', onGlobalClick)
  window.removeEventListener('resize', onGlobalClick)
  window.removeEventListener('keydown', onKey)
})

function run(item) {
  closeMenu()
  item.action?.()
}
</script>

<template>
  <div
    v-if="menuState.visible"
    class="rp-menu"
    :style="{ left: `${menuState.x}px`, top: `${menuState.y}px` }"
    @click.stop
  >
    <template v-for="(item, index) in menuState.items" :key="index">
      <div v-if="item.divider" class="rp-menu-divider"></div>
      <button v-else class="rp-ctx-item" :class="{ danger: item.danger }" @click="run(item)">{{ item.label }}</button>
    </template>
  </div>
</template>

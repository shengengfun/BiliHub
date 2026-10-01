// 桌面端右键菜单：全局单例状态，由 ContextMenu.vue 渲染
import { reactive } from 'vue'

export const menuState = reactive({
  visible: false,
  x: 0,
  y: 0,
  items: [],
})

/**
 * @param {MouseEvent} event
 * @param {{ label?: string, danger?: boolean, divider?: boolean, action?: () => void }[]} items
 */
export function openMenu(event, items) {
  event.preventDefault()
  event.stopPropagation()
  menuState.items = items.filter(Boolean)
  menuState.x = event.clientX
  menuState.y = event.clientY
  menuState.visible = true

  // 贴边时向内收，避免菜单被裁掉
  const width = 176
  const height = menuState.items.length * 34 + 12
  if (menuState.x + width > window.innerWidth) menuState.x = Math.max(8, window.innerWidth - width - 8)
  if (menuState.y + height > window.innerHeight) menuState.y = Math.max(8, window.innerHeight - height - 8)
}

export function closeMenu() {
  menuState.visible = false
}

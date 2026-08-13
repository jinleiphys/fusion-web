import type { NavOperations, ShortcutOptions } from '@slidev/types'
import { defineShortcutsSetup } from '@slidev/types'

export default defineShortcutsSetup((nav: NavOperations, base: ShortcutOptions[]) => {
  // 将所有"下一页/上一页"快捷键统一改为"下一步/上一步"
  // 这样无论激光笔发送什么键，都会逐步触发 v-click 动画
  return base.map((shortcut) => {
    if (shortcut.name === 'next_down' || shortcut.name === 'next_shift') {
      return { ...shortcut, fn: () => nav.next(), autoRepeat: true }
    }
    if (shortcut.name === 'prev_up' || shortcut.name === 'prev_shift') {
      return { ...shortcut, fn: () => nav.prev(), autoRepeat: true }
    }
    return shortcut
  })
})

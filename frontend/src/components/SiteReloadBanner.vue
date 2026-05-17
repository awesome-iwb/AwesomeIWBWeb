<script setup lang="ts">
import { computed } from 'vue'
import {
  showSiteReloadBanner,
  siteReloadReason,
  reloadSiteForUpdate,
  dismissSiteReloadBanner,
} from '../siteReloadGate'

const message = computed(() => {
  if (siteReloadReason.value === 'sw') {
    return '离线应用（Service Worker）已更新，整站需刷新页面后才能生效，请勿仅依赖局部刷新。'
  }
  return '站点已发布新版本，整站需刷新页面后才能与服务器数据一致，请勿仅依赖局部刷新。'
})
</script>

<template>
  <div
    v-if="showSiteReloadBanner"
    role="status"
    class="fixed bottom-0 inset-x-0 z-[100] flex flex-wrap items-center justify-center gap-3 border-t border-amber-200/80 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-lg backdrop-blur-sm dark:border-amber-500/30 dark:bg-amber-950/90 dark:text-amber-50"
  >
    <span>{{ message }}</span>
    <button
      type="button"
      class="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
      @click="reloadSiteForUpdate"
    >
      立即刷新
    </button>
    <button
      type="button"
      class="rounded-md px-3 py-1.5 font-medium text-amber-900/80 underline-offset-2 hover:underline dark:text-amber-100/90"
      @click="dismissSiteReloadBanner"
    >
      稍后
    </button>
  </div>
</template>

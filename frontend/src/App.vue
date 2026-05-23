<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import CommandPalette from './components/CommandPalette.vue'
import SiteFooter from './components/SiteFooter.vue'
import MobileTabBar from './components/MobileTabBar.vue'
import SiteReloadBanner from './components/SiteReloadBanner.vue'
import { globalState } from './store'
import { useAuth } from './composables/useAuth'
import { checkRemoteBuildAndMaybePrompt } from './siteReloadGate'

const route = useRoute()

let disposeAuthSessionSync: (() => void) | null = null

const isHomePage = computed(() => route.path === '/')
const navBarTransparent = computed(() => isHomePage.value && !globalState.isScrolledPastSearch)

const isBackofficeRoute = computed(() => {
  const path = route.path;
  return path.startsWith('/admin') || path.startsWith('/dev') || path.startsWith('/ops');
});

const showMobileTabBar = computed(() => {
  if (isBackofficeRoute.value) return false
  const meta = route.meta as any
  if (!meta.showNavBar) return false
  if (meta.showBack) return false
  const path = route.path
  return path === '/' || path === '/today' || path === '/categories' || path === '/about'
})

let pollTimer: ReturnType<typeof setInterval> | null = null

/**
 * 前台/定时只做这一条链路：先 health（buildId）再可选 `/me`，避免与 useAuth 内重复的 focus/interval 两套轮询。
 */
async function runForegroundSiteSync() {
  if (typeof window === 'undefined') return
  const { isAuthenticated, refreshSession } = useAuth()
  try {
    await checkRemoteBuildAndMaybePrompt()
  } catch {
    /* ignore offline */
  }
  if (isAuthenticated.value) void refreshSession()
}

function onVisibilityForSiteSync() {
  if (document.visibilityState === 'visible') void runForegroundSiteSync()
}

onMounted(async () => {
  const { isAuthenticated, fetchUser, refreshSession, installAuthSessionLifecycle } = useAuth()
  if (!isAuthenticated.value) {
    await fetchUser()
  } else {
    void refreshSession()
  }

  disposeAuthSessionSync = installAuthSessionLifecycle({ deferForegroundAndIntervalToApp: true })

  void runForegroundSiteSync()
  pollTimer = window.setInterval(() => void runForegroundSiteSync(), 5 * 60 * 1000)
  window.addEventListener('focus', runForegroundSiteSync)
  document.addEventListener('visibilitychange', onVisibilityForSiteSync)
})

onBeforeUnmount(() => {
  disposeAuthSessionSync?.()
  disposeAuthSessionSync = null
  if (pollTimer != null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  window.removeEventListener('focus', runForegroundSiteSync)
  document.removeEventListener('visibilitychange', onVisibilityForSiteSync)
})
</script>

<template>
  <div
    class="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-foreground font-sans selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-indigo-100 transition-colors duration-300 relative overflow-x-clip flex flex-col"
    :class="isBackofficeRoute ? 'h-screen overflow-hidden' : ''"
  >
    <SiteReloadBanner />
    <!-- Global ambient background glows to enhance the glassmorphism effect -->
    <div class="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 dark:bg-indigo-600/10 blur-[120px] pointer-events-none z-0"></div>
    <div class="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/20 dark:bg-emerald-600/10 blur-[120px] pointer-events-none z-0"></div>
    <div class="fixed top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-pink-500/10 dark:bg-pink-600/5 blur-[100px] pointer-events-none z-0"></div>

    <NavBar 
      v-if="route.meta.showNavBar"
      :show-back="route.meta.showBack as boolean"
      :title="route.meta.title as string"
      :hide-search="false"
      :transparent="navBarTransparent"
      @open-search="globalState.isSearchOpen = true"
    />
    <CommandPalette 
      v-if="route.meta.showNavBar"
      :is-open="globalState.isSearchOpen" 
      @close="globalState.isSearchOpen = false" 
    />

    <div class="relative z-10 flex-1 w-full" :class="showMobileTabBar ? 'pb-16 md:pb-0' : ''">
      <router-view v-slot="{ Component }">
        <transition name="route-slide" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>

    <MobileTabBar v-if="showMobileTabBar" />
    <SiteFooter v-if="!isBackofficeRoute" />
  </div>
</template>

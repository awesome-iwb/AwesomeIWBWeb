<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import CommandPalette from './components/CommandPalette.vue'
import SiteFooter from './components/SiteFooter.vue'
import { globalState } from './store'
import { useAuth } from './composables/useAuth'

const route = useRoute()

onMounted(async () => {
  const { isAuthenticated, fetchUser } = useAuth()
  if (!isAuthenticated.value) {
    await fetchUser()
  }
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-indigo-100 transition-colors duration-300 relative overflow-x-clip flex flex-col">
    <!-- Global ambient background glows to enhance the glassmorphism effect -->
    <div class="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 dark:bg-indigo-600/10 blur-[120px] pointer-events-none z-0"></div>
    <div class="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/20 dark:bg-emerald-600/10 blur-[120px] pointer-events-none z-0"></div>
    <div class="fixed top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-pink-500/10 dark:bg-pink-600/5 blur-[100px] pointer-events-none z-0"></div>

    <NavBar 
      v-if="route.meta.showNavBar"
      :show-back="route.meta.showBack as boolean"
      :title="route.meta.title as string"
      :hide-search="false"
      @open-search="globalState.isSearchOpen = true"
    />
    <CommandPalette 
      v-if="route.meta.showNavBar"
      :is-open="globalState.isSearchOpen" 
      @close="globalState.isSearchOpen = false" 
    />

    <div class="relative z-10 flex-1 w-full">
      <router-view v-slot="{ Component }">
        <transition name="route-slide" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>

    <SiteFooter />
  </div>
</template>

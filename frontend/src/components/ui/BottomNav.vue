<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
    :style="{
      height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }"
  >
    <div
      class="absolute inset-0 bg-white/70 dark:bg-slate-900/70 border-t border-white/60 dark:border-slate-700/60"
      :style="{ backdropFilter: 'blur(var(--blur-glass))', WebkitBackdropFilter: 'blur(var(--blur-glass))' }"
    />

    <div class="relative grid grid-cols-5 h-[56px]">
      <router-link
        v-for="item in visiblePrimaryItems"
        :key="item.key"
        :to="item.to"
        class="relative flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform duration-150"
        :class="activeKey === item.key ? 'text-[var(--color-brand-500)]' : 'text-muted-foreground'"
      >
        <div
          v-if="activeKey === item.key"
          class="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-[var(--color-brand-500)]"
        />
        <component :is="item.icon" class="w-5 h-5" />
        <span class="text-[10px] font-medium leading-none">{{ item.label }}</span>
      </router-link>

      <button
        @click="moreOpen = true"
        class="relative flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform duration-150 text-muted-foreground"
      >
        <component :is="Menu" class="w-5 h-5" />
        <span class="text-[10px] font-medium leading-none">更多</span>
      </button>
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="moreOpen" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" @click="moreOpen = false" />
      </Transition>
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-y-full"
        enter-to-class="translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-y-0"
        leave-to-class="translate-y-full"
      >
        <div
          v-if="moreOpen"
          class="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border shadow-2xl shadow-slate-900/10 dark:shadow-black/30"
        >
          <div class="w-10 h-1 rounded-full bg-muted mx-auto mt-3" />

          <div v-if="secondaryItems.length > 0" class="grid grid-cols-3 gap-2 p-4">
            <router-link
              v-for="item in secondaryItems"
              :key="item.key"
              :to="item.to"
              @click="moreOpen = false"
              class="flex flex-col items-center gap-1.5 p-3 rounded-xl text-muted-foreground hover:bg-accent transition-colors"
              :class="activeKey === item.key && 'text-[var(--color-brand-500)]'"
            >
              <component :is="item.icon" class="w-5 h-5" />
              <span class="text-xs font-medium">{{ item.label }}</span>
            </router-link>
          </div>

          <div v-if="secondaryItems.length > 0" class="mx-4 border-t border-border" />

          <div class="p-4 space-y-2">
            <div v-if="userName" class="px-3 py-2 text-sm font-medium text-foreground">
              {{ userName }}
            </div>
            <router-link
              to="/"
              @click="moreOpen = false"
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              <Home class="w-4 h-4" />
              返回首页
            </router-link>
            <button
              @click="handleLogout"
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors w-full"
            >
              <LogOut class="w-4 h-4" />
              退出登录
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Menu, Home, LogOut } from 'lucide-vue-next';

const props = defineProps<{
  primaryItems: Array<{ key: string; label: string; to: string; icon: any }>;
  secondaryItems: Array<{ key: string; label: string; to: string; icon: any }>;
  activeKey?: string;
  userName?: string;
}>();

const emit = defineEmits<{
  logout: [];
}>();

const moreOpen = ref(false);

const visiblePrimaryItems = computed(() => props.primaryItems.slice(0, 4));

function handleLogout() {
  moreOpen.value = false;
  emit('logout');
}
</script>

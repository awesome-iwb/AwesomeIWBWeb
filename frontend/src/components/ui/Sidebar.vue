<template>
  <aside
    class="hidden lg:flex flex-col h-full shrink-0 transition-all duration-300
      bg-white/72 dark:bg-slate-900/62 backdrop-blur-xl
      border-r border-white/70 dark:border-slate-700/70"
    :class="collapsed ? 'w-16' : 'w-60'"
  >
    <div class="p-4 border-b border-border">
      <div v-if="!collapsed" class="flex items-center gap-2.5">
        <img src="/apple-touch-icon.png" alt="Awesome IWB" class="w-8 h-8 object-contain shrink-0" />
        <span class="text-sm font-bold bg-gradient-to-r from-[var(--color-brand-gradient-from)] to-[var(--color-brand-gradient-to)] bg-clip-text text-transparent">{{ brandName }}</span>
      </div>
      <div v-else class="flex justify-center">
        <img src="/apple-touch-icon.png" alt="Awesome IWB" class="w-8 h-8 object-contain" />
      </div>
    </div>

    <nav class="flex-1 overflow-y-auto p-3 space-y-1">
      <template v-for="(group, groupIdx) in navGroups" :key="groupIdx">
        <div v-if="groupIdx > 0" class="my-2 border-t border-border" />
        <router-link
          v-for="item in group"
          :key="item.key"
          :to="item.to"
          :title="collapsed ? item.label : undefined"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors active:scale-[0.98]"
          :class="[
            activeKey === item.key
              ? 'bg-[var(--color-brand-500)] text-white shadow-md shadow-[var(--color-brand-shadow)]'
              : 'text-muted-foreground hover:bg-accent',
            collapsed && 'justify-center px-0',
          ]"
        >
          <component :is="item.icon" class="w-5 h-5 shrink-0" />
          <span v-if="!collapsed">{{ item.label }}</span>
        </router-link>
      </template>

      <div class="pt-2">
        <button
          @click="collapsed = !collapsed"
          class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
        >
          <component :is="collapsed ? ChevronRight : ChevronLeft" class="w-4 h-4" />
          <span v-if="!collapsed">收起侧栏</span>
        </button>
      </div>
    </nav>

    <div class="p-3 border-t border-border">
      <div v-if="!collapsed && user" class="flex items-center gap-3">
        <Avatar class="w-8 h-8">
          <AvatarImage :src="user.avatar_url ?? ''" :alt="user.name ?? ''" />
          <AvatarFallback>{{ user.name?.charAt(0)?.toUpperCase() || '?' }}</AvatarFallback>
        </Avatar>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-foreground truncate">{{ user.name }}</p>
        </div>
        <button
          @click="$emit('logout')"
          class="w-8 h-8 rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
        >
          <LogOut class="w-4 h-4" />
        </button>
      </div>
      <div v-else-if="collapsed && user" class="flex justify-center">
        <Avatar class="w-8 h-8">
          <AvatarImage :src="user.avatar_url ?? ''" :alt="user.name ?? ''" />
          <AvatarFallback>{{ user.name?.charAt(0)?.toUpperCase() || '?' }}</AvatarFallback>
        </Avatar>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-vue-next';
import { Avatar, AvatarImage, AvatarFallback } from './avatar';

const props = defineProps<{
  brandName: string;
  items: Array<{ key: string; label: string; to: string; icon: any; group?: 'primary' | 'secondary' }>;
  user?: { name: string; avatar_url?: string };
  activeKey?: string;
}>();

defineEmits<{
  logout: [];
}>();

const collapsed = ref(false);

const navGroups = computed(() => {
  const primary = props.items.filter(i => (i.group ?? 'primary') === 'primary');
  const secondary = props.items.filter(i => i.group === 'secondary');
  return secondary.length > 0 ? [primary, secondary] : [primary];
});
</script>

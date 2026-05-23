<template>
  <div
    :data-brand="brand"
    class="h-dvh bg-[var(--color-bg-page)] text-foreground flex overflow-hidden"
    style="padding-bottom: env(safe-area-inset-bottom); padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right);"
  >
    <ui-Sidebar
      :brand-name="brandName"
      :items="sidebarItems"
      :user="user"
      :active-key="activeKey"
      @logout="$emit('logout')"
    />

    <div class="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
      <ui-BackHeader
        :title="pageTitle"
        :user-name="user?.name"
        :show-back="isMobile"
        @go-home="$emit('goHome')"
        @logout="$emit('logout')"
        @back="router.back()"
      />

      <main
        ref="mainRef"
        class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-2 pb-20 px-3 lg:pt-4 lg:pb-6 lg:px-6"
        :style="mainStyle"
      >
        <router-view class="block" />
      </main>
    </div>

    <ui-BottomNav
      :primary-items="primaryItems"
      :secondary-items="secondaryItems"
      :active-key="activeKey"
      :user-name="user?.name"
      @logout="$emit('logout')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMediaQuery } from '@vueuse/core';
import { Sidebar as uiSidebar, BackHeader as uiBackHeader, BottomNav as uiBottomNav } from './index';

const mainRef = ref<HTMLElement | null>(null);
const keyboardHeight = ref(0);

const mainStyle = computed(() => {
  if (keyboardHeight.value > 0) {
    return {
      paddingBottom: `calc(var(--space-md) + ${keyboardHeight.value}px)`,
    };
  }
  return {};
});

void mainRef;

const handleVisualViewport = () => {
  if (!window.visualViewport) return;
  const vv = window.visualViewport;
  const diff = window.innerHeight - vv.height;
  keyboardHeight.value = diff > 100 ? diff : 0;
};

onMounted(() => {
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleVisualViewport);
    window.visualViewport.addEventListener('scroll', handleVisualViewport);
    handleVisualViewport();
  }
});

onUnmounted(() => {
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleVisualViewport);
    window.visualViewport.removeEventListener('scroll', handleVisualViewport);
  }
});

export type NavItem = {
  key: string;
  label: string;
  to: string;
  icon: any;
  group?: 'primary' | 'secondary';
  primary?: boolean;
  cap?: string;
  anyCaps?: string[];
};

const props = withDefaults(defineProps<{
  brand: 'admin' | 'dev';
  brandName: string;
  sidebarItems: NavItem[];
  user?: { name: string; avatar_url?: string };
}>(), {});

defineEmits<{
  logout: [];
  goHome: [];
}>();

const route = useRoute();
const router = useRouter();
const isMobile = useMediaQuery('(max-width: 1023px)');

const pageTitle = computed(() => {
  const meta = route.meta as any;
  return meta?.title || brandName;
});

const brandName = computed(() => props.brandName);

const activeKey = computed(() => {
  const path = route.path;
  for (const item of props.sidebarItems) {
    if (item.key === 'dashboard') {
      if (path === `/${props.brand}` || path === `/${props.brand}/dashboard`) return item.key;
      continue;
    }
    if (path === item.to || path.startsWith(`${item.to}/`)) return item.key;
    if (item.key === 'review' && path.startsWith(`/${props.brand}/review`)) return item.key;
    if (item.key === 'developers' && path.startsWith(`/${props.brand}/developers`)) return item.key;
  }
  return '';
});

const primaryItems = computed(() =>
  props.sidebarItems.filter(item => item.group === 'primary').slice(0, 4)
);

const secondaryItems = computed(() =>
  props.sidebarItems.filter(item => item.group === 'secondary')
);
</script>

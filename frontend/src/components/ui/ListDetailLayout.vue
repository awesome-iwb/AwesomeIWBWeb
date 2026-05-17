<template>
  <div class="h-full min-h-0 flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(280px,340px)_1fr] lg:gap-6">
    <section
      class="min-h-0 bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xl shadow-slate-900/8 dark:shadow-black/30 overflow-hidden flex flex-col"
      :class="isStacked ? (mobileView === 'list' ? 'flex-1' : 'hidden') : 'lg:h-full'"
    >
      <div class="shrink-0 px-4 pt-4 pb-3 border-b border-slate-100/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div v-if="listTitle" class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ listTitle }}</div>
          </div>
        </div>

        <div v-if="searchable || $slots['list-toolbar']" class="space-y-3">
          <div v-if="searchable" class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              :value="searchModel"
              :placeholder="searchPlaceholder"
              class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:border-[var(--color-brand-500)] transition-colors placeholder:text-slate-400"
              @input="emit('update:searchModel', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div v-if="$slots['list-toolbar']">
            <slot name="list-toolbar" />
          </div>
        </div>
      </div>

      <div ref="listScrollEl" class="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        <slot name="list" />

        <div v-if="infinite" class="space-y-3 pb-1">
          <div ref="sentinelEl" class="h-px w-full" />
          <button
            v-if="hasMore"
            type="button"
            class="w-full px-4 py-3 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            :disabled="loadingMore"
            @click="emit('load-more')"
          >
            {{ loadingMore ? '加载中...' : '加载更多' }}
          </button>
          <div v-else-if="(total ?? 0) > 0" class="text-center text-xs text-slate-400 py-2">已加载全部</div>
        </div>
      </div>

      <div v-if="!infinite && (total ?? 0) > 0" class="shrink-0 px-4 pb-4 pt-1">
        <Pagination
          :page="page ?? 1"
          :total="total ?? 0"
          :page-size="pageSize ?? 20"
          @update:page="emit('update:page', $event)"
        />
      </div>
    </section>

    <section
      class="min-h-0 bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-2xl border border-slate-200/80 dark:border-slate-700/70 shadow-xl shadow-slate-900/8 dark:shadow-black/30 overflow-hidden flex flex-col"
      :class="isStacked ? (mobileView === 'capsule' ? 'flex-1 min-h-0' : 'hidden') : 'lg:h-full'"
    >
      <button
        v-if="isStacked && mobileView === 'capsule' && hasSelection"
        type="button"
        class="shrink-0 mx-3 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-2xl
          bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl
          border border-white/70 dark:border-slate-700/70
          shadow-lg shadow-slate-900/8 dark:shadow-black/20
          active:scale-[0.98] transition-all duration-200"
        @click="mobileView = 'list'"
      >
        <component v-if="selectedItemIcon" :is="selectedItemIcon" class="w-4 h-4 text-[var(--color-brand-500)] shrink-0" />
        <span class="flex-1 text-left text-sm font-medium text-slate-900 dark:text-white truncate">{{ selectedItemLabel || '已选择项目' }}</span>
        <ChevronDown class="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      <div v-if="hasSelection" class="flex-1 min-h-0 overflow-y-auto">
        <slot name="detail" />
      </div>
      <div v-else class="flex-1 min-h-0 flex items-center justify-center px-4 py-8">
        <slot name="empty-detail">
          <div class="flex flex-col items-center gap-4 py-16 px-6">
            <div class="w-16 h-16 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 flex items-center justify-center">
              <Search class="w-7 h-7 text-slate-300 dark:text-slate-600" />
            </div>
            <div class="text-center">
              <p class="text-sm font-bold text-slate-400 dark:text-slate-500">请选择一项查看详情</p>
              <p class="text-xs text-slate-300 dark:text-slate-600 mt-1">从左侧列表中选择一个项目</p>
            </div>
          </div>
        </slot>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { ChevronDown, Search } from 'lucide-vue-next';
import Pagination from './Pagination.vue';
import EmptyState from './EmptyState.vue';

const props = withDefaults(defineProps<{
  selectedId?: string | null;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchModel?: string;
  page?: number;
  total?: number;
  pageSize?: number;
  listTitle?: string;
  detailTitle?: string;
  infinite?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  selectedItemLabel?: string;
  selectedItemIcon?: any;
}>(), {
  searchPlaceholder: '搜索...',
  pageSize: 20,
  infinite: false,
  hasMore: false,
  loadingMore: false,
});

const emit = defineEmits<{
  'update:page': [page: number];
  'update:searchModel': [value: string];
  select: [id: string];
  back: [];
  'load-more': [];
}>();

const isStacked = useMediaQuery('(max-width: 1023px)');
const mobileView = ref<'list' | 'capsule'>('list');
const hasSelection = computed(() => props.selectedId != null && props.selectedId !== '');
const listScrollEl = ref<HTMLElement | null>(null);
const sentinelEl = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

watch(() => props.selectedId, (newId) => {
  if (isStacked.value) {
    mobileView.value = newId ? 'capsule' : 'list';
  }
});

watch(isStacked, (stacked) => {
  if (!stacked) {
    mobileView.value = 'list';
  }
});

const stopObserving = () => {
  observer?.disconnect();
  observer = null;
};

const startObserving = () => {
  stopObserving();
  if (!props.infinite || !props.hasMore || props.loadingMore || mobileView.value !== 'list') return;
  const root = listScrollEl.value;
  const target = sentinelEl.value;
  if (!root || !target || typeof IntersectionObserver === 'undefined') return;
  observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (entry?.isIntersecting && props.hasMore && !props.loadingMore && mobileView.value === 'list') {
      emit('load-more');
    }
  }, {
    root,
    rootMargin: '160px 0px 120px 0px',
    threshold: 0.01,
  });
  observer.observe(target);
};


watch(
  [() => props.infinite, () => props.hasMore, () => props.loadingMore, mobileView, listScrollEl, sentinelEl],
  async () => {
    await nextTick();
    startObserving();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopObserving();
});
</script>

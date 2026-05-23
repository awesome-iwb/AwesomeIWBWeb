<template>
  <div class="h-full min-h-0 flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(280px,340px)_1fr] lg:gap-6">
    <section
      class="min-h-0 bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col"
      :class="isStacked ? (mobileView === 'list' ? 'flex-1' : 'hidden') : 'lg:h-full'"
    >
      <div class="shrink-0 px-4 pt-4 pb-3 border-b border-border bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div v-if="listTitle" class="text-sm font-bold text-foreground truncate">{{ listTitle }}</div>
          </div>
        </div>

        <div v-if="searchable || $slots['list-toolbar']" class="space-y-3">
          <div v-if="searchable" class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              :value="searchModel"
              :placeholder="searchPlaceholder"
              class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-[var(--color-brand-500)] transition-colors placeholder:text-muted-foreground"
              @input="emit('update:searchModel', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div v-if="$slots['list-toolbar']">
            <slot name="list-toolbar" />
          </div>
        </div>
      </div>

      <div ref="listScrollEl" class="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 list-container">
        <slot name="list" />

        <div v-if="infinite" class="space-y-3 pb-1">
          <div ref="sentinelEl" class="h-px w-full" />
          <button
            v-if="hasMore"
            type="button"
            class="w-full px-4 py-3 rounded-2xl bg-secondary/90 text-foreground text-sm font-bold hover:bg-accent transition-colors disabled:opacity-50"
            :disabled="loadingMore"
            @click="emit('load-more')"
          >
            {{ loadingMore ? '加载中...' : '加载更多' }}
          </button>
          <div v-else-if="(total ?? 0) > 0" class="text-center text-xs text-muted-foreground py-2">已加载全部</div>
        </div>
      </div>

      <div v-if="!infinite && (total ?? 0) > 0" class="shrink-0 px-4 pb-4 pt-1">
        <Pagination :page="page ?? 1" :total="Math.ceil((total ?? 0) / (pageSize ?? 20))" :items-per-page="1" :sibling-count="1" @update:page="emit('update:page', $event)">
          <PaginationList v-slot="{ items }" class="flex items-center gap-1">
            <PaginationPrev />
            <template v-for="(item, index) in items" :key="index">
              <PaginationListItem v-if="item.type === 'page'" :value="item.value" as-child>
                <Button variant="outline" class="w-9 h-9" :class="item.value === page ? 'bg-[var(--color-brand-500)] text-white border-[var(--color-brand-500)]' : ''">{{ item.value }}</Button>
              </PaginationListItem>
              <PaginationEllipsis v-else :index="index" />
            </template>
            <PaginationNext />
          </PaginationList>
        </Pagination>
      </div>
    </section>

    <section
      class="min-h-0 bg-white/72 dark:bg-slate-900/62 backdrop-blur-lg rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col"
      :class="[
        isStacked ? (mobileView === 'capsule' ? 'flex-1 min-h-0' : 'hidden') : 'lg:h-full',
        isStacked ? 'slide-panel' : '',
      ]"
    >
      <button
        v-if="isStacked && mobileView === 'capsule' && hasSelection"
        type="button"
        class="shrink-0 mx-3 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl
          bg-card/80 backdrop-blur-xl
          border border-white/70 dark:border-slate-700/70
          shadow-sm
          active:scale-[0.98] transition-all duration-200"
        @click="handleBack"
      >
        <component v-if="selectedItemIcon" :is="selectedItemIcon" class="w-4 h-4 text-[var(--color-brand-500)] shrink-0" />
        <span class="flex-1 text-left text-sm font-medium text-foreground truncate">{{ selectedItemLabel || '已选择项目' }}</span>
        <ChevronDown class="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      <div v-if="hasSelection" class="flex-1 min-h-0 overflow-y-auto">
        <slot name="detail" />
      </div>
      <div v-else class="flex-1 min-h-0 flex items-center justify-center px-4 py-8">
        <slot name="empty-detail">
          <EmptyState
            :icon="Search"
            title="请选择一项查看详情"
            description="从左侧列表中选择一个项目"
            container-class="py-16 px-6"
          />
        </slot>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { ChevronDown, Search } from 'lucide-vue-next';
import { Pagination, PaginationList, PaginationListItem, PaginationPrev, PaginationNext, PaginationEllipsis } from './pagination';
import { Button } from './button';
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
let savedScrollTop = 0;

watch(() => props.selectedId, (newId) => {
  if (isStacked.value) {
    if (newId) {
      savedScrollTop = listScrollEl.value?.scrollTop ?? 0;
      mobileView.value = 'capsule';
    } else {
      mobileView.value = 'list';
    }
  }
});

watch(mobileView, async (view) => {
  if (view === 'list') {
    await nextTick();
    if (listScrollEl.value) {
      listScrollEl.value.scrollTop = savedScrollTop;
    }
  }
});

watch(isStacked, (stacked) => {
  if (!stacked) {
    mobileView.value = 'list';
  }
});

const handleBack = () => {
  mobileView.value = 'list';
  emit('back');
};

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

<style scoped>
.slide-panel {
  animation: slideInFromRight 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .slide-panel {
    animation: none;
  }
}

.list-container > * {
  min-height: var(--touch-min-height);
}

@media (min-width: 1024px) {
  .list-container > * {
    min-height: 0;
  }
}
</style>

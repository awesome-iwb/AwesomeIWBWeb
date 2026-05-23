<template>
  <div class="flex flex-col h-full min-h-0 w-full">
    <!-- 移动端：已选条目时的顶栏 -->
    <div
      v-if="!isLg && selectedLabel"
      class="lg:hidden shrink-0 sticky top-0 z-20 -mx-1 mb-3 px-1 py-2 flex items-center gap-2 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-border shadow-sm"
    >
      <button
        type="button"
        class="shrink-0 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold inline-flex items-center gap-1.5 transition-colors"
        @click="openList"
      >
        <List class="w-4 h-4" />
        列表
      </button>
      <div class="flex-1 min-w-0 font-semibold text-sm text-foreground truncate">
        {{ selectedLabel }}
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button
          v-if="prevEnabled"
          type="button"
          class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
          @click="$emit('prev')"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>
        <button
          v-if="nextEnabled"
          type="button"
          class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
          @click="$emit('next')"
        >
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
    </div>

    <div
      class="flex flex-col flex-1 min-h-0 gap-4 lg:grid lg:grid-cols-[minmax(280px,340px)_1fr] lg:gap-6"
    >
      <aside
        v-if="showListAside"
        class="flex flex-col min-h-0 min-w-0"
        :class="listAsideClass"
      >
        <div
          class="shrink-0 sticky top-2 z-20 mx-3 sm:mx-4 mt-2 w-[calc(100%-1.5rem)] sm:w-auto self-center sm:self-stretch
            bg-white/92 dark:bg-slate-800/92 backdrop-blur-md
            border border-border
            shadow-lg shadow-slate-900/8 dark:shadow-black/30
            rounded-2xl overflow-hidden"
        >
          <div
            class="flex items-center gap-1 px-2 sm:px-3"
            :class="hasToolbar && !toolbarExpanded ? 'py-2' : 'min-h-[44px] h-11 sm:h-12'"
          >
            <button
              type="button"
              class="flex-1 min-w-0 flex items-center gap-2 px-2 rounded-xl text-left transition-colors hover:bg-accent/80 dark:hover:bg-slate-700/40 disabled:cursor-default disabled:hover:bg-transparent"
              :aria-expanded="hasToolbar ? toolbarExpanded : undefined"
              :aria-label="hasToolbar ? (toolbarExpanded ? '收起筛选' : '展开筛选') : undefined"
              :disabled="!hasToolbar"
              @click="toggleToolbarExpanded"
            >
              <span class="text-sm font-bold text-foreground truncate shrink-0 max-w-[42%] sm:max-w-none">
                {{ listLabel || '列表' }}
                <span v-if="count != null" class="text-muted-foreground font-medium">({{ count }})</span>
              </span>
              <span v-if="hasToolbar" class="hidden sm:inline text-muted-foreground shrink-0" aria-hidden="true">·</span>
              <span v-if="hasToolbar" class="flex-1 min-w-0 text-xs sm:text-sm text-muted-foreground truncate">
                {{ collapsedSummary }}
              </span>
              <span
                v-if="hasToolbar"
                class="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-muted-foreground"
              >
                <ChevronDown class="w-4 h-4 transition-transform duration-200" :class="toolbarExpanded ? 'rotate-180' : ''" />
              </span>
            </button>
            <div class="flex items-center gap-0.5 shrink-0 pr-1">
              <button
                v-if="prevEnabled"
                type="button"
                class="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
                @click="$emit('prev')"
              >
                <ChevronLeft class="w-4 h-4" />
              </button>
              <button
                v-if="nextEnabled"
                type="button"
                class="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
                @click="$emit('next')"
              >
                <ChevronRight class="w-4 h-4" />
              </button>
              <button
                v-if="!isLg && mobileListOverlay"
                type="button"
                class="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
                aria-label="关闭列表"
                @click="closeList"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          <p
            v-if="isLg && (selectedLabel || placeholder)"
            class="px-4 -mt-1 pb-2 text-xs truncate"
            :class="selectedLabel ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'"
          >
            {{ selectedLabel || placeholder }}
          </p>

          <div
            v-if="hasToolbar"
            class="grid transition-[grid-template-rows] duration-200 ease-out border-t border-slate-100/80 dark:border-slate-700/80"
            :class="toolbarExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
          >
            <div class="overflow-hidden min-h-0">
              <div class="px-4 pb-4 pt-3">
                <slot name="list-toolbar" />
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 pt-2 pb-4">
          <slot name="list" />
        </div>
      </aside>

      <section class="flex flex-col min-h-0 min-w-0" :class="contentSectionClass">
        <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <slot name="content" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, useSlots } from 'vue';
import { ChevronLeft, ChevronRight, ChevronDown, List, X } from 'lucide-vue-next';

const props = defineProps<{
  selectedLabel?: string;
  placeholder?: string;
  listLabel?: string;
  filterSummary?: string;
  count?: number;
  prevEnabled?: boolean;
  nextEnabled?: boolean;
}>();

defineEmits<{
  prev: [];
  next: [];
}>();

const slots = useSlots();
const isLg = ref(false);
const mobileListOpen = ref(false);
const toolbarExpanded = ref(false);
let mq: MediaQueryList | null = null;

const syncBreakpoint = () => {
  isLg.value = mq?.matches ?? window.innerWidth >= 1024;
};

onMounted(() => {
  mq = window.matchMedia('(min-width: 1024px)');
  syncBreakpoint();
  mq.addEventListener('change', syncBreakpoint);
});

onUnmounted(() => {
  mq?.removeEventListener('change', syncBreakpoint);
});

watch(
  () => props.selectedLabel,
  (label) => {
    if (label && !isLg.value) mobileListOpen.value = false;
  }
);

const hasToolbar = computed(() => !!slots['list-toolbar']);

const collapsedSummary = computed(() => {
  if (props.filterSummary?.trim()) return props.filterSummary.trim();
  return '筛选与搜索';
});

const mobileListOverlay = computed(() => !isLg.value && mobileListOpen.value && !!props.selectedLabel);

const showListAside = computed(() => {
  if (isLg.value) return true;
  if (!props.selectedLabel) return true;
  return mobileListOpen.value;
});

const listAsideClass = computed(() => {
  if (mobileListOverlay.value) {
    return [
      'fixed left-4 right-4 top-14 z-50 pointer-events-auto',
      'max-h-[70vh]',
      'rounded-2xl border border-border',
      'bg-white/98 dark:bg-slate-800/98 backdrop-blur-md',
      'shadow-2xl shadow-slate-900/15 dark:shadow-black/40',
    ].join(' ');
  }
  if (!isLg.value && props.selectedLabel) return 'hidden';
  return 'max-h-full lg:max-h-none lg:h-full bg-transparent';
});

const contentSectionClass = computed(() => {
  if (!isLg.value && !props.selectedLabel) return 'hidden';
  return 'flex-1';
});

const toggleToolbarExpanded = () => {
  if (!hasToolbar.value) return;
  toolbarExpanded.value = !toolbarExpanded.value;
};

const setExpanded = (open: boolean) => {
  if (isLg.value) {
    toolbarExpanded.value = open;
  } else {
    mobileListOpen.value = open;
  }
};

const openList = () => setExpanded(true);
const closeList = () => {
  mobileListOpen.value = false;
  toolbarExpanded.value = false;
};

const openPanel = openList;
const expandList = () => {
  toolbarExpanded.value = true;
};
const toggleListCollapse = toggleToolbarExpanded;

defineExpose({
  openList,
  closeList,
  openPanel,
  expandList,
  toggleListCollapse,
  toggleToolbarExpanded,
  toolbarExpanded,
  get listCollapsed() {
    return !toolbarExpanded.value;
  },
  get expanded() {
    return isLg.value ? toolbarExpanded.value : mobileListOpen.value;
  },
  set expanded(v: boolean) {
    setExpanded(!!v);
  },
});
</script>

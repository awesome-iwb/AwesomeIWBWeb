<template>
  <div ref="containerRef" class="relative">
    <div class="flex items-center rounded-xl border border-border bg-card transition-colors focus-within:border-emerald-500 min-h-[48px] md:min-h-[40px]">
      <input
        v-model="inputText"
        @input="onInput"
        @focus="onFocus"
        :placeholder="selectedLabel || placeholder"
        class="w-full px-3 py-2 rounded-xl bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        v-if="clearable && modelValue"
        @click="clear"
        class="flex-shrink-0 px-3 md:px-2 py-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 md:w-4 md:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div
      v-if="dropdownOpen"
      class="fixed inset-x-0 bottom-0 top-auto md:absolute md:left-0 md:right-0 md:top-full md:bottom-auto md:mt-1 md:rounded-xl rounded-t-xl border border-border bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.15)] md:shadow-lg z-50 overflow-hidden max-h-[80vh] md:max-h-60"
    >
      <div class="flex items-center justify-between px-4 py-3 md:hidden border-b border-border">
        <span class="text-base font-medium text-foreground">选择选项</span>
        <button @click="dropdownOpen = false" class="p-2 -mr-2 text-muted-foreground hover:text-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div v-if="loading" class="px-4 py-4 md:px-3 md:py-2 text-sm text-slate-400">搜索中...</div>
      <div v-else-if="results.length > 0" class="overflow-y-auto py-1" :class="isMobile ? 'max-h-[calc(80vh-60px)]' : 'max-h-60'">
        <button
          v-for="item in results"
          :key="item.id"
          @click="selectItem(item)"
          class="w-full flex items-center gap-3 md:gap-2 px-4 md:px-3 py-3.5 md:py-2 text-sm md:text-sm text-left hover:bg-accent transition-colors min-h-[44px]"
        >
          <img v-if="item.avatar" :src="item.avatar" class="w-8 h-8 md:w-6 md:h-6 rounded-full object-cover flex-shrink-0" />
          <div class="min-w-0 flex-1 flex flex-col text-left">
            <span class="text-base md:text-sm text-foreground truncate">{{ item.label }}</span>
            <span v-if="item.subtitle" class="text-sm md:text-xs text-muted-foreground truncate">{{ item.subtitle }}</span>
          </div>
        </button>
      </div>
      <div v-else-if="inputText.length > 0" class="px-4 py-4 md:px-3 md:py-2 text-sm text-muted-foreground">无匹配结果</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

type SearchItem = { id: string; label: string; subtitle?: string; avatar?: string };

const props = withDefaults(defineProps<{
  modelValue: string | null;
  searchFn: (query: string) => Promise<SearchItem[]>;
  placeholder?: string;
  clearable?: boolean;
  initialLabel?: string;
}>(), {
  placeholder: '搜索...',
  clearable: true,
  initialLabel: '',
});

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

const containerRef = ref<HTMLElement | null>(null);
const inputText = ref('');
const selectedLabel = ref('');
const results = ref<SearchItem[]>([]);
const loading = ref(false);
const dropdownOpen = ref(false);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const isMobile = computed(() => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
});

const onInput = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!inputText.value.trim()) {
    results.value = [];
    dropdownOpen.value = true;
    return;
  }
  debounceTimer = setTimeout(async () => {
    loading.value = true;
    dropdownOpen.value = true;
    try {
      results.value = await props.searchFn(inputText.value.trim());
    } catch {
      results.value = [];
    } finally {
      loading.value = false;
    }
  }, 300);
};

const onFocus = () => {
  dropdownOpen.value = true;
  if (modelValue.value && selectedLabel.value) {
    inputText.value = '';
  }
  if (inputText.value.trim()) {
    onInput();
  }
};

const selectItem = (item: SearchItem) => {
  emit('update:modelValue', item.id);
  selectedLabel.value = item.subtitle ? `${item.label} · ${item.subtitle}` : item.label;
  inputText.value = '';
  dropdownOpen.value = false;
  results.value = [];
};

const clear = () => {
  emit('update:modelValue', null);
  selectedLabel.value = '';
  inputText.value = '';
  dropdownOpen.value = false;
  results.value = [];
};

const onClickOutside = (e: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false;
    if (props.modelValue && selectedLabel.value) {
      inputText.value = '';
    }
  }
};

const modelValue = computed(() => props.modelValue);

onMounted(() => {
  document.addEventListener('click', onClickOutside, true);
});

watch(
  () => [props.modelValue, props.initialLabel] as const,
  ([id, label]) => {
    if (!id) {
      selectedLabel.value = '';
      inputText.value = '';
    } else if (label) {
      selectedLabel.value = label;
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true);
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

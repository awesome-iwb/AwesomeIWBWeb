<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { X, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import type { GalleryItem } from '../../composables/useProjects';

const props = defineProps<{
  items: GalleryItem[];
  startIndex: number;
  /** 可进入灯箱的下标（只有图片项）。顺序即浏览顺序。 */
  imageIndexes: number[];
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

/** 在 imageIndexes 里的位置，而不是 items 里的位置 —— 翻页只在图片之间走。 */
const cursor = ref(Math.max(0, props.imageIndexes.indexOf(props.startIndex)));

const current = computed<GalleryItem | null>(() => {
  const itemIndex = props.imageIndexes[cursor.value];
  return itemIndex === undefined ? null : (props.items[itemIndex] ?? null);
});

const total = computed(() => props.imageIndexes.length);
const hasMultiple = computed(() => total.value > 1);

const step = (delta: number) => {
  if (total.value === 0) return;
  cursor.value = (cursor.value + delta + total.value) % total.value;
};

const dialogRef = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    step(1);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    step(-1);
  } else if (e.key === 'Tab') {
    // 焦点困在弹层里，否则 Tab 会跑到被遮住的页面内容上
    const focusables = dialogRef.value?.querySelectorAll<HTMLElement>('button');
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
};

onMounted(() => {
  previouslyFocused = document.activeElement as HTMLElement | null;
  document.addEventListener('keydown', onKeydown);
  // 打开期间锁住背景滚动，否则滚轮会滚穿到下面的页面
  document.body.style.overflow = 'hidden';
  dialogRef.value?.querySelector('button')?.focus();
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
  previouslyFocused?.focus?.();
});
</script>

<template>
  <Teleport to="body">
    <div
      ref="dialogRef"
      class="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      :aria-label="current?.title || '详情图预览'"
      @click.self="emit('close')"
    >
      <button
        type="button"
        class="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        aria-label="关闭预览"
        @click="emit('close')"
      >
        <X class="w-6 h-6" />
      </button>

      <button
        v-if="hasMultiple"
        type="button"
        class="absolute left-2 sm:left-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        aria-label="上一张"
        @click.stop="step(-1)"
      >
        <ChevronLeft class="w-6 h-6" />
      </button>

      <figure v-if="current" class="max-w-6xl w-full flex flex-col items-center gap-4" @click.stop>
        <img
          :src="current.image_url"
          :alt="current.title || '详情图'"
          class="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
        />
        <figcaption v-if="current.title || current.caption" class="text-center max-w-2xl">
          <p v-if="current.title" class="text-white font-bold text-lg">{{ current.title }}</p>
          <p v-if="current.caption" class="text-white/70 text-sm mt-1 leading-relaxed">{{ current.caption }}</p>
        </figcaption>
        <p v-if="hasMultiple" class="text-white/50 text-xs font-mono">{{ cursor + 1 }} / {{ total }}</p>
      </figure>

      <button
        v-if="hasMultiple"
        type="button"
        class="absolute right-2 sm:right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        aria-label="下一张"
        @click.stop="step(1)"
      >
        <ChevronRight class="w-6 h-6" />
      </button>
    </div>
  </Teleport>
</template>

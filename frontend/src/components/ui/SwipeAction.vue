<template>
  <div
    ref="containerRef"
    class="relative overflow-hidden select-none"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @mousedown="onMouseDown"
  >
    <div
      class="absolute right-0 top-0 bottom-0 flex items-stretch"
      :style="actionsStyle"
    >
      <button
        v-for="(action, index) in actions"
        :key="index"
        class="flex items-center justify-center px-4 text-sm font-bold text-white transition-colors"
        :class="action.color ? '' : 'bg-[var(--color-danger)]'"
        :style="action.color ? { backgroundColor: action.color } : undefined"
        @click="handleActionClick(action)"
      >
        {{ action.label }}
      </button>
    </div>

    <div
      class="relative z-10 bg-card transition-transform duration-200 ease-out"
      :style="contentStyle"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface SwipeActionItem {
  label: string;
  color?: string;
  onClick: () => void;
}

const props = defineProps<{
  actions: SwipeActionItem[];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const translateX = ref(0);
const startX = ref(0);
const currentX = ref(0);
const isDragging = ref(false);
const actionsWidth = ref(0);

const contentStyle = computed(() => ({
  transform: `translateX(${-translateX.value}px)`,
}));

const actionsStyle = computed(() => ({
  width: `${actionsWidth.value}px`,
}));

function updateActionsWidth() {
  if (!containerRef.value) return;
  const actionsEl = containerRef.value.querySelector(':scope > div.absolute') as HTMLElement;
  if (actionsEl) {
    actionsWidth.value = actionsEl.offsetWidth;
  }
}

function onTouchStart(e: TouchEvent) {
  updateActionsWidth();
  startX.value = e.touches[0].clientX;
  currentX.value = startX.value;
  isDragging.value = true;
}

function onMouseDown(e: MouseEvent) {
  updateActionsWidth();
  startX.value = e.clientX;
  currentX.value = startX.value;
  isDragging.value = true;

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return;
  currentX.value = e.touches[0].clientX;
  const delta = startX.value - currentX.value;

  if (delta > 0) {
    translateX.value = Math.min(delta, actionsWidth.value);
  } else {
    translateX.value = Math.max(0, translateX.value + delta);
    startX.value = currentX.value;
  }
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;
  currentX.value = e.clientX;
  const delta = startX.value - currentX.value;

  if (delta > 0) {
    translateX.value = Math.min(delta, actionsWidth.value);
  } else {
    translateX.value = Math.max(0, translateX.value + delta);
    startX.value = currentX.value;
  }
}

function onTouchEnd() {
  if (!isDragging.value) return;
  isDragging.value = false;

  if (translateX.value > actionsWidth.value * 0.3) {
    translateX.value = actionsWidth.value;
  } else {
    translateX.value = 0;
  }
}

function onMouseUp() {
  if (!isDragging.value) return;
  isDragging.value = false;

  if (translateX.value > actionsWidth.value * 0.3) {
    translateX.value = actionsWidth.value;
  } else {
    translateX.value = 0;
  }

  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
}

function handleActionClick(action: SwipeActionItem) {
  translateX.value = 0;
  action.onClick();
}
</script>

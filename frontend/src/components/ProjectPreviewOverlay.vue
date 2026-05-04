<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { clampOverlayPosition } from '../utils/projectPreview';

/**
 * Project preview overlay shown after long hover / long press.
 *
 * Rendering:
 * - Uses Teleport so the panel is not clipped by card containers with overflow.
 * - Uses a blurred background fill + `object-contain` foreground so banner stays fully visible.
 *
 * Positioning:
 * - Anchored to the hovered card via its bounding rect.
 * - Clamped to viewport to avoid overflow.
 */
const props = defineProps<{
  visible: boolean;
  project: any | null;
  cardRect: { left: number; top: number; width: number; height: number } | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'enter'): void;
  (e: 'leave'): void;
}>();

const overlaySize = { width: 760, height: 420 };

const viewport = ref({ width: window.innerWidth, height: window.innerHeight });

const organizationName = computed(() => {
  return props.project?.organization || props.project?.extra?.feishu?.organization || '';
});

const position = computed(() => {
  if (!props.visible || !props.cardRect) return null;
  return clampOverlayPosition({
    cardRect: props.cardRect,
    viewport: viewport.value,
    overlaySize,
    padding: 12
  });
});

/**
 * Close by keyboard for desktop usability.
 */
const onKeydown = (e: KeyboardEvent) => {
  if (!props.visible) return;
  if (e.key === 'Escape') emit('close');
};

/**
 * Update viewport snapshot for position re-clamping.
 */
const onResize = () => {
  if (!props.visible) return;
  viewport.value = { width: window.innerWidth, height: window.innerHeight };
};

watch(
  () => props.visible,
  (v) => {
    if (v) {
      window.addEventListener('keydown', onKeydown);
      window.addEventListener('resize', onResize, { passive: true });
      return;
    }
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('resize', onResize as any);
  },
  { immediate: true }
);

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', onResize as any);
});
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && project && cardRect && position" class="fixed inset-0 z-[90]">
      <div class="absolute inset-0 bg-black/20 backdrop-blur-[2px]" @click="emit('close')"></div>
      <Transition name="preview-panel" appear>
        <div
          class="absolute w-[760px] h-[420px] rounded-[2rem] overflow-hidden shadow-2xl shadow-black/40 border border-white/15 bg-slate-950"
          :style="{ left: position.left + 'px', top: position.top + 'px' }"
          @pointerenter="emit('enter')"
          @pointerleave="emit('leave')"
          @click.stop
        >
          <img :src="project.banner" :alt="project.name" class="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60" />
          <div class="absolute inset-0 bg-black/35"></div>
          <img :src="project.banner" :alt="project.name" class="absolute inset-0 w-full h-full object-contain" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent"></div>
          <div class="absolute inset-0 p-7 flex flex-col justify-end">
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center p-2">
                <img v-if="project.icon || project.avatar" :src="project.icon || project.avatar" :alt="project.name" class="w-full h-full object-contain" />
              </div>
              <div class="min-w-0">
                <div class="text-white font-extrabold text-3xl leading-tight line-clamp-1">{{ project.name }}</div>
                <div class="flex flex-wrap items-center gap-2 mt-1">
                  <div class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-white border border-white/15 max-w-[280px] truncate">
                    {{ project.developer }}
                  </div>
                  <div v-if="organizationName" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-white border border-white/15 max-w-[340px] truncate">
                    {{ organizationName }}
                  </div>
                </div>
              </div>
              <div class="ml-auto flex items-center">
                <span v-if="project.status" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-white border border-white/15">
                  {{ project.status }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.preview-panel-enter-active,
.preview-panel-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}
.preview-panel-enter-from,
.preview-panel-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.97);
}
.preview-panel-enter-to,
.preview-panel-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>

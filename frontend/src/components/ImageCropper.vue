<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { Check, X, ZoomIn, ZoomOut, RotateCw } from 'lucide-vue-next';

const props = withDefaults(defineProps<{
  imageSrc: string;
  aspectRatio?: number;
  outputWidth?: number;
  outputHeight?: number;
  title?: string;
}>(), {
  aspectRatio: 1,
  outputWidth: 512,
  outputHeight: 512,
  title: '裁剪图片',
});

const emit = defineEmits<{
  (e: 'confirm', blob: Blob): void;
  (e: 'cancel'): void;
}>();

const imgRef = ref<HTMLImageElement | null>(null);
let cropperInstance: Cropper | null = null;
const isProcessing = ref(false);

onMounted(() => {
  nextTick(() => {
    initCropper();
  });
});

onUnmounted(() => {
  destroyCropper();
});

watch(() => props.imageSrc, () => {
  destroyCropper();
  nextTick(() => {
    initCropper();
  });
});

const initCropper = () => {
  if (!imgRef.value) return;
  cropperInstance = new Cropper(imgRef.value, {
    aspectRatio: props.aspectRatio,
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 0.85,
    restore: false,
    guides: true,
    center: true,
    highlight: false,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: false,
    responsive: true,
    background: true,
  } as any);
};

const destroyCropper = () => {
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
};

const zoomIn = () => (cropperInstance as any)?.zoom(0.1);
const zoomOut = () => (cropperInstance as any)?.zoom(-0.1);
const rotate = () => (cropperInstance as any)?.rotate(90);

const handleConfirm = () => {
  if (!cropperInstance || isProcessing.value) return;
  isProcessing.value = true;

  const canvas = (cropperInstance as any).getCroppedCanvas({
    width: props.outputWidth,
    height: props.outputHeight,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  });

  if (!canvas) {
    isProcessing.value = false;
    return;
  }

  canvas.toBlob((blob: Blob | null) => {
    isProcessing.value = false;
    if (blob) {
      emit('confirm', blob);
    }
  }, 'image/webp', 0.92);
};

const handleCancel = () => {
  emit('cancel');
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') handleCancel();
  if (e.key === 'Enter') handleConfirm();
};

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" @click.self="handleCancel">
    <div class="w-full max-w-2xl bg-white dark:bg-[#0B1120] rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col" @click.stop>
      <div class="flex items-center justify-between px-6 py-4 border-b border-border">
        <div class="text-lg font-extrabold text-foreground">{{ title }}</div>
        <button @click="handleCancel" class="p-2 rounded-xl hover:bg-accent transition-colors">
          <X class="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div class="flex-1 overflow-hidden bg-slate-900 p-4" style="min-height: 350px; max-height: 60vh;">
        <img ref="imgRef" :src="imageSrc" class="block max-w-full" style="max-height: 55vh;" />
      </div>

      <div class="flex items-center justify-between px-6 py-4 border-t border-border">
        <div class="flex items-center gap-2">
          <button @click="zoomIn" class="p-2.5 rounded-xl bg-secondary hover:bg-accent transition-colors" title="放大">
            <ZoomIn class="w-4 h-4 text-foreground" />
          </button>
          <button @click="zoomOut" class="p-2.5 rounded-xl bg-secondary hover:bg-accent transition-colors" title="缩小">
            <ZoomOut class="w-4 h-4 text-foreground" />
          </button>
          <button @click="rotate" class="p-2.5 rounded-xl bg-secondary hover:bg-accent transition-colors" title="旋转90°">
            <RotateCw class="w-4 h-4 text-foreground" />
          </button>
        </div>
        <div class="flex items-center gap-3">
          <button @click="handleCancel" class="px-5 py-2.5 rounded-xl bg-secondary text-foreground font-bold hover:bg-accent transition-colors">
            取消
          </button>
          <button @click="handleConfirm" :disabled="isProcessing" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors">
            <Check class="w-4 h-4" />
            {{ isProcessing ? '处理中...' : '确认裁剪' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

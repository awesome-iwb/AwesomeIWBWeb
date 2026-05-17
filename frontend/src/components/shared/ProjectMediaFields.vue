<template>
  <div class="p-4 lg:p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
      <div>
        <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex justify-between items-center">
          <span>应用图标 (Icon)</span>
          <span class="text-blue-500 text-xs cursor-pointer hover:underline" @click="triggerIconUpload">上传新图标...</span>
          <input type="file" ref="iconInputRef" @change="onIconFile" class="hidden" accept="image/*" />
        </label>
        <div class="flex gap-4 items-center">
          <div class="w-16 h-16 shrink-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2">
            <img v-if="icon" :src="icon" class="w-full h-full object-contain" alt="" />
            <span v-else class="text-slate-400 text-xs">无图</span>
          </div>
          <input
            type="text"
            :value="icon"
            @input="icon = normalizeMediaUrl(($event.target as HTMLInputElement).value)"
            class="flex-1 px-4 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-base"
            placeholder="请上传并使用站内地址（/api/uploads/...）"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex justify-between items-center">
          <span>应用横幅 (Banner)</span>
          <span class="text-blue-500 text-xs cursor-pointer hover:underline" @click="triggerBannerUpload">上传新横幅...</span>
          <input type="file" ref="bannerInputRef" @change="onBannerFile" class="hidden" accept="image/*" />
        </label>
        <div class="flex flex-col gap-3">
          <div class="w-full h-24 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 overflow-hidden">
            <img v-if="banner" :src="banner" class="w-full h-full object-cover rounded-lg" alt="" />
            <span v-else class="text-slate-400 text-xs">无横幅</span>
          </div>
          <input
            type="text"
            :value="banner"
            @input="banner = normalizeMediaUrl(($event.target as HTMLInputElement).value)"
            class="w-full px-4 py-3 lg:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-base"
            placeholder="请上传并使用站内地址（/api/uploads/...）"
          />
        </div>
      </div>
    </div>
    <div v-if="uploadError" class="text-xs text-rose-500 mt-2">{{ uploadError }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { uploadFile, normalizeMediaUrl } from '../../composables/useAdminFetch';

const icon = defineModel<string>('icon', { default: '' });
const banner = defineModel<string>('banner', { default: '' });

const iconInputRef = ref<HTMLInputElement | null>(null);
const bannerInputRef = ref<HTMLInputElement | null>(null);
const uploadError = ref('');

const triggerIconUpload = () => iconInputRef.value?.click();
const triggerBannerUpload = () => bannerInputRef.value?.click();

const onIconFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!file) return;
  uploadError.value = '';
  try {
    icon.value = await uploadFile(file);
  } catch (err: unknown) {
    uploadError.value = err instanceof Error ? err.message : '上传失败';
  }
};

const onBannerFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!file) return;
  uploadError.value = '';
  try {
    banner.value = await uploadFile(file);
  } catch (err: unknown) {
    uploadError.value = err instanceof Error ? err.message : '上传失败';
  }
};
</script>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useHead } from '@unhead/vue';
import { 
  Image as ImageIcon, 
  Github, 
  Layers, 
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Upload,
  X
} from 'lucide-vue-next';
import ImageCropper from '../components/ImageCropper.vue';
import { formatApiError, readJsonOrThrow, useApi } from '../composables/useApi';
import { API } from '../api/endpoints';

useHead({
  title: '提交新项目 - Awesome IWB',
  meta: [
    { name: 'description', content: '向 Awesome IWB 提交新的交互式白板开源项目，帮助更多教师发现优质软件工具。' },
    { property: 'og:title', content: '提交新项目 - Awesome IWB' },
    { property: 'og:description', content: '向 Awesome IWB 提交新的交互式白板开源项目。' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://aiwb.stcn.moe/submit' },
    { property: 'og:image', content: 'https://aiwb.stcn.moe/assets/brand/aiwb-icon.webp' },
    { name: 'twitter:card', content: 'summary' },
  ],
  link: [
    { rel: 'canonical', href: 'https://aiwb.stcn.moe/submit' }
  ]
})

const { apiFetch } = useApi();

const form = ref({
  name: '',
  developer: '',
  githubUrl: '',
  description: '',
  tags: '',
  category: '🛠️ 辅助类软件与实用工具',
  status: '活跃',
  recommendation: '稳定'
});

const iconUrl = ref('');
const bannerUrl = ref('');
const isSubmitted = ref(false);

const categories = ref<string[]>([]);
onMounted(async () => {
  try {
    const res = await apiFetch(API.catalog.categories);
    if (!res.ok) return;
    const json = await res.json();
    categories.value = (json ?? []).map((c: any) => c.name).filter(Boolean);
    if (categories.value.length && !categories.value.includes(form.value.category)) {
      form.value.category = categories.value[0];
    }
  } catch {}
});

const getFallbackImage = (name: string) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#cbd5e1" width="100" height="100" rx="24"/><text fill="#475569" font-family="sans-serif" font-size="40" font-weight="bold" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};

const isSubmitting = ref(false);
const submitError = ref('');
const submissionId = ref('');

const uploadImage = async (blob: Blob): Promise<string | null> => {
  const fd = new FormData();
  fd.append('image', blob, 'upload.webp');
  try {
    const res = await apiFetch(API.upload.image, { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || json?.message || '上传失败';
      throw new Error(typeof msg === 'string' ? msg : '上传失败');
    }
    const url = json?.url;
    if (!url) throw new Error('上传返回无效');
    return String(url);
  } catch (e: any) {
    throw new Error(e?.message || '图片上传失败，请重试');
  }
};

const iconInputRef = ref<HTMLInputElement | null>(null);
const bannerInputRef = ref<HTMLInputElement | null>(null);

const cropperVisible = ref(false);
const cropperSrc = ref('');
const cropperTarget = ref<'icon' | 'banner'>('icon');

const triggerIconUpload = () => {
  iconInputRef.value?.click();
};

const triggerBannerUpload = () => {
  bannerInputRef.value?.click();
};

const handleFileSelected = (event: Event, target: 'icon' | 'banner') => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    cropperSrc.value = e.target?.result as string;
    cropperTarget.value = target;
    cropperVisible.value = true;
  };
  reader.readAsDataURL(file);

  input.value = '';
};

const handleCropConfirm = async (blob: Blob) => {
  cropperVisible.value = false;
  try {
    const url = await uploadImage(blob);
    if (url) {
      if (cropperTarget.value === 'icon') {
        iconUrl.value = url;
      } else {
        bannerUrl.value = url;
      }
    }
  } catch {
    submitError.value = '图片上传失败，请重试';
  }
};

const handleCropCancel = () => {
  cropperVisible.value = false;
  cropperSrc.value = '';
};

const removeIcon = () => { iconUrl.value = ''; };
const removeBanner = () => { bannerUrl.value = ''; };

const handleSubmit = async () => {
  if (!form.value.name || !form.value.developer || !form.value.githubUrl) {
    alert('请填写项目名称、开发者和GitHub链接');
    return;
  }
  
  isSubmitting.value = true;
  submitError.value = '';
  
  try {
    const payload: any = {
      name: form.value.name,
      developer: form.value.developer,
      github_url: form.value.githubUrl,
      description: form.value.description,
      keywords: form.value.tags,
      category: form.value.category,
      status: form.value.status,
      recommendation: form.value.recommendation,
    };
    if (iconUrl.value) payload.icon = iconUrl.value;
    if (bannerUrl.value) payload.banner = bannerUrl.value;

    const response = await apiFetch(API.submissions.list, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await readJsonOrThrow<any>(response);
    if (result.success) {
      isSubmitted.value = true;
      submissionId.value = result.submissionId || '';
    } else {
      submitError.value = '提交失败，请重试。';
    }
  } catch (error: unknown) {
    submitError.value = formatApiError(error, '网络错误，请检查后端服务。');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans pb-24">

    <main class="pt-24 px-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out-expo">
      
      <div v-if="!isSubmitted">
        <!-- Live Preview Header -->
        <div class="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start mb-10 opacity-80 pointer-events-none select-none relative">
          <div class="absolute inset-0 flex items-center justify-center z-20">
            <div class="bg-white/80 dark:bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-full font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-lg flex items-center gap-1.5 text-xs sm:text-sm">
              <Sparkles class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              实时预览
            </div>
          </div>
          
          <div class="relative shrink-0 group drop-shadow-xl">
            <div class="w-20 h-20 sm:w-36 sm:h-36 z-10 flex items-center justify-center relative rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800">
              <img 
                v-if="iconUrl"
                :src="iconUrl" 
                class="w-full h-full object-cover"
              />
              <img 
                v-else-if="form.name"
                :src="getFallbackImage(form.name)" 
                class="w-full h-full object-contain opacity-50"
              />
              <ImageIcon v-else class="w-8 h-8 sm:w-12 sm:h-12 text-slate-300 dark:text-slate-600 absolute" />
            </div>
          </div>

          <div class="flex-1 flex flex-col w-full text-center sm:text-left">
            <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2 leading-tight">
              {{ form.name || '项目名称' }}
            </h1>
            
            <div class="flex items-center gap-3 mb-3 justify-center sm:justify-start">
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700 w-fit">
                <img 
                  :src="getFallbackImage(form.developer || '?')" 
                  class="w-5 h-5 rounded-full object-cover"
                />
                <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ form.developer || '开发者' }}</span>
              </div>
            </div>
            
            <div class="flex flex-wrap gap-1.5 mb-4 justify-center sm:justify-start">
              <span v-for="tag in form.tags.split(/[,，、\s]+/).filter(t => t.trim()).slice(0,3)" :key="tag" class="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-200/50 dark:border-emerald-500/20">
                {{ tag }}
              </span>
              <span v-if="!form.tags" class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-medium border border-dashed border-slate-300 dark:border-slate-700">
                功能特性预览
              </span>
            </div>
          </div>
        </div>

        <!-- Form Section -->
        <div class="bg-white dark:bg-[#111827] rounded-3xl p-4 sm:p-10 border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/50 dark:shadow-none">
          <h2 class="text-xl font-bold mb-8 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Layers class="w-5 h-5 text-emerald-500" /> 填写项目信息
          </h2>
          
          <!-- Image Upload Section -->
          <div class="mb-8 space-y-4">
            <div class="text-sm font-bold text-slate-700 dark:text-slate-300">项目图片</div>
            
            <div class="flex gap-4">
              <div class="w-28 sm:w-36 shrink-0 space-y-1.5">
                <div class="text-xs font-medium text-slate-500 dark:text-slate-400">图标</div>
                <div class="relative group">
                  <div 
                    class="w-full aspect-square rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors overflow-hidden"
                    :class="iconUrl ? 'border-solid border-emerald-300 dark:border-emerald-500/40' : ''"
                    @click="triggerIconUpload"
                  >
                    <img v-if="iconUrl" :src="iconUrl" class="w-full h-full object-cover" />
                    <template v-else>
                      <Upload class="w-6 h-6 text-slate-300 dark:text-slate-600 mb-1" />
                      <div class="text-xs font-medium text-slate-400 dark:text-slate-500">图标</div>
                    </template>
                  </div>
                  <button 
                    v-if="iconUrl"
                    @click.stop="removeIcon"
                    class="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </div>
                <input ref="iconInputRef" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="handleFileSelected($event, 'icon')" />
              </div>

              <div class="flex-1 space-y-1.5">
                <div class="text-xs font-medium text-slate-500 dark:text-slate-400">Banner 横幅图</div>
                <div class="relative group">
                  <div 
                    class="w-full aspect-video rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors overflow-hidden"
                    :class="bannerUrl ? 'border-solid border-emerald-300 dark:border-emerald-500/40' : ''"
                    @click="triggerBannerUpload"
                  >
                    <img v-if="bannerUrl" :src="bannerUrl" class="w-full h-full object-cover" />
                    <template v-else>
                      <Upload class="w-6 h-6 text-slate-300 dark:text-slate-600 mb-1" />
                      <div class="text-xs font-medium text-slate-400 dark:text-slate-500">点击上传 Banner</div>
                      <div class="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5">16:9 横幅图</div>
                    </template>
                  </div>
                  <button 
                    v-if="bannerUrl"
                    @click.stop="removeBanner"
                    class="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </div>
                <input ref="bannerInputRef" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="handleFileSelected($event, 'banner')" />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="space-y-2">
              <label class="text-sm font-bold text-slate-700 dark:text-slate-300">项目名称 <span class="text-red-500">*</span></label>
              <input v-model="form.name" type="text" placeholder="例如: ClassIsland" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all" />
            </div>
            
            <div class="space-y-2">
              <label class="text-sm font-bold text-slate-700 dark:text-slate-300">开发者 GitHub 用户名 <span class="text-red-500">*</span></label>
              <input v-model="form.developer" type="text" placeholder="例如: HelloWRC" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all" />
            </div>
          </div>

          <div class="space-y-2 mb-6">
            <label class="text-sm font-bold text-slate-700 dark:text-slate-300">GitHub 仓库地址 <span class="text-red-500">*</span></label>
            <input v-model="form.githubUrl" type="url" placeholder="例如: https://github.com/ClassIsland/ClassIsland" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all" />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="space-y-2">
              <label class="text-sm font-bold text-slate-700 dark:text-slate-300">所属分类</label>
              <select v-model="form.category" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all appearance-none">
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>
            
            <div class="space-y-2">
              <label class="text-sm font-bold text-slate-700 dark:text-slate-300">功能特性 (逗号或空格分隔)</label>
              <input v-model="form.tags" type="text" placeholder="例如: 课程表 提醒 桌面工具" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all" />
            </div>
          </div>

          <div class="space-y-2 mb-8">
            <label class="text-sm font-bold text-slate-700 dark:text-slate-300">项目简介</label>
            <textarea v-model="form.description" rows="4" placeholder="一句话介绍这个项目是做什么的..." class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all resize-none"></textarea>
          </div>

          <div v-if="submitError" class="mb-6 p-4 rounded-xl bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 text-sm font-bold">
            ❌ {{ submitError }}
          </div>

          <button 
            @click="handleSubmit"
            :disabled="isSubmitting"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40 transition-all hover:-translate-y-0.5 active:translate-y-0 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Github class="w-5 h-5" />
            {{ isSubmitting ? '提交中...' : '提交到审核队列' }}
          </button>
        </div>
      </div>

      <!-- Success / Generated Code Section -->
      <div v-else class="animate-in zoom-in-95 duration-500">
        <div class="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-10 border border-emerald-200 dark:border-emerald-900/50 shadow-2xl shadow-emerald-500/10">
          <div class="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 mx-auto mb-6">
            <CheckCircle2 class="w-8 h-8" />
          </div>
          
          <h2 class="text-2xl font-extrabold text-center mb-2">提交成功！</h2>
          <p class="text-center text-slate-500 dark:text-slate-400 mb-8">
            你的收录请求已进入审核队列，管理员会尽快审核。
          </p>

          <div class="flex flex-col sm:flex-row gap-4 mt-6">
            <div class="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-6 py-3.5 rounded-xl font-bold border border-emerald-200 dark:border-emerald-500/20">
              <ExternalLink class="w-5 h-5" /> 申请编号：{{ submissionId || '已提交' }}
            </div>
            <button 
              @click="isSubmitted = false; submissionId = ''; iconUrl = ''; bannerUrl = ''" 
              class="flex-1 inline-flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-6 py-3.5 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              继续提交
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Image Cropper Modal -->
    <ImageCropper
      v-if="cropperVisible && cropperSrc"
      :imageSrc="cropperSrc"
      :aspectRatio="cropperTarget === 'icon' ? 1 : 16/9"
      :outputWidth="cropperTarget === 'icon' ? 512 : 1280"
      :outputHeight="cropperTarget === 'icon' ? 512 : 720"
      :title="cropperTarget === 'icon' ? '裁剪应用图标' : '裁剪 Banner 图'"
      @confirm="handleCropConfirm"
      @cancel="handleCropCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { 
  Image as ImageIcon, 
  Github, 
  Layers, 
  Sparkles,
  CheckCircle2,
  ExternalLink
} from 'lucide-vue-next';

// Form State
const form = ref({
  name: '',
  developer: '',
  githubUrl: '',
  description: '',
  tags: '',
  category: '🛠️ 辅助类软件与实用工具',
  status: '活跃',
  recommendation: '🥈 值得尝试'
});

const isSubmitted = ref(false);

const categories = ref<string[]>([]);
onMounted(async () => {
  try {
    const res = await fetch('/api/categories');
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

const handleSubmit = async () => {
  if (!form.value.name || !form.value.developer || !form.value.githubUrl) {
    alert('请填写项目名称、开发者和GitHub链接');
    return;
  }
  
  isSubmitting.value = true;
  submitError.value = '';
  
  try {
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: form.value.name,
        developer: form.value.developer,
        github_url: form.value.githubUrl,
        description: form.value.description,
        keywords: form.value.tags,
        category: form.value.category,
        status: form.value.status,
        recommendation: form.value.recommendation
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      isSubmitted.value = true;
      submissionId.value = result.submissionId || '';
    } else {
      submitError.value = result.error || '提交失败，请重试。';
    }
  } catch (error: any) {
    submitError.value = error.message || '网络错误，请检查后端服务。';
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
        <div class="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start mb-12 opacity-80 pointer-events-none select-none relative">
          <div class="absolute inset-0 flex items-center justify-center z-20">
            <div class="bg-white/80 dark:bg-black/80 backdrop-blur-sm px-4 py-2 rounded-full font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-lg flex items-center gap-2">
              <Sparkles class="w-4 h-4" />
              实时预览效果
            </div>
          </div>
          
          <!-- App Icon Preview -->
          <div class="relative shrink-0 group drop-shadow-xl">
            <div class="w-28 h-28 sm:w-36 sm:h-36 z-10 flex items-center justify-center relative">
              <img 
                v-if="form.name"
                :src="getFallbackImage(form.name)" 
                class="w-full h-full object-contain opacity-50"
              />
              <ImageIcon v-else class="w-12 h-12 text-slate-300 dark:text-slate-600 absolute" />
            </div>
          </div>

          <!-- Title & Meta Preview -->
          <div class="flex-1 flex flex-col pt-2 w-full">
            <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2 leading-tight">
              {{ form.name || '项目名称' }}
            </h1>
            
            <div class="flex items-center gap-3 mb-4">
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700 w-fit">
                <img 
                  :src="getFallbackImage(form.developer || '?')" 
                  class="w-5 h-5 rounded-full object-cover"
                />
                <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ form.developer || '开发者' }}</span>
              </div>
            </div>
            
            <div class="flex flex-wrap gap-2 mb-6">
              <span v-for="tag in form.tags.split(/[,，、\s]+/).filter(t => t.trim()).slice(0,3)" :key="tag" class="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-200/50 dark:border-emerald-500/20">
                {{ tag }}
              </span>
              <span v-if="!form.tags" class="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-medium border border-dashed border-slate-300 dark:border-slate-700">
                标签预览
              </span>
            </div>
          </div>
        </div>

        <!-- Form Section -->
        <div class="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-10 border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/50 dark:shadow-none">
          <h2 class="text-xl font-bold mb-8 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Layers class="w-5 h-5 text-emerald-500" /> 填写项目信息
          </h2>
          
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
              <label class="text-sm font-bold text-slate-700 dark:text-slate-300">标签 (逗号或空格分隔)</label>
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
              @click="isSubmitted = false; submissionId = ''" 
              class="flex-1 inline-flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-6 py-3.5 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              继续提交
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

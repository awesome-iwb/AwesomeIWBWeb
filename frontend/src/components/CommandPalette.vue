<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { Search, X, Folder, Hash, ArrowRight } from 'lucide-vue-next';

import { useProjects } from '../composables/useProjects';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits(['close']);
const router = useRouter();

const { allProjects, fetchProjects } = useProjects();

const query = ref('');
const searchInput = ref<HTMLInputElement | null>(null);

const searchResults = computed(() => {
  if (!query.value.trim()) return [];
  const lowerQuery = query.value.toLowerCase();
  
  return allProjects.value.filter(p => 
    p.name.toLowerCase().includes(lowerQuery) || 
    p.description.toLowerCase().includes(lowerQuery) ||
    p.keywords.some(k => k.toLowerCase().includes(lowerQuery)) ||
    p.developer.toLowerCase().includes(lowerQuery)
  ).slice(0, 8); // Max 8 results
});

const selectProject = (projectName: string) => {
  emit('close');
  router.push({ name: 'project-detail', params: { name: projectName } });
  query.value = '';
};

// Auto focus when opened
onMounted(() => {
  fetchProjects();
  if (props.isOpen && searchInput.value) {
    nextTick(() => {
      searchInput.value?.focus();
    });
  }
});

const getFallbackImage = (name: string) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#cbd5e1" width="100" height="100" rx="24"/><text fill="#475569" font-family="sans-serif" font-size="40" font-weight="bold" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="fixed inset-0 z-[200] flex items-start justify-center pt-20 sm:pt-32 px-4 pb-20 bg-slate-900/40 dark:bg-[#0B1120]/60 backdrop-blur-sm" @click="emit('close')">
        <div class="w-full max-w-2xl bg-white/70 dark:bg-[#0f172a]/70 backdrop-blur-2xl backdrop-saturate-200 rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-800/50 relative" @click.stop>
          <!-- Glassmorphism inner highlight -->
          <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/50 dark:ring-white/10 pointer-events-none z-10"></div>
          
          <!-- Search Input -->
          <div class="relative z-20 flex items-center px-4 py-4 border-b border-slate-200/50 dark:border-slate-800/50">
            <Search class="w-6 h-6 text-slate-400 shrink-0" />
            <input 
              ref="searchInput"
              v-model="query" 
              type="text" 
              class="w-full bg-transparent border-none px-4 text-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0 focus:outline-none" 
              placeholder="搜索应用名称、开发者、关键词..."
              @keydown.esc="emit('close')"
            />
            <button @click="emit('close')" class="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Results -->
          <div class="relative z-20 max-h-[60vh] overflow-y-auto p-2">
            
            <div v-if="query.trim() === ''" class="px-4 py-12 text-center text-slate-500">
              <p class="text-sm font-medium">输入关键词开始全局搜索</p>
              <div class="flex items-center justify-center gap-2 mt-4 text-xs">
                <kbd class="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">ESC</kbd> 退出
              </div>
            </div>

            <div v-else-if="searchResults.length === 0" class="px-4 py-12 text-center text-slate-500">
              <p class="text-sm font-medium">没有找到关于 "{{ query }}" 的结果</p>
            </div>

            <div v-else class="space-y-1">
              <h3 class="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">最佳匹配</h3>
              <button 
                v-for="project in searchResults" 
                :key="project.name"
                @click="selectProject(project.name)"
                class="w-full flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left group"
              >
                <div class="w-10 h-10 flex items-center justify-center shrink-0 drop-shadow-sm">
                  <img 
                    :src="project.icon || project.avatar" 
                    class="w-full h-full object-contain"
                    @error="(e) => { (e.target as HTMLImageElement).src = getFallbackImage(project.name) }"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-bold text-slate-900 dark:text-white truncate">{{ project.name }}</span>
                    <span class="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">{{ project.status }}</span>
                  </div>
                  <div class="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 truncate">
                    <span class="flex items-center gap-1"><Folder class="w-3 h-3" /> {{ project.developer }}</span>
                    <span v-if="project.keywords.length > 0" class="flex items-center gap-1"><Hash class="w-3 h-3" /> {{ project.keywords[0] }}</span>
                  </div>
                </div>
                <ArrowRight class="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
              </button>
            </div>

          </div>
          
          <div class="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span class="flex items-center gap-1"><Search class="w-3.5 h-3.5" /> Awesome IWB 全局搜索</span>
            <span>共 {{ searchResults.length }} 条结果</span>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
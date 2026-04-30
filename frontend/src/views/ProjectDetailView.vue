<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useHead } from '@vueuse/head';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import ProjectLineageGraph from '../components/ProjectLineageGraph.vue';
import { useProjects } from '../composables/useProjects';
import type { Project } from '../composables/useProjects';
import { 
  Github, 
  Download, 
  Star, 
  ShieldCheck, 
  MessageCircle,
  Code2,
  Layers,
  Sparkles,
  History,
  ArrowRight,
  X
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const { fetchProjectByName, allProjects, fetchProjects } = useProjects();
const loading = ref(true);
const isSearchOpen = ref(false);

const project = ref<Project | null>(null);

const md = new MarkdownIt({ breaks: true, linkify: true });

/**
 * reCAPTCHA-style AI usage badge state.
 *
 * `ai_usage_state` drives the variant:
 * - over50: shows "fail" (AI usage > 50%)
 * - under50: shows "success" (AI usage <= 50%)
 * - unknown: shows spinner that keeps spinning after user clicks (until admin updates the project)
 */
const showAiError = ref(false);
const showHumanSuccess = ref(false);
const unknownLoading = ref(false);
let aiBadgeTimeout: ReturnType<typeof setTimeout>;

const cursorState = ref({
  show: false,
  x: 120,
  y: 60,
  clicking: false,
  moving: false
});

const handleAiBadgeClick = () => {
  if (showAiError.value) return;
  showAiError.value = true;
  clearTimeout(aiBadgeTimeout);
  aiBadgeTimeout = setTimeout(() => {
    showAiError.value = false;
  }, 3000);
};

const handleHumanBadgeClick = () => {
  if (showHumanSuccess.value) return;
  showHumanSuccess.value = true;
  clearTimeout(aiBadgeTimeout);
  aiBadgeTimeout = setTimeout(() => {
    showHumanSuccess.value = false;
  }, 4000);
};

const handleUnknownBadgeClick = () => {
  if (unknownLoading.value) return;
  unknownLoading.value = true;
};

const runCursorAnimation = (isAi: boolean) => {
  cursorState.value = { show: true, x: 120, y: 60, clicking: false, moving: false };
  
  setTimeout(() => {
    cursorState.value.moving = true;
    cursorState.value.x = 18;
    cursorState.value.y = 18;
  }, 100);

  setTimeout(() => {
    cursorState.value.clicking = true;
  }, 900);

  setTimeout(() => {
    cursorState.value.clicking = false;
    if (isAi) {
      handleAiBadgeClick();
    } else {
      handleHumanBadgeClick();
    }
  }, 1100);

  setTimeout(() => {
    cursorState.value.x = 80;
    cursorState.value.y = 60;
  }, 1400);

  setTimeout(() => {
    cursorState.value.show = false;
  }, 1900);
};

/**
 * Normalize AI usage state for rendering.
 *
 * This keeps older payloads working:
 * - If `ai_usage_state` is present and valid, use it.
 * - Otherwise fall back to `ai_generated` / `human_verified`.
 */
const aiUsageState = computed(() => {
  const p: any = project.value;
  const s = p?.ai_usage_state;
  if (s === 'unknown' || s === 'over50' || s === 'under50') return s;
  if (p?.ai_generated) return 'over50';
  if (p?.human_verified) return 'under50';
  return 'unknown';
});

watch(() => aiUsageState.value, (state) => {
  unknownLoading.value = false;
  if (state !== 'unknown') {
    setTimeout(() => {
      runCursorAnimation(state === 'over50');
    }, 1000);
  }
}, { immediate: true });

const renderMarkdown = (text: string) => {
  if (!text) return '';
  return DOMPurify.sanitize(md.render(text));
};

const latestRelease = computed(() => {
  return project.value?.releases && project.value.releases.length > 0 
    ? project.value.releases[0] 
    : null;
});

const historyReleases = computed(() => {
  return project.value?.releases && project.value.releases.length > 1 
    ? project.value.releases.slice(1) 
    : [];
});

const formatDate = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
};

const getFallbackImage = (name: string) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#cbd5e1" width="100" height="100" rx="24"/><text fill="#475569" font-family="sans-serif" font-size="40" font-weight="bold" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const fetchAndSetProject = async () => {
  loading.value = true;
  const projectName = route.params.name as string;
  project.value = await fetchProjectByName(projectName);
  
  if (project.value) {
    useHead({
      title: `${project.value.name} - Awesome IWB`,
      meta: [
        { name: 'description', content: project.value.description },
        { property: 'og:title', content: `${project.value.name} - Awesome IWB` },
        { property: 'og:description', content: project.value.description },
        { property: 'og:image', content: project.value.banner || project.value.icon || project.value.avatar }
      ]
    });
  }
  loading.value = false;
};

onMounted(async () => {
  await fetchProjects(); // Ensure data is ready before fetching single project
  fetchAndSetProject();
});

watch(() => route.params.name, () => {
  if (route.name === 'project-detail') {
    fetchAndSetProject();
  }
});

// Need allProjects for the lineage graph component
if (allProjects.value.length === 0) {
  fetchProjects();
}
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-200 selection:text-emerald-900 pb-20">
    
    <main class="pt-24 px-6 max-w-4xl mx-auto" v-if="loading">
      <div class="animate-pulse space-y-8">
        <div class="h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>
        <div class="flex gap-6">
          <div class="w-32 h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl shrink-0"></div>
          <div class="space-y-4 flex-1 py-2">
            <div class="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/2"></div>
            <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/3"></div>
            <div class="h-10 bg-slate-200 dark:bg-slate-800 rounded-full w-32 mt-4"></div>
          </div>
        </div>
      </div>
    </main>

    <main class="pt-24 px-4 sm:px-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out-expo" :key="route.params.name as string" v-else-if="project">
      <!-- Hero Banner -->
      <div v-if="project.banner" class="w-full h-48 sm:h-64 md:h-80 rounded-[2rem] overflow-hidden mb-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/50 dark:border-slate-800 relative group">
        <img loading="lazy" :src="project.banner" :alt="project.name" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
      </div>

      <!-- App Header Section -->
      <div class="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start mb-12">
        <!-- App Icon -->
        <div class="relative shrink-0 group drop-shadow-2xl">
          <div class="w-28 h-28 sm:w-36 sm:h-36 z-10 relative flex items-center justify-center">
            <img 
              loading="lazy"
              :src="project?.icon || project?.avatar" 
              :alt="project?.name" 
              class="w-full h-full object-contain"
              @error="(e) => { (e.target as HTMLImageElement).src = getFallbackImage(project?.name || '') }"
            />
          </div>
          <!-- Decorative glow -->
          <div class="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-[3rem] -z-10 group-hover:bg-emerald-500/30 transition-colors duration-500"></div>
        </div>

        <!-- Title & Meta -->
        <div class="flex-1 flex flex-col pt-2 w-full">
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2 leading-tight">
            {{ project.name }}
          </h1>
          
          <div class="flex items-center gap-3 mb-4">
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700 w-fit">
              <img 
                loading="lazy"
                :src="project?.avatar" 
                :alt="project?.developer" 
                class="w-5 h-5 rounded-full object-cover"
                @error="(e) => { (e.target as HTMLImageElement).src = getFallbackImage(project?.developer || '') }"
              />
              <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ project?.developer }}</span>
            </div>
            <div v-if="project?.recommendation.includes('推荐')" class="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-200/50 dark:border-amber-500/20">
              <Star class="w-3.5 h-3.5 fill-current" /> Editors' Choice
            </div>
          </div>

          <div class="flex flex-wrap gap-2 mb-6">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-medium border border-emerald-200/50 dark:border-emerald-500/20">
              <ShieldCheck class="w-4 h-4" />
              {{ project?.status }}
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-medium border border-slate-200/50 dark:border-slate-700">
              {{ project?.recommendation }}
            </span>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap items-center gap-4 mt-auto">
            <a 
              :href="project?.github_url" 
              target="_blank" 
              class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Download class="w-5 h-5" />
              Get App
            </a>
            <a 
              :href="project?.github_url" 
              target="_blank" 
              class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="View Source Code"
            >
              <Github class="w-6 h-6" />
            </a>

            <!-- AI Generated Badge (reCAPTCHA style) -->
            <div 
              v-if="aiUsageState === 'over50'" 
              @click="handleAiBadgeClick"
              class="ml-auto flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-2 px-3 shadow-sm select-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors relative group" 
              title="Click to verify"
            >
              <!-- Fake Figma Cursor -->
              <div 
                v-if="cursorState.show"
                class="absolute z-50 flex flex-col pointer-events-none transition-all ease-out"
                :class="[
                  cursorState.moving ? 'opacity-100' : 'opacity-0',
                  cursorState.clicking ? 'scale-90' : 'scale-100'
                ]"
                :style="{ 
                  transform: `translate(${cursorState.x}px, ${cursorState.y}px)`,
                  transitionDuration: cursorState.clicking ? '100ms' : '800ms'
                }"
              >
                <svg class="w-6 h-6 text-emerald-500 drop-shadow-md -ml-1 -mt-1" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L6.5 15L8.5 9L14.5 7L1 1Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
                </svg>
                <div class="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-sm rounded-tl-none font-bold whitespace-nowrap shadow-md ml-3 -mt-1">
                  {{ project.developer }}
                </div>
              </div>

              <!-- Error Overlay -->
              <div class="absolute inset-0 overflow-hidden rounded-md pointer-events-none">
                <div 
                  class="absolute inset-0 bg-red-50 dark:bg-red-500/10 flex items-center justify-center gap-2 transition-all duration-300 z-10 pointer-events-auto"
                  :class="showAiError ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-full'"
                >
                  <X class="w-4 h-4 text-red-500" />
                  <span class="text-xs font-bold text-red-600 dark:text-red-400">Verification Failed</span>
                </div>
              </div>

              <!-- Checkbox with checkmark -->
              <div 
                class="w-6 h-6 border-2 rounded flex items-center justify-center bg-white dark:bg-slate-800 transition-colors duration-300"
                :class="showAiError ? 'border-red-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-slate-400 dark:group-hover:border-slate-500'"
              >
                <!-- The checkmark is explicitly missing/hidden -->
              </div>
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">I'm not a robot</span>
              <div class="flex flex-col items-center ml-2 border-l border-slate-200 dark:border-slate-700 pl-3">
                <img src="https://www.gstatic.com/recaptcha/api2/logo_48.png" alt="reCAPTCHA logo" class="w-6 h-6 opacity-80 mb-0.5" />
                <span class="text-[9px] text-slate-400 dark:text-slate-500 leading-none">reCAPTCHA</span>
              </div>
            </div>

            <!-- Human Verified Badge (reCAPTCHA style) -->
            <div
              v-else-if="aiUsageState === 'under50'"
              @click="handleHumanBadgeClick"
              class="ml-auto flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-2 px-3 shadow-sm select-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors relative group"
              title="Click to verify"
            >
              <!-- Fake Figma Cursor -->
              <div 
                v-if="cursorState.show"
                class="absolute z-50 flex flex-col pointer-events-none transition-all ease-out"
                :class="[
                  cursorState.moving ? 'opacity-100' : 'opacity-0',
                  cursorState.clicking ? 'scale-90' : 'scale-100'
                ]"
                :style="{ 
                  transform: `translate(${cursorState.x}px, ${cursorState.y}px)`,
                  transitionDuration: cursorState.clicking ? '100ms' : '800ms'
                }"
              >
                <svg class="w-6 h-6 text-emerald-500 drop-shadow-md -ml-1 -mt-1" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L6.5 15L8.5 9L14.5 7L1 1Z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
                </svg>
                <div class="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-sm rounded-tl-none font-bold whitespace-nowrap shadow-md ml-3 -mt-1">
                  {{ project.developer }}
                </div>
              </div>

              <!-- Checkbox with dynamic checkmark -->
              <div
                class="w-6 h-6 border-2 rounded flex items-center justify-center transition-colors duration-300"
                :class="showHumanSuccess ? 'border-transparent bg-emerald-500' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 group-hover:border-slate-400 dark:group-hover:border-slate-500'"
              >
                <svg
                  class="w-4 h-4 text-white transition-all duration-300"
                  :class="showHumanSuccess ? 'opacity-100 scale-100' : 'opacity-0 scale-0'"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">I'm not a robot</span>
              <div class="flex flex-col items-center ml-2 border-l border-slate-200 dark:border-slate-700 pl-3">
                <img src="https://www.gstatic.com/recaptcha/api2/logo_48.png" alt="reCAPTCHA logo" class="w-6 h-6 opacity-80 mb-0.5" />
                <span class="text-[9px] text-slate-400 dark:text-slate-500 leading-none">reCAPTCHA</span>
              </div>
            </div>

            <!-- Unknown Badge (reCAPTCHA style) -->
            <div
              v-else
              @click="handleUnknownBadgeClick"
              class="ml-auto flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-2 px-3 shadow-sm select-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors relative group"
              title="Click to verify"
            >
              <div class="w-6 h-6 border-2 rounded flex items-center justify-center bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 group-hover:border-slate-400 dark:group-hover:border-slate-500">
                <div v-if="unknownLoading" class="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-emerald-500 animate-spin"></div>
              </div>
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">I'm not a robot</span>
              <div class="flex flex-col items-center ml-2 border-l border-slate-200 dark:border-slate-700 pl-3">
                <img src="https://www.gstatic.com/recaptcha/api2/logo_48.png" alt="reCAPTCHA logo" class="w-6 h-6 opacity-80 mb-0.5" />
                <span class="text-[9px] text-slate-400 dark:text-slate-500 leading-none">reCAPTCHA</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent my-10"></div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        <!-- Main Content -->
        <div class="lg:col-span-2 space-y-10">
          
          <!-- About -->
          <section>
            <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Layers class="w-6 h-6 text-emerald-500" /> About
            </h2>
            <div class="prose prose-slate dark:prose-invert max-w-none">
              <p class="text-slate-600 dark:text-slate-300 text-lg leading-relaxed whitespace-pre-wrap">{{ project.description }}</p>
            </div>
          </section>

          <!-- What's New (Releases) -->
          <section v-if="project?.releases && project.releases.length > 0">
            <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <History class="w-6 h-6 text-emerald-500" /> 最近更新
            </h2>
            
            <!-- Latest Release -->
            <div v-if="latestRelease" class="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-sm mb-6">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <span class="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-lg font-bold text-sm">
                    {{ latestRelease.tag_name }}
                  </span>
                  <span class="text-slate-500 text-sm" v-if="latestRelease.published_at">
                    发布于 {{ formatDate(latestRelease.published_at) }}
                  </span>
                </div>
                <a :href="latestRelease.html_url" target="_blank" class="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 text-sm font-medium flex items-center gap-1">
                  查看完整日志 <ArrowRight class="w-4 h-4" />
                </a>
              </div>
              
              <div class="prose prose-sm prose-slate dark:prose-invert max-w-none max-h-60 overflow-y-auto custom-scrollbar pr-2" v-if="latestRelease.body">
                <div v-html="renderMarkdown(latestRelease.body)"></div>
              </div>
              <div v-else class="text-slate-500 italic text-sm">
                该版本没有提供详细的更新日志。
              </div>
            </div>

            <!-- Historical Timeline -->
            <div v-if="historyReleases.length > 0" class="pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
              <div v-for="release in historyReleases" :key="release.tag_name" class="relative">
                <div class="absolute -left-[21px] top-1.5 w-3 h-3 bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-[#0B1120] rounded-full"></div>
                <div class="flex items-center gap-3 mb-1">
                  <a :href="release.html_url" target="_blank" class="font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition-colors">
                    {{ release.tag_name }}
                  </a>
                  <span class="text-slate-400 text-xs" v-if="release.published_at">{{ formatDate(release.published_at) }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Lineage Graph -->
          <ProjectLineageGraph :currentProjectName="project.name" :allProjects="allProjects" />

          <!-- Editor's Note (Reviews) -->
          <section v-if="project.reviews && project.reviews.length > 0">
            <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <MessageCircle class="w-6 h-6 text-amber-500" /> 编辑锐评
            </h2>
            <div class="grid gap-4">
              <div 
                v-for="(review, index) in project.reviews" 
                :key="index"
                class="relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 rounded-2xl p-6 sm:p-8 border border-amber-200/50 dark:border-amber-500/20 shadow-sm"
              >
                <div class="absolute -top-3 -right-3 text-amber-300/30 dark:text-amber-500/10 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z"/></svg>
                </div>
                
                <div class="flex items-center justify-between mb-4 relative z-10">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-amber-200/50 dark:bg-amber-500/20 flex items-center justify-center font-bold text-amber-700 dark:text-amber-400">
                      {{ review.author.charAt(0).toUpperCase() }}
                    </div>
                    <div>
                      <span class="font-bold text-amber-900 dark:text-amber-300 block">{{ review.author }}</span>
                      <span class="text-xs font-medium text-amber-700/60 dark:text-amber-400/60 uppercase tracking-wider">Editor</span>
                    </div>
                  </div>
                  <div class="flex text-amber-400">
                    <Star class="w-4 h-4 fill-current" v-for="i in 5" :key="i" />
                  </div>
                </div>
                <p class="text-amber-900/80 dark:text-amber-200/80 text-lg leading-relaxed italic relative z-10">"{{ review.content }}"</p>
              </div>
            </div>
          </section>

          <!-- Community Discussions (Giscus) -->
          <section class="mt-16 pt-10 border-t border-slate-200 dark:border-slate-800">
            <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Github class="w-6 h-6 text-slate-500" /> 社区讨论
            </h2>
            <p class="text-slate-500 mb-8">在这里留下你对 {{ project.name }} 的使用体验，或者向开发者反馈问题。</p>
            
            <div v-if="project.github_url && project.github_url.includes('github.com/')" class="min-h-[200px] bg-white dark:bg-[#111827] rounded-3xl p-4 sm:p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <!-- 引入 giscus 组件，对于网络问题可以使用镜像或者国内代理，但目前 giscus 官方提供的最稳定的方案是通过预加载和设置重试 -->
              <component 
                :is="'script'"
                src="https://giscus.app/client.js"
                :data-repo="project.github_url.replace('https://github.com/', '').replace(/\/$/, '')"
                data-repo-id="" 
                data-category="General"
                data-category-id=""
                data-mapping="title"
                data-strict="0"
                data-reactions-enabled="1"
                data-emit-metadata="0"
                data-input-position="top"
                data-theme="preferred_color_scheme"
                data-lang="zh-CN"
                crossorigin="anonymous"
                async
                :key="project.github_url"
              ></component>
              <div id="giscus-loading-fallback" class="text-center py-10 text-slate-500">
                <div class="inline-block animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-3"></div>
                <p>正在连接 GitHub 加载评论区...</p>
                <p class="text-xs mt-2 text-slate-400">如果长时间未加载，请检查您的网络连接或尝试开启网络加速工具。</p>
                <p class="text-xs mt-1 text-slate-400">注：此项目需要开发者在其仓库中开启 Discussions 功能并安装 Giscus 才能正常显示评论区。</p>
              </div>
              <noscript>请启用 JavaScript 以查看评论区。</noscript>
            </div>
            <div v-else class="text-center py-10 text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p>该项目未提供 GitHub 仓库地址，无法加载评论区。</p>
            </div>
          </section>
        </div>

        <!-- Sidebar -->
        <div class="space-y-8 lg:sticky lg:top-24 self-start">
          
          <!-- Information Card -->
          <div class="bg-slate-50 dark:bg-[#111827] rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800/80">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4">Information</h3>
            <ul class="space-y-4">
              <li class="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                <span class="text-slate-500">Developer</span>
                <span class="font-medium text-slate-900 dark:text-white text-right">{{ project.developer }}</span>
              </li>
              <li class="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                <span class="text-slate-500">Category</span>
                <span class="font-medium text-emerald-600 dark:text-emerald-400 text-right flex items-center gap-1">
                  App
                </span>
              </li>
              <li class="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                <span class="text-slate-500">Status</span>
                <span class="font-medium text-slate-900 dark:text-white text-right">{{ project.status }}</span>
              </li>
            </ul>
          </div>

          <!-- Tags -->
          <div class="bg-slate-50 dark:bg-[#111827] rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800/80">
            <div v-if="project.keywords && project.keywords.length > 0" class="mb-8">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Sparkles class="w-5 h-5 text-emerald-500" /> Tags
              </h3>
              <div class="flex flex-wrap gap-2">
                <span 
                  v-for="kw in project.keywords" 
                  :key="kw" 
                  class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400 transition-colors cursor-default"
                >
                  {{ kw }}
                </span>
              </div>
            </div>

            <!-- Tech Stack Section -->
            <div v-if="project.language">
              <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Code2 class="w-5 h-5 text-indigo-500" /> Tech Stack
              </h3>
              <div class="flex flex-wrap gap-2">
                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-lg text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  <Code2 class="w-4 h-4" /> {{ project.language }}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>

    <main class="pt-32 px-6 text-center" v-else>
      <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 mb-6 text-slate-400">
        <Code2 class="w-10 h-10" />
      </div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">Project not found</h1>
      <p class="text-slate-500 mb-8">The app you're looking for doesn't exist or has been removed.</p>
      <button 
        @click="router.push('/')" 
        class="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
      >
        Return to Store
      </button>
    </main>

  </div>
</template>

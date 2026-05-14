<script setup lang="ts">
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useHead } from '@unhead/vue';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import ProjectLineageGraph from '../components/ProjectLineageGraph.vue';
import CommentPanel from '../components/CommentPanel.vue';
import { computeCursorFrames } from '../utils/captchaCursor';
import { useProjects } from '../composables/useProjects';
import type { Project } from '../composables/useProjects';
import type { ProjectDeveloper } from '../composables/useProjects';
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
  X,
  Users
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const { fetchProjectByName, allProjects, fetchProjects } = useProjects();
const loading = ref(true);

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
  x: 0,
  y: 0,
  clicking: false,
  transitionMs: 0
});

const cursorAccent = ref<string>('#10b981');
const developerAvatarUrl = computed(() => {
  if (!project.value) return '';
  return project.value.avatar || '';
});

const organizationName = computed(() => {
  return project.value?.organization || (project.value as any)?.extra?.feishu?.organization || '';
});

const techStack = computed(() => {
  const tech = (project.value as any)?.extra?.feishu?.tech_stack;
  if (Array.isArray(tech) && tech.length) return tech as string[];
  return project.value?.language ? [project.value.language] : [];
});

const developerMembers = computed(() => {
  const devs = (project.value as any)?.developers as ProjectDeveloper[] | undefined;
  if (!devs || !Array.isArray(devs) || devs.length === 0) return null;
  return devs.filter(d => d.user_id);
});

const developerOrgs = computed(() => {
  const devs = (project.value as any)?.developers as ProjectDeveloper[] | undefined;
  if (!devs || !Array.isArray(devs) || devs.length === 0) return null;
  return devs.filter(d => d.org_id);
});

const hasDevelopersData = computed(() => {
  return (developerMembers.value && developerMembers.value.length > 0) || (developerOrgs.value && developerOrgs.value.length > 0);
});

const deriveAccentFromImage = (url: string) => {
  return new Promise<string>((resolve) => {
    if (typeof window === 'undefined' || !url) return resolve('#10b981');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const w = 16;
        const h = 16;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('#10b981');
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 10) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n += 1;
        }
        if (!n) return resolve('#10b981');
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        resolve(`rgb(${r} ${g} ${b})`);
      } catch {
        resolve('#10b981');
      }
    };
    img.onerror = () => resolve('#10b981');
    img.src = url;
  });
};

let cursorLoopTimer: ReturnType<typeof setInterval> | null = null;
let cursorLoopRunning = false;
let cursorBadgeEl: HTMLElement | null = null;
let cursorKind: CursorDemoKind | null = null;
const cursorTimers: ReturnType<typeof setTimeout>[] = [];
const aiBadgeRef = ref<HTMLElement | null>(null);
const humanBadgeRef = ref<HTMLElement | null>(null);
const unknownBadgeRef = ref<HTMLElement | null>(null);
void aiBadgeRef;
void humanBadgeRef;
void unknownBadgeRef;

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

type CursorDemoKind = "ai" | "human" | "unknown";

const clearCursorTimers = () => {
  while (cursorTimers.length) {
    const t = cursorTimers.pop();
    if (t) clearTimeout(t);
  }
};

const runCursorAnimation = (kind: CursorDemoKind, badge: HTMLElement) => {
  if (typeof window === "undefined") return;
  const checkbox = badge.querySelector("[data-captcha-checkbox]") as HTMLElement | null;
  if (!checkbox) return;

  const badgeRect = badge.getBoundingClientRect();
  const checkboxRect = checkbox.getBoundingClientRect();
  const frames = computeCursorFrames({
    badge: { width: badgeRect.width, height: badgeRect.height },
    checkbox: {
      x: checkboxRect.left - badgeRect.left,
      y: checkboxRect.top - badgeRect.top,
      width: checkboxRect.width,
      height: checkboxRect.height
    }
  });

  clearCursorTimers();
  cursorState.value = { show: true, x: badgeRect.left + frames.start.x, y: badgeRect.top + frames.start.y, clicking: false, transitionMs: 0 };

  cursorTimers.push(
    setTimeout(() => {
      cursorState.value.transitionMs = 650;
      cursorState.value.x = badgeRect.left + frames.target.x;
      cursorState.value.y = badgeRect.top + frames.target.y;
    }, 160)
  );

  cursorTimers.push(
    setTimeout(() => {
      cursorState.value.transitionMs = 120;
      cursorState.value.clicking = true;
    }, 980)
  );

  cursorTimers.push(
    setTimeout(() => {
      cursorState.value.transitionMs = 120;
      cursorState.value.clicking = false;
      if (kind === "ai") handleAiBadgeClick();
      else if (kind === "human") handleHumanBadgeClick();
      else handleUnknownBadgeClick();
    }, 1140)
  );

  cursorTimers.push(
    setTimeout(() => {
      cursorState.value.transitionMs = 520;
      cursorState.value.x = badgeRect.left + frames.exit.x;
      cursorState.value.y = badgeRect.top + frames.exit.y;
    }, 1420)
  );

  cursorTimers.push(
    setTimeout(() => {
      cursorState.value.show = false;
    }, 2050)
  );
};

const runCursorLoop = async (kind: CursorDemoKind, badge: HTMLElement) => {
  cursorBadgeEl = badge;
  cursorKind = kind;

  if (cursorLoopTimer) clearInterval(cursorLoopTimer);
  clearCursorTimers();

  const avatar = developerAvatarUrl.value;
  cursorAccent.value = await deriveAccentFromImage(avatar);

  cursorLoopRunning = true;
  runCursorAnimation(kind, badge);
  cursorLoopTimer = setInterval(() => {
    if (!cursorLoopRunning) return;
    if (!cursorBadgeEl || !cursorKind) return;
    runCursorAnimation(cursorKind, cursorBadgeEl);
  }, 3200);
};

const stopCursorLoop = () => {
  cursorLoopRunning = false;
  if (cursorLoopTimer) clearInterval(cursorLoopTimer);
  cursorLoopTimer = null;
  cursorBadgeEl = null;
  cursorKind = null;
  clearCursorTimers();
  cursorState.value.show = false;
};

const stopCursorLoopGraceful = () => {
  cursorLoopRunning = false;
  if (cursorLoopTimer) clearInterval(cursorLoopTimer);
  cursorLoopTimer = null;
  cursorBadgeEl = null;
  cursorKind = null;
};

const onBadgeEnter = (kind: CursorDemoKind, e: MouseEvent) => {
  const badge = e.currentTarget as HTMLElement | null;
  if (!badge) return;
  void runCursorLoop(kind, badge);
};

const onBadgeLeave = () => {
  stopCursorLoopGraceful();
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

watch(() => aiUsageState.value, () => {
  unknownLoading.value = false;
});

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
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};

useHead(() => {
  if (!project.value) {
    return {
      title: '应用详情 - Awesome IWB'
    };
  }

  const projectUrl = `https://aiwb.stcn.moe/project/${encodeURIComponent(project.value.name)}`;
  const imageUrl = project.value.banner || project.value.icon || project.value.avatar || 'https://aiwb.stcn.moe/assets/brand/aiwb-icon.webp';

  return {
    title: `${project.value.name} - Awesome IWB`,
    meta: [
      { name: 'description', content: project.value.description },
      { property: 'og:title', content: `${project.value.name} - Awesome IWB` },
      { property: 'og:description', content: project.value.description },
      { property: 'og:image', content: imageUrl },
      { property: 'og:url', content: projectUrl },
      { property: 'og:type', content: 'article' },
      { property: 'og:locale', content: 'zh_CN' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: `${project.value.name} - Awesome IWB` },
      { name: 'twitter:description', content: project.value.description },
    ],
    link: [
      { rel: 'canonical', href: projectUrl }
    ],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: project.value.name,
          description: project.value.description,
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Windows',
          author: {
            '@type': 'Person',
            name: project.value.developer
          },
          ...(project.value.language ? { programmingLanguage: project.value.language } : {}),
          ...(project.value.stars ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Math.min(5, 3 + Math.log10(Math.max(1, project.value.stars)) * 0.8).toFixed(1),
              ratingCount: String(project.value.stars)
            }
          } : {}),
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'CNY'
          },
          url: projectUrl
        })
      }
    ]
  };
});

const fetchAndSetProject = async () => {
  loading.value = true;
  try {
    const projectName = route.params.name as string;
    project.value = await fetchProjectByName(projectName);
  } finally {
    loading.value = false;
  }
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

onBeforeUnmount(() => {
  stopCursorLoop();
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
            <div v-if="organizationName" class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700 w-fit">
              <span class="text-sm font-semibold text-slate-700 dark:text-slate-300 max-w-[240px] truncate">{{ organizationName }}</span>
            </div>
            <div v-if="project?.is_editors_choice" class="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-200/50 dark:border-amber-500/20">
              <Star class="w-3.5 h-3.5 fill-current" /> 编辑推荐
            </div>
          </div>

          <div class="flex flex-wrap gap-2 mb-6">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-medium border border-emerald-200/50 dark:border-emerald-500/20">
              <ShieldCheck class="w-4 h-4" />
              {{ project?.status }}
            </span>
            <span 
              v-if="project?.recommendation" 
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border"
              :class="{
                'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/20': project?.recommendation === '稳定',
                'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200/50 dark:border-orange-500/20': project?.recommendation === '不稳定',
                'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200/50 dark:border-purple-500/20': project?.recommendation === '观望中'
              }"
            >
              <ShieldCheck class="w-4 h-4" />
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
              @mouseenter="(e) => onBadgeEnter('ai', e)"
              @mouseleave="onBadgeLeave"
              class="ml-auto flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-2 px-3 shadow-sm select-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors relative group" 
              title="Click to verify"
              ref="aiBadgeRef"
            >
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
                data-captcha-checkbox
                class="w-6 h-6 border-2 rounded flex items-center justify-center bg-white dark:bg-slate-800 transition-colors duration-300"
                :class="showAiError ? 'border-red-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-slate-400 dark:group-hover:border-slate-500'"
              >
                <!-- The checkmark is explicitly missing/hidden -->
              </div>
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">I'm not a robot</span>
              <div class="flex flex-col items-center ml-2 border-l border-slate-200 dark:border-slate-700 pl-3">
                <svg class="w-6 h-6 opacity-80 mb-0.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <path d="M21 5v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span class="text-[9px] text-slate-400 dark:text-slate-500 leading-none">reCAPTCHA</span>
              </div>
            </div>

            <!-- Human Verified Badge (reCAPTCHA style) -->
            <div
              v-else-if="aiUsageState === 'under50'"
              @click="handleHumanBadgeClick"
              @mouseenter="(e) => onBadgeEnter('human', e)"
              @mouseleave="onBadgeLeave"
              class="ml-auto flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-2 px-3 shadow-sm select-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors relative group"
              title="Click to verify"
              ref="humanBadgeRef"
            >
              <!-- Checkbox with dynamic checkmark -->
              <div
                data-captcha-checkbox
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
                <svg class="w-6 h-6 opacity-80 mb-0.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <path d="M21 5v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span class="text-[9px] text-slate-400 dark:text-slate-500 leading-none">reCAPTCHA</span>
              </div>
            </div>

            <!-- Unknown Badge (reCAPTCHA style) -->
            <div
              v-else
              @click="handleUnknownBadgeClick"
              @mouseenter="(e) => onBadgeEnter('unknown', e)"
              @mouseleave="onBadgeLeave"
              class="ml-auto flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-2 px-3 shadow-sm select-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors relative group"
              title="Click to verify"
              ref="unknownBadgeRef"
            >
              <div data-captcha-checkbox class="w-6 h-6 border-2 rounded flex items-center justify-center bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 group-hover:border-slate-400 dark:group-hover:border-slate-500">
                <div v-if="unknownLoading" class="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-emerald-500 animate-spin"></div>
              </div>
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">I'm not a robot</span>
              <div class="flex flex-col items-center ml-2 border-l border-slate-200 dark:border-slate-700 pl-3">
                <svg class="w-6 h-6 opacity-80 mb-0.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <path d="M21 5v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span class="text-[9px] text-slate-400 dark:text-slate-500 leading-none">reCAPTCHA</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="cursorState.show"
        class="fixed z-[60] flex flex-col pointer-events-none transition-all ease-out"
        :class="[
          'opacity-100',
          cursorState.clicking ? 'scale-90' : 'scale-100'
        ]"
        :style="{ 
          transform: `translate(${cursorState.x}px, ${cursorState.y}px)`,
          transitionDuration: cursorState.transitionMs + 'ms'
        }"
      >
        <div class="relative -ml-1 -mt-1 drop-shadow-lg">
          <svg class="w-7 h-7" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 4.5C5.4 4.2 4.7 4.7 4.9 5.4L9.9 23.9C10.1 24.6 11.1 24.7 11.5 24.1L14.8 18.9L20.6 16.4C21.3 16.1 21.3 15.1 20.6 14.8L6 4.5Z" :fill="cursorAccent"/>
            <path d="M6 4.5C5.4 4.2 4.7 4.7 4.9 5.4L9.9 23.9C10.1 24.6 11.1 24.7 11.5 24.1L14.8 18.9L20.6 16.4C21.3 16.1 21.3 15.1 20.6 14.8L6 4.5Z" stroke="white" stroke-width="1.6" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="ml-3 -mt-1 inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-white/50 bg-white/90 dark:bg-slate-900/80 backdrop-blur text-[10px] font-extrabold text-slate-800 dark:text-slate-100 shadow-md">
          <img :src="project?.avatar" class="w-4 h-4 rounded-full object-cover" @error="(e) => { (e.target as HTMLImageElement).src = getFallbackImage(project?.developer || '') }" />
          <span class="max-w-[120px] truncate">@{{ project?.developer }}</span>
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

          <CommentPanel :project-name="project.name" />
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

          <!-- Developers Card -->
          <div v-if="hasDevelopersData" class="bg-slate-50 dark:bg-[#111827] rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800/80">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Users class="w-5 h-5 text-emerald-500" /> 开发者
            </h3>
            <div class="space-y-3">
              <div
                v-for="member in developerMembers"
                :key="member.user_id!"
                class="flex items-center gap-3"
              >
                <img
                  :src="member.user_avatar_url || getFallbackImage(member.user_name || '')"
                  :alt="member.user_name"
                  class="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  @error="(e) => { (e.target as HTMLImageElement).src = getFallbackImage(member.user_name || '') }"
                />
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-slate-900 dark:text-white truncate">{{ member.user_name }}</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">{{ member.role === 'owner' ? '负责人' : '协作者' }}</div>
                </div>
              </div>
              <div
                v-for="org in developerOrgs"
                :key="org.org_id!"
                class="flex items-center gap-3"
              >
                <img
                  :src="org.org_avatar_url || getFallbackImage(org.org_name || '')"
                  :alt="org.org_name"
                  class="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                  @error="(e) => { (e.target as HTMLImageElement).src = getFallbackImage(org.org_name || '') }"
                />
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-slate-900 dark:text-white truncate">{{ org.org_name }}</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">组织</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Features -->
          <div v-if="project.keywords && project.keywords.length > 0" class="bg-slate-50 dark:bg-[#111827] rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800/80">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Sparkles class="w-5 h-5 text-emerald-500" /> 功能特性
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

          <!-- Tech Stack -->
          <div v-if="techStack.length" class="bg-slate-50 dark:bg-[#111827] rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800/80">
            <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Code2 class="w-5 h-5 text-indigo-500" /> 技术栈
            </h3>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="t in techStack"
                :key="t"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-lg text-sm font-bold text-indigo-600 dark:text-indigo-400"
              >
                <Code2 class="w-4 h-4" /> {{ t }}
              </span>
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

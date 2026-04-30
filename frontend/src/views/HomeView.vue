<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Search, MessageCircle, Sparkles, LayoutGrid, Zap, Plus, Star, Tag, Code2, Award, Flame, Scale } from 'lucide-vue-next';
import HeroCarousel from '../components/HeroCarousel.vue';
import NavBar from '../components/NavBar.vue';
import CommandPalette from '../components/CommandPalette.vue';
import { useProjects } from '../composables/useProjects';
import type { Project } from '../composables/useProjects';
import { globalState } from '../store';

const router = useRouter();
const { categories, loading, fetchProjects, allProjects } = useProjects();

const searchTerm = ref('');
const activeCategory = ref('all');
const activeSort = ref('default'); // default, stars, updated
const activeLanguage = ref('all');
const hasBadges = ref(false);
const isSearchOpen = ref(false);
const isScrolledPastSearch = ref(false);

const comparisonList = ref<Project[]>([]);

const onCardClick = (project: Project) => {
  router.push({ name: 'project-detail', params: { name: project.name } });
};

const isZoom = (_project: Project) => false;

const availableLanguages = computed(() => {
  const langs = new Set<string>();
  allProjects.value.forEach(p => {
    if (p.language) langs.add(p.language);
  });
  return Array.from(langs).sort();
});

const toggleComparison = (project: Project, e: Event) => {
  e.stopPropagation();
  const idx = comparisonList.value.findIndex(p => p.name === project.name);
  if (idx > -1) {
    comparisonList.value.splice(idx, 1);
  } else {
    if (comparisonList.value.length >= 3) {
      alert('最多只能同时对比 3 个应用哦！');
      return;
    }
    comparisonList.value.push(project);
  }
};

const clearComparison = () => {
  comparisonList.value = [];
};

const getFallbackImage = (name: string) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#cbd5e1" width="100" height="100" rx="24"/><text fill="#475569" font-family="sans-serif" font-size="40" font-weight="bold" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const mainSearchInput = ref<HTMLElement | null>(null);

// 打字机效果状态
const typeWriterText = ref('');
const slogans = ['超级装备库', '最佳应用指南', '百宝工具箱', '优质软件合集'];
let sloganIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typeWriterTimer: ReturnType<typeof setTimeout> | null = null;

const typeWriterTick = () => {
  const currentSlogan = slogans[sloganIndex];
  
  if (isDeleting) {
    charIndex--;
    typeWriterText.value = currentSlogan.substring(0, charIndex);
  } else {
    charIndex++;
    typeWriterText.value = currentSlogan.substring(0, charIndex);
  }

  let typingSpeed = isDeleting ? 60 : 150; // 删除速度比打字速度快

  if (!isDeleting && charIndex === currentSlogan.length) {
    // 打完一个句子，停顿较长时间
    typingSpeed = 2000;
    isDeleting = true;
  } else if (isDeleting && charIndex === 0) {
    // 删完一个句子，切换下一个句子，停顿一小会
    isDeleting = false;
    sloganIndex = (sloganIndex + 1) % slogans.length;
    typingSpeed = 600;
  }

  typeWriterTimer = setTimeout(typeWriterTick, typingSpeed);
};

onMounted(async () => {
  await fetchProjects();
  // 立即开始打第一个字
  typeWriterTimer = setTimeout(typeWriterTick, 200);
  
  const handleScroll = () => {
    if (mainSearchInput.value) {
      const rect = mainSearchInput.value.getBoundingClientRect();
      // If the bottom of the search input is above the top of the viewport (i.e. scrolled past)
      const passed = rect.bottom < 64; // 64px is approx navbar height
      isScrolledPastSearch.value = passed;
      globalState.isScrolledPastSearch = passed;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  // Check initial state
  handleScroll();
  
  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll);
    if (typeWriterTimer) {
      clearTimeout(typeWriterTimer);
    }
  });
});

// Footer 彩蛋：连点5次进入后台
const logoClickCount = ref(0);
let logoClickTimer: ReturnType<typeof setTimeout> | null = null;

const handleLogoClick = () => {
  logoClickCount.value++;
  
  if (logoClickTimer) clearTimeout(logoClickTimer);
  
  if (logoClickCount.value >= 5) {
    logoClickCount.value = 0;
    // 使用 Vue Router 前端单页路由跳转至新的后台组件页面
    router.push('/admin');
  } else {
    logoClickTimer = setTimeout(() => {
      logoClickCount.value = 0;
    }, 1500); // 1.5秒内未连点则重置
  }
};

const filteredCategories = computed(() => {
  const filtered = categories.value
    .map(category => ({
      ...category,
      projects: category.projects.filter(project => {
        const matchesCategory = activeCategory.value === 'all' || category.id === activeCategory.value;
        const matchesLanguage = activeLanguage.value === 'all' || project.language === activeLanguage.value;
        const matchesBadge = !hasBadges.value || (project.stars && project.stars >= 100) || project.recommendation.includes('推荐');
        const matchesSearch = project.name.toLowerCase().includes(searchTerm.value.toLowerCase()) || 
           project.description.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
           project.keywords.some(kw => kw.toLowerCase().includes(searchTerm.value.toLowerCase()));
        
        return matchesCategory && matchesLanguage && matchesBadge && matchesSearch;
      })
    }))
    .filter(cat => cat.projects.length > 0);

  // Apply sorting
  return filtered.map(cat => {
    const sortedProjects = [...cat.projects];
    if (activeSort.value === 'stars') {
      sortedProjects.sort((a, b) => (b.stars || 0) - (a.stars || 0));
    } else if (activeSort.value === 'updated') {
      sortedProjects.sort((a, b) => {
        const dateA = a.last_update ? new Date(a.last_update).getTime() : 0;
        const dateB = b.last_update ? new Date(b.last_update).getTime() : 0;
        return dateB - dateA;
      });
    }
    return { ...cat, projects: sortedProjects };
  });
});

// 计算总数
const stats = computed(() => {
  let totalProjects = 0;
  categories.value.forEach(c => totalProjects += c.projects.length);
  return { totalProjects, totalCategories: categories.value.length };
});

// 获取当天的种子用于随机推荐，确保一天内刷新内容一致
const getDaySeed = () => {
  const now = new Date();
  return Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
};

// 简单的伪随机数生成器
const seededRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

// 智能提取图标颜色
const cardColors = ref<Record<string, string>>({});
const extractColor = (src: string, name: string) => {
  if (!src || cardColors.value[name]) return;
  // 补全相对路径的 base url 保证跨域 canvas 读取成功
  const absoluteSrc = src.startsWith('http') ? src : `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.src = absoluteSrc;
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, 64, 64);
        // 采样中心像素，如果是透明的再尝试其他位置
        let data = ctx.getImageData(32, 32, 1, 1).data;
        if (data[3] < 10) data = ctx.getImageData(32, 16, 1, 1).data;
        if (data[3] < 10) data = ctx.getImageData(16, 32, 1, 1).data;
        if (data[3] < 10) data = ctx.getImageData(48, 32, 1, 1).data;
        
        // 如果依然太透明或者太暗，稍微提亮
        let r = data[0], g = data[1], b = data[2];
        if (r + g + b < 50) { r += 50; g += 50; b += 50; }
        
        // 存储 rgb 字符串，方便模板里灵活使用不同透明度
        cardColors.value[name] = `${r}, ${g}, ${b}`;
      }
    } catch (e) {
      console.warn('Could not extract color for', name, e);
    }
  };
};

const heroCards = computed(() => {
  const seed = getDaySeed();
  
  const candidates = allProjects.value.filter(p => p.recommendation || (p.stars && p.stars > 10));
  if (candidates.length === 0) return allProjects.value.slice(0, 4);

  const withBanner = candidates.filter(p => p.banner);
  const withoutBanner = candidates.filter(p => !p.banner);

  const shuffle = (arr: any[]) => {
    return [...arr].sort((a, b) => {
      const aSeed = a.name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) + seed;
      const bSeed = b.name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) + seed;
      return seededRandom(aSeed) - seededRandom(bSeed);
    });
  };

  const shuffledWithBanner = shuffle(withBanner);
  const shuffledWithoutBanner = shuffle(withoutBanner);

  const selected = [];
  // 优先满足至少 3/4 有 banner
  selected.push(...shuffledWithBanner.slice(0, 3));
  
  if (shuffledWithBanner.length >= 4) {
     selected.push(shuffledWithBanner[3]);
  } else if (shuffledWithoutBanner.length > 0) {
     selected.push(shuffledWithoutBanner[0]);
  }

  while (selected.length < 4 && shuffledWithoutBanner.length > 0) {
     const remaining = shuffledWithoutBanner.filter(p => !selected.includes(p));
     if(remaining.length > 0) selected.push(remaining[0]);
     else break;
  }

  return selected.slice(0, 4);
});

watch(heroCards, (cards) => {
  cards.forEach(c => extractColor(c.icon || c.avatar, c.name));
}, { immediate: true });
</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-50 font-sans selection:bg-emerald-200 dark:selection:bg-emerald-900">
    
    <!-- Hero Section (Interface Craft Style) -->
    <header class="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      <!-- Minimalist background decoration -->
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-3xl opacity-50 pointer-events-none z-0"></div>

      <div class="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16 relative z-10">

        <!-- Left: Text & Search -->
        <div class="flex-1 text-center lg:text-left flex flex-col items-center lg:items-start w-full">
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400 text-sm font-bold mb-6 shadow-sm">
            <Sparkles class="w-4 h-4" />
            <span>精心挑选的 {{ stats.totalProjects }} 款优质教育软件</span>
          </div>

          <h1 class="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight flex flex-col items-center lg:items-start">
            <span class="mb-2">班级大屏的</span>
            <span class="inline-flex items-center whitespace-nowrap">
              <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-400 dark:to-teal-400">
                {{ typeWriterText }}
              </span>
              <span class="w-1.5 h-[1.2em] bg-emerald-500 ml-2 animate-pulse mt-1"></span>
            </span>
          </h1>

          <p class="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed">
            专为广大中小学电教打造的一站式软件推荐清单。告别臃肿难用的系统自带软件，用最现代的工具重塑课堂体验。
          </p>

          <!-- Global Large Search Bar -->
          <div class="relative w-full max-w-xl group" ref="mainSearchInput">
            <div class="absolute inset-y-0 left-5 flex items-center pointer-events-none z-10">
              <Search class="h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="搜索画板、课表、倒计时等工具..."
              v-model="searchTerm"
              class="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-[#0B1120]/60 backdrop-blur-xl shadow-sm hover:shadow-md focus:shadow-xl focus:shadow-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent transition-all duration-300 text-lg placeholder:text-slate-400"
              :class="isScrolledPastSearch ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'"
            />
            <div class="absolute inset-y-0 right-3 flex items-center transition-opacity duration-300" :class="isScrolledPastSearch ? 'opacity-0' : 'opacity-100'">
              <div class="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 font-medium">
                <span class="text-[10px]">⌘</span> K
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Interface Craft Style Fan Cards -->
        <div class="flex-1 relative w-full flex justify-center lg:justify-end lg:pr-32 h-[480px] sm:h-[520px] mt-12 lg:mt-0 perspective-1000 group/fan" v-if="heroCards.length >= 4">
          
          <!-- Stack Container -->
          <div class="relative w-[280px] sm:w-[320px] h-[360px] sm:h-[400px] top-1/2 -translate-y-1/2 transition-transform duration-500">
            
            <!-- Card Iteration (1 to 4) -->
            <div 
              v-for="(card, index) in heroCards" 
              :key="card.name"
              class="absolute top-0 left-0 w-full h-full bg-white dark:bg-slate-900 rounded-3xl flex flex-col cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden border border-slate-200/60 dark:border-slate-700/60 origin-bottom"
              :class="[
                index === 0 ? 'z-40' : index === 1 ? 'z-30' : index === 2 ? 'z-20' : 'z-10',
                index === 0 ? 'rotate-0' : '',
                index === 1 ? 'rotate-[-3deg] -translate-x-1 translate-y-1' : '',
                index === 2 ? 'rotate-[3deg] translate-x-1 translate-y-1' : '',
                index === 3 ? 'rotate-[6deg] translate-x-2 translate-y-2' : '',
                index === 0 ? 'group-hover/fan:rotate-[-25deg] group-hover/fan:-translate-x-28 group-hover/fan:translate-y-8 hover:!-translate-y-16 hover:!z-50 hover:!scale-105' : '',
                index === 1 ? 'group-hover/fan:rotate-[-5deg] group-hover/fan:-translate-x-10 group-hover/fan:translate-y-2 hover:!-translate-y-24 hover:!z-50 hover:!scale-105' : '',
                index === 2 ? 'group-hover/fan:rotate-[15deg] group-hover/fan:translate-x-10 group-hover/fan:translate-y-2 hover:!-translate-y-24 hover:!z-50 hover:!scale-105' : '',
                index === 3 ? 'group-hover/fan:rotate-[35deg] group-hover/fan:translate-x-32 group-hover/fan:translate-y-12 hover:!-translate-y-16 hover:!z-50 hover:!scale-105' : ''
              ]"
              :style="{
                boxShadow: cardColors[card.name] ? `0 0 40px -5px rgba(${cardColors[card.name]}, 0.5)` : '0 10px 40px -15px rgba(0,0,0,0.2)',
                borderColor: cardColors[card.name] ? `rgba(${cardColors[card.name]}, 0.3)` : ''
              }"
              @click="router.push({ name: 'project-detail', params: { name: card.name } })"
            >
              <!-- Top: Banner Image -->
              <div class="w-full h-[55%] sm:h-[60%] bg-slate-100 dark:bg-slate-800 relative overflow-hidden shrink-0">
                <img v-if="card.banner" :src="card.banner" class="w-full h-full object-cover" alt="Banner" />
                <div v-else class="w-full h-full flex items-center justify-center transition-colors duration-500" :style="{ backgroundColor: cardColors[card.name] ? `rgba(${cardColors[card.name]}, 0.1)` : 'rgba(16, 185, 129, 0.1)' }">
                  <Sparkles class="w-12 h-12 transition-colors duration-500" :style="{ color: cardColors[card.name] ? `rgba(${cardColors[card.name]}, 0.5)` : 'rgba(16, 185, 129, 0.5)' }" />
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
              </div>

              <!-- Bottom: Icon + Text -->
              <div class="p-5 sm:p-6 flex-1 flex flex-col justify-center bg-white dark:bg-slate-900 relative">
                <div class="flex items-center gap-4 mb-2">
                  <img :src="card.icon || card.avatar" class="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-sm shrink-0" @error="(e) => { (e.target as HTMLImageElement).src = getFallbackImage(card.name) }" />
                  <div class="flex-1 min-w-0">
                    <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">{{ card.name }}</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400 truncate">{{ card.developer }}</p>
                  </div>
                </div>
                <p class="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">{{ card.description }}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </header>

    <!-- Hero Carousel -->
    <div class="max-w-7xl mx-auto px-6 mb-12">
      <HeroCarousel :projects="allProjects" />
    </div>

    <main class="max-w-7xl mx-auto px-6 pb-24 flex flex-col md:flex-row gap-12 relative items-start">
      
      <!-- Sticky Sidebar Navigation -->
      <aside class="w-full md:w-64 shrink-0 md:sticky top-24 hidden md:block">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 px-3">资源分类</h3>
        <div class="space-y-1">
          <button
            @click="activeCategory = 'all'"
            :class="[
              'w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between',
              activeCategory === 'all'
                ? 'bg-white dark:bg-slate-800/50 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/30'
            ]"
          >
            <span>🌟 所有资源</span>
            <span class="text-xs bg-slate-100 dark:bg-slate-800 py-0.5 px-2 rounded-full text-slate-500">{{ stats.totalProjects }}</span>
          </button>
          
          <button
            v-for="cat in categories"
            :key="cat.id"
            @click="activeCategory = cat.id"
            :class="[
              'w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between',
              activeCategory === cat.id
                ? 'bg-white dark:bg-slate-800/50 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/30'
            ]"
          >
            <span class="truncate pr-2">{{ cat.name.replace(/^[^\s]+\s/, '') }}</span>
            <span class="text-xs bg-slate-100 dark:bg-slate-800 py-0.5 px-2 rounded-full text-slate-500 shrink-0">{{ cat.projects.length }}</span>
          </button>
        </div>
      </aside>

      <!-- Mobile Categories (Horizontal Scroll) -->
      <div class="md:hidden w-full overflow-x-auto pb-4 -mx-6 px-6 flex gap-2 no-scrollbar">
        <button
          @click="activeCategory = 'all'"
          :class="[
            'shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-all border whitespace-nowrap',
            activeCategory === 'all'
              ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
          ]"
        >
          🌟 全部
        </button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          @click="activeCategory = cat.id"
          :class="[
            'shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-all border whitespace-nowrap',
            activeCategory === cat.id
              ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
          ]"
        >
          {{ cat.name.replace(/^[^\s]+\s/, '') }}
        </button>
      </div>

      <!-- Main Content Area --> 
      <div class="flex-1 min-w-0">
        <!-- Advanced Filters -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div class="flex flex-wrap items-center gap-3">
            <label class="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              <input type="checkbox" v-model="hasBadges" class="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:checked:bg-emerald-500" />
              <Award class="w-4 h-4 text-amber-500" />
              仅显示获奖应用
            </label>
            <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <select v-model="activeLanguage" class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer">
              <option value="all">所有语言</option>
              <option v-for="lang in availableLanguages" :key="lang" :value="lang">{{ lang }}</option>
            </select>
          </div>
          
          <select v-model="activeSort" class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer w-full sm:w-auto">
            <option value="default">默认排序</option>
            <option value="stars">最多 Stars</option>
            <option value="updated">最近更新</option>
          </select>
        </div>

        <div v-if="loading" class="w-full space-y-16">
          <div v-for="i in 2" :key="i" class="animate-pulse">
            <div class="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-48 mb-4"></div>
            <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-96 mb-8 max-w-full"></div>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div v-for="j in 4" :key="j" class="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 h-full overflow-hidden flex flex-col">
                <div class="h-32 w-full bg-slate-200 dark:bg-slate-800"></div>
                <div class="p-6 flex-grow flex flex-col">
                  <div class="flex items-start gap-4 mb-5">
                    <div class="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-800 shrink-0"></div>
                    <div class="flex-1 space-y-2 py-1">
                      <div class="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                      <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
                    </div>
                  </div>
                  <div class="space-y-2 mb-6">
                    <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                    <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
                  </div>
                  <div class="flex gap-2 mt-auto mb-4">
                    <div class="h-6 bg-slate-200 dark:bg-slate-800 rounded w-16"></div>
                    <div class="h-6 bg-slate-200 dark:bg-slate-800 rounded w-16"></div>
                    <div class="h-6 bg-slate-200 dark:bg-slate-800 rounded w-16"></div>
                  </div>
                  <div class="pt-5 border-t border-slate-100 dark:border-slate-800/80">
                    <div class="h-6 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div><div v-else>
          <div v-if="filteredCategories.length === 0" class="text-center py-32 bg-white dark:bg-slate-900/20 rounded-3xl border border-slate-200 dark:border-slate-800 border-dashed">
            <div class="text-5xl mb-4 opacity-50">🛸</div>
            <h3 class="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">未找到匹配的软件</h3>
            <p class="text-slate-500">尝试使用其他关键词，或者清除搜索条件。</p>
            <button @click="searchTerm = ''" class="mt-6 text-emerald-600 font-medium hover:underline">清除搜索</button>
          </div>
          
          <div v-for="category in filteredCategories" :key="category.id" class="mb-16 last:mb-0">
            <div class="mb-8">
              <h2 class="text-2xl font-bold mb-2 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                {{ category.name }}
              </h2>
              <p class="text-slate-500 dark:text-slate-400">
                {{ category.description }}
              </p>
            </div>

            <!-- Modern Card Grid -->
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div
                v-for="project in category.projects"
                :key="project.name"
                @click="onCardClick(project)"
                class="group relative bg-white/40 dark:bg-slate-800/30 backdrop-blur-md border border-white/60 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-none hover:border-indigo-500/30 hover:bg-white/60 dark:hover:bg-slate-800/50 rounded-2xl hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col h-full overflow-hidden cursor-pointer"
              >
                <!-- Inner glass reflection highlight -->
                <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/50 dark:ring-white/10 pointer-events-none z-10"></div>
                <!-- Optional Glassmorphism overlay on hover -->
                <div class="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent dark:from-white/5 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"></div>

                <div class="h-full flex flex-col">
                <!-- Banner Image -->
                <div v-if="project.banner" class="h-32 w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                  <img loading="lazy" :src="project.banner" :alt="`${project.name} Banner`" class="w-full h-full object-cover" />
                </div>

                <div class="relative z-10 flex-grow flex flex-col p-6">
                  <!-- Badges / Achievements -->
                  <div class="absolute -top-3 right-4 flex flex-col gap-2 z-20">
                    <div v-if="project.stars && project.stars >= 1000" class="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 text-white shadow-lg shadow-amber-500/30" title="千星俱乐部 (1000+ Stars)">
                      <Award class="w-4 h-4" />
                    </div>
                    <div v-if="project.stars && project.stars >= 100 && project.stars < 1000" class="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-lg shadow-slate-500/30" title="百星精选 (100+ Stars)">
                      <Star class="w-4 h-4 fill-current" />
                    </div>
                    <div v-if="project.recommendation.includes('推荐')" class="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-red-600 text-white shadow-lg shadow-rose-500/30" title="编辑特别推荐">
                      <Flame class="w-4 h-4 fill-current" />
                    </div>
                  </div>

                  <!-- Header -->
                    <div class="flex justify-between items-start mb-5 relative z-30" :class="isZoom(project) ? 'gap-4' : ''">
                      <div class="flex items-center gap-4">
                        <div class="relative shrink-0 flex items-center justify-center drop-shadow-sm" :class="isZoom(project) ? 'w-[72px] h-[72px]' : 'w-14 h-14'">
                        <img
                          loading="lazy"
                          :src="project.icon || project.avatar"
                          :alt="project.name"
                          class="w-full h-full object-contain"
                          @error="(e) => { (e.target as HTMLImageElement).src = getFallbackImage(project.name) }"
                        />
                      </div>
                      <div>
                        <h3 class="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1" :class="isZoom(project) ? 'text-xl' : 'text-lg'">
                          {{ project.name }}
                        </h3>
                        <div class="flex items-center gap-2 mt-1 text-sm">
                          <img loading="lazy" :src="project.avatar" :alt="project.developer" class="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-700 shrink-0 object-cover" @error="(e) => { (e.target as HTMLImageElement).src = getFallbackImage(project.developer) }" />
                          <span class="text-slate-500 dark:text-slate-400 font-medium truncate">{{ project.developer }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="flex flex-col items-end gap-1 shrink-0">
                      <span class="inline-flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold px-3 py-1.5 rounded-lg text-xs border border-slate-200/50 dark:border-slate-700 backdrop-blur-md">
                        {{ project.recommendation.replace(/推荐|值得尝试|谨慎使用/, '').trim() || 'APP' }}
                      </span>
                      <span v-if="project.stars" class="inline-flex items-center gap-1 text-xs font-bold text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-200/50 dark:border-amber-500/20">
                        <Star class="w-3 h-3 fill-current" /> {{ project.stars > 1000 ? (project.stars/1000).toFixed(1) + 'k' : project.stars }}
                      </span>
                    </div>
                  </div>

                  <!-- Description -->
                  <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4" :class="isZoom(project) ? '' : 'line-clamp-2'">
                    {{ project.description }}
                  </p>

                  <!-- Tags & Status -->
                  <div class="flex flex-wrap items-center gap-2 mt-auto mb-4">
                    <span class="px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 backdrop-blur-sm border border-white/50 dark:border-slate-700/50 uppercase tracking-wider">
                      {{ category.name }}
                    </span>
                    <span 
                      v-if="project.language" 
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-200/50 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20"
                    >
                      <Code2 class="w-3 h-3" /> {{ project.language }}
                    </span>
                    <span 
                      v-if="project.status" 
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border"
                      :class="project.status === '活跃' ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-slate-50 text-slate-500 border-slate-200/50 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'"
                    >
                      <Zap class="w-3 h-3" /> {{ project.status }}
                    </span>
                    <span v-if="project.version" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-200/50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
                      <Tag class="w-3 h-3" /> {{ project.version }}
                    </span>
                    <span 
                      v-for="kw in project.keywords.slice(0, project.version ? 1 : 2)" 
                      :key="kw"
                      class="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium border border-slate-200/50 dark:border-slate-700 truncate max-w-[100px]"
                    >
                      {{ kw }}
                    </span>
                  </div>

                  <!-- Footer / Actions -->
                  <div class="mt-auto pt-5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <!-- Reviews snippet if exists -->
                    <div class="flex-1 min-w-0 pr-4">
                      <div v-if="project.reviews && project.reviews.length > 0" class="flex items-center gap-2 group/review cursor-help">
                        <MessageCircle class="w-4 h-4 text-slate-400 group-hover/review:text-emerald-500 transition-colors shrink-0" />
                        <span class="text-xs text-slate-500 group-hover/review:text-emerald-600 transition-colors" :class="isZoom(project) ? 'whitespace-normal' : 'truncate'">
                          <span class="font-semibold">{{ project.reviews[0].author }}:</span>
                          {{ project.reviews[0].content }}
                        </span>
                      </div>
                    </div>
                    
                    <button 
                      @click="(e) => toggleComparison(project, e)"
                      class="p-2 rounded-xl transition-colors shrink-0 z-30 relative"
                      :class="comparisonList.find(p => p.name === project.name) ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-500/10'"
                      title="加入横向对比"
                    >
                      <Scale class="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </main>

    <!-- Comparison Floating Bar & Modal -->
    <div v-if="comparisonList.length > 0" class="fixed bottom-0 left-0 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50 flex justify-between items-center transition-all animate-in slide-in-from-bottom-full">
      <div class="max-w-6xl mx-auto w-full flex items-center justify-between">
        <div class="flex items-center gap-4">
          <span class="font-bold text-slate-700 dark:text-slate-300 hidden sm:inline">横向对比</span>
          <div class="flex gap-2">
            <div v-for="p in comparisonList" :key="p.name" class="relative group drop-shadow-sm flex items-center justify-center w-10 h-10">
              <img :src="p.icon || p.avatar" class="w-full h-full object-contain" :title="p.name" />
              <button @click.stop="toggleComparison(p, $event)" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] z-10">×</button>
            </div>
            <div v-for="i in (3 - comparisonList.length)" :key="'empty'+i" class="w-10 h-10 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400">
              <Plus class="w-4 h-4 opacity-50" />
            </div>
          </div>
        </div>
        <div class="flex gap-3">
          <button @click="clearComparison" class="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors">清空</button>
          <button @click="router.push('/compare?projects=' + comparisonList.map(p => encodeURIComponent(p.name)).join(','))" class="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50" :disabled="comparisonList.length < 2">
            开始对比 ({{ comparisonList.length }}/3)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Hide scrollbar for mobile categories. */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

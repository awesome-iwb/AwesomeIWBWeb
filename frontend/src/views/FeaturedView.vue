<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useHead } from '@unhead/vue';
import { Star, X, Download } from 'lucide-vue-next';
import DOMPurify from 'dompurify';
import { useApi } from '../composables/useApi';
import { API } from '../api/endpoints';

useHead({
  title: '精选推荐 - Awesome IWB',
  meta: [
    { name: 'description', content: 'Awesome IWB 精选推荐，发现最优质的交互式白板开源软件和专题故事。' },
    { property: 'og:title', content: '精选推荐 - Awesome IWB' },
    { property: 'og:description', content: '发现最优质的交互式白板开源软件和专题故事。' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://aiwb.stcn.moe/today' },
    { property: 'og:image', content: 'https://aiwb.stcn.moe/assets/brand/aiwb-icon.webp' },
    { name: 'twitter:card', content: 'summary' },
  ],
  link: [
    { rel: 'canonical', href: 'https://aiwb.stcn.moe/today' }
  ]
})

interface FeaturedProject {
  name: string;
  icon: string;
}

interface FeaturedStory {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  coverImage: string;
  date: string;
  projects: FeaturedProject[];
  theme: 'dark' | 'light';
  content: string; // HTML or Markdown formatted content
}

const router = useRouter();
const selectedStory = ref<FeaturedStory | null>(null);
const isStoryOpen = ref(false);

const { apiFetch } = useApi();
const stories = ref<FeaturedStory[]>([]);

onMounted(async () => {
  try {
    const res = await apiFetch(API.catalog.stories, { cache: 'no-cache' });
    if (res.ok) {
      stories.value = await res.json();
    }
  } catch (e) {
    console.error('Failed to fetch stories', e);
  }
});

const navigateToProject = (projectName: string) => {
  if (isStoryOpen.value) {
    closeStory();
    setTimeout(() => {
      router.push({ name: 'project-detail', params: { name: projectName } });
    }, 500);
  } else {
    router.push({ name: 'project-detail', params: { name: projectName } });
  }
};

const openStory = (story: FeaturedStory) => {
  selectedStory.value = story;
  isStoryOpen.value = true;
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
};

const closeStory = () => {
  isStoryOpen.value = false;
  document.body.style.overflow = '';
  setTimeout(() => {
    selectedStory.value = null;
  }, 500); // Wait for transition
};

</script>

<template>
  <div class="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-200 selection:text-emerald-900">

    <main class="pt-24 px-6 max-w-4xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out-expo">
      
      <header class="mb-10" v-if="stories.length > 0">
        <h1 class="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">Today</h1>
        <p class="text-lg text-slate-500 dark:text-slate-400 font-medium">{{ stories[0].date }}</p>
      </header>

      <div class="grid gap-10" v-if="stories.length > 0">
        <article 
          v-for="story in stories" 
          :key="story.id"
          @click="openStory(story)"
          class="group relative w-full h-[28rem] sm:h-[32rem] rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-200/50 dark:border-slate-800 cursor-pointer transform transition-all duration-500 hover:-translate-y-2 hover:shadow-3xl"
        >
          <img loading="lazy" :src="story.coverImage" :alt="story.title" class="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
          
          <!-- Gradient Overlays based on theme -->
          <div v-if="story.theme === 'dark'" class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/80"></div>
          <div v-else class="absolute inset-0 bg-gradient-to-b from-white/60 via-white/20 to-white/90"></div>

          <div class="absolute inset-0 p-8 sm:p-10 flex flex-col justify-between" :class="story.theme === 'dark' ? 'text-white' : 'text-slate-900'">
            <div class="transform transition-transform duration-500 translate-y-0 group-hover:-translate-y-2">
              <span class="font-bold tracking-widest text-xs sm:text-sm uppercase opacity-80 mb-2 block">{{ story.category }}</span>
              <h2 class="text-3xl sm:text-5xl font-extrabold leading-tight mb-3 drop-shadow-sm">{{ story.title }}</h2>
              <p class="text-lg sm:text-xl font-medium opacity-90 drop-shadow-sm max-w-md">{{ story.subtitle }}</p>
            </div>
            
            <div class="transform transition-all duration-500 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
              <div class="flex flex-wrap gap-3">
                <button 
                  v-for="project in story.projects" 
                  :key="project.name"
                  @click.stop="navigateToProject(project.name)"
                  class="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl font-bold text-sm backdrop-blur-md transition-colors"
                  :class="story.theme === 'dark' ? 'bg-white/20 hover:bg-white/30 text-white border border-white/20' : 'bg-black/10 hover:bg-black/20 text-slate-900 border border-black/10'"
                >
                  <img v-if="project.icon" :src="project.icon" class="w-6 h-6 object-contain drop-shadow-sm" :alt="project.name" />
                  <Star v-else class="w-4 h-4" />
                  {{ project.name }}
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>

    </main>

    <!-- Expanded Story Modal -->
    <Teleport to="body">
      <Transition name="story">
        <div v-if="isStoryOpen && selectedStory" class="fixed inset-0 z-[100] flex justify-center bg-[#F8FAFC]/95 dark:bg-[#0B1120]/95 backdrop-blur-md overflow-y-auto pt-0 sm:pt-10 pb-0 sm:pb-10">
          
          <button 
            @click="closeStory" 
            class="fixed top-6 right-6 z-[110] w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md text-white flex items-center justify-center transition-all shadow-lg border border-white/20"
          >
            <X class="w-5 h-5" />
          </button>

          <article class="relative w-full max-w-4xl bg-white dark:bg-[#111827] sm:rounded-[2.5rem] shadow-2xl min-h-screen sm:min-h-0 border border-slate-200/50 dark:border-slate-800 overflow-hidden flex flex-col">
            <!-- Scrollable Content Area -->
            <div class="overflow-y-auto w-full h-full flex-1">
              <!-- Hero Header -->
              <div class="relative w-full h-[30rem] sm:h-[36rem] shrink-0">
                <img loading="lazy" :src="selectedStory.coverImage" :alt="selectedStory.title" class="absolute inset-0 w-full h-full object-cover" />
                <div v-if="selectedStory.theme === 'dark'" class="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/80"></div>
                <div v-else class="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-white/90"></div>
                
                <div class="absolute inset-x-0 bottom-0 p-8 sm:p-12 flex flex-col justify-end" :class="selectedStory.theme === 'dark' ? 'text-white' : 'text-slate-900'">
                  <span class="font-bold tracking-widest text-sm uppercase opacity-80 mb-2 block">{{ selectedStory.category }}</span>
                  <h1 class="text-4xl sm:text-6xl font-extrabold leading-tight mb-4 drop-shadow-sm">{{ selectedStory.title }}</h1>
                  <p class="text-xl sm:text-2xl font-medium opacity-90 drop-shadow-sm">{{ selectedStory.subtitle }}</p>
                </div>
              </div>

              <!-- Content Body -->
              <div class="p-8 sm:p-16 prose prose-lg prose-slate dark:prose-invert max-w-none">
                <div v-html="DOMPurify.sanitize(selectedStory.content)"></div>
              </div>

              <!-- App Links at Bottom -->
              <div class="p-8 sm:p-16 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-6">相关应用</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  v-for="project in selectedStory.projects" 
                  :key="project.name"
                  @click="navigateToProject(project.name)"
                  class="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-emerald-500/50 transition-all group"
                >
                  <div class="flex items-center gap-3">
                    <img v-if="project.icon" :src="project.icon" class="w-12 h-12 object-contain drop-shadow-md" :alt="project.name" />
                    <div v-else class="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-emerald-500">
                      <Download class="w-6 h-6" />
                    </div>
                    <span class="font-bold text-slate-900 dark:text-white">{{ project.name }}</span>
                  </div>
                  <span class="text-emerald-600 dark:text-emerald-400 font-bold text-sm bg-emerald-50 dark:bg-emerald-500/10 px-4 py-1.5 rounded-full group-hover:bg-emerald-500 group-hover:text-white transition-colors">获取</span>
                </button>
              </div>
              </div>
            </div>
          </article>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.ease-out-expo {
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

.story-enter-active,
.story-leave-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.story-enter-from,
.story-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}
</style>

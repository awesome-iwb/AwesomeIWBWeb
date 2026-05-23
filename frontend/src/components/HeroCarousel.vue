<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronLeft, ChevronRight, Star } from 'lucide-vue-next';
import type { Project } from '../composables/useProjects';

const props = defineProps<{
  projects: Project[];
}>();

const router = useRouter();
const currentIndex = ref(0);
let autoPlayTimer: number | null = null;

// Only feature projects that have a banner and are editors' choice
const featuredProjects = computed(() => {
  return props.projects
    .filter(p => p.banner && p.is_editors_choice)
    .slice(0, 5); // Limit to top 5
});

const nextSlide = () => {
  if (featuredProjects.value.length === 0) return;
  currentIndex.value = (currentIndex.value + 1) % featuredProjects.value.length;
  resetAutoPlay();
};

const prevSlide = () => {
  if (featuredProjects.value.length === 0) return;
  currentIndex.value = (currentIndex.value - 1 + featuredProjects.value.length) % featuredProjects.value.length;
  resetAutoPlay();
};

const goToSlide = (index: number) => {
  currentIndex.value = index;
  resetAutoPlay();
};

const startAutoPlay = () => {
  autoPlayTimer = window.setInterval(() => {
    if (featuredProjects.value.length > 0) {
      currentIndex.value = (currentIndex.value + 1) % featuredProjects.value.length;
    }
  }, 5000); // 5 seconds per slide
};

const stopAutoPlay = () => {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }
};

const resetAutoPlay = () => {
  stopAutoPlay();
  startAutoPlay();
};

const navigateToProject = (projectName: string) => {
  router.push({ name: 'project-detail', params: { name: projectName } });
};

onMounted(() => {
  startAutoPlay();
});

onUnmounted(() => {
  stopAutoPlay();
});

const getFallbackImage = (name: string) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#cbd5e1" width="100" height="100" rx="24"/><text fill="#475569" font-family="sans-serif" font-size="40" font-weight="bold" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};
</script>

<template>
  <div v-if="featuredProjects.length > 0" class="relative w-full overflow-hidden rounded-[2rem] bg-slate-900 shadow-2xl shadow-slate-200/50 dark:shadow-none border border-border group" @mouseenter="stopAutoPlay" @mouseleave="startAutoPlay">
    
    <!-- Slides Container -->
    <div 
      class="flex transition-transform duration-700 ease-out-expo h-[24rem] sm:h-[28rem] lg:h-[32rem]"
      :style="{ transform: `translateX(-${currentIndex * 100}%)` }"
    >
      <div 
        v-for="(project, index) in featuredProjects" 
        :key="project.name"
        class="w-full h-full shrink-0 relative cursor-pointer"
        @click="navigateToProject(project.name)"
      >
        <!-- Background Banner -->
        <img loading="lazy" :src="project.banner || ''" :alt="project.name" class="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
        
        <!-- Gradient Overlays -->
        <div class="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-transparent to-transparent"></div>
        
        <!-- Content -->
        <div class="absolute inset-0 p-8 sm:p-12 flex flex-col justify-end">
          <div class="max-w-2xl transform transition-all duration-700 translate-y-0" :class="{'opacity-0 translate-y-4': index !== currentIndex}">
            <div class="flex items-center gap-2 mb-4">
              <span class="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-amber-500/30 uppercase tracking-wider">
                <Star class="w-3.5 h-3.5 fill-current" /> 编辑推荐
              </span>
              <span class="inline-flex items-center gap-1 text-xs font-bold text-white bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                {{ project.status }}
              </span>
            </div>
            
            <div class="flex items-center gap-5 mb-4">
              <div class="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0 drop-shadow-xl">
                <img 
                  loading="lazy"
                  :src="project.icon || project.avatar || ''" 
                  class="w-full h-full object-contain"
                  @error="(e) => { (e.target as HTMLImageElement).src = getFallbackImage(project.name) }"
                />
              </div>
              <div>
                <h2 class="text-3xl sm:text-4xl font-extrabold text-white mb-1 line-clamp-1 drop-shadow-md">{{ project.name }}</h2>
                <p class="text-slate-300 font-medium flex items-center gap-2 drop-shadow-md">
                  <img :src="project.avatar || ''" class="w-5 h-5 rounded-full" @error="(e) => { (e.target as HTMLImageElement).src = getFallbackImage(project.developer) }" />
                  {{ project.developer }}
                </p>
              </div>
            </div>
            
            <p class="text-slate-200 line-clamp-2 sm:line-clamp-3 text-sm sm:text-base leading-relaxed max-w-xl drop-shadow-md mb-6">
              {{ project.description }}
            </p>
            
            <button class="inline-flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-6 py-2.5 rounded-xl font-bold transition-all border border-white/20 hover:border-white/40">
              获取应用
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Arrows -->
    <button 
      @click.stop="prevSlide" 
      class="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-white/10 hover:scale-110"
      aria-label="Previous slide"
    >
      <ChevronLeft class="w-6 h-6" />
    </button>
    <button 
      @click.stop="nextSlide" 
      class="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-white/10 hover:scale-110"
      aria-label="Next slide"
    >
      <ChevronRight class="w-6 h-6" />
    </button>

    <!-- Indicators -->
    <div class="absolute bottom-6 right-8 flex gap-2">
      <button 
        v-for="(_, index) in featuredProjects" 
        :key="index"
        @click.stop="goToSlide(index)"
        class="h-1.5 rounded-full transition-all duration-300"
        :class="index === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'"
        :aria-label="`Go to slide ${index + 1}`"
      ></button>
    </div>
  </div>
</template>

<style scoped>
.ease-out-expo {
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}
</style>

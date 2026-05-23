<script setup lang="ts">
import { useRouter } from 'vue-router';

const props = defineProps<{
  slug: string;
  title: string;
  subtitle?: string;
  category?: string;
  coverImage: string;
  theme?: 'dark' | 'light';
  date?: string;
}>();

const router = useRouter();
const open = () => router.push({ name: 'article-detail', params: { slug: props.slug } });
</script>

<template>
  <article
    class="group relative w-full h-[28rem] sm:h-[32rem] rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none border border-border cursor-pointer transform transition-all duration-500 hover:-translate-y-2"
    @click="open"
  >
    <img loading="lazy" :src="coverImage" :alt="title" class="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
    <div v-if="theme === 'light'" class="absolute inset-0 bg-gradient-to-b from-white/60 via-white/20 to-white/90" />
    <div v-else class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/80" />
    <div class="absolute inset-0 p-8 sm:p-10 flex flex-col justify-between" :class="theme === 'light' ? 'text-slate-900' : 'text-white'">
      <div>
        <span class="font-bold tracking-widest text-xs sm:text-sm uppercase opacity-80 mb-2 block">{{ category }}</span>
        <h2 class="text-3xl sm:text-5xl font-extrabold leading-tight mb-3">{{ title }}</h2>
        <p v-if="subtitle" class="text-lg sm:text-xl font-medium opacity-90 max-w-md">{{ subtitle }}</p>
      </div>
      <p v-if="date" class="text-sm opacity-70">{{ date }}</p>
    </div>
  </article>
</template>

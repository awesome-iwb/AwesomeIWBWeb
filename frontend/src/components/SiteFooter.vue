<script setup lang="ts">
import { ref } from 'vue';
import BrandMark from './BrandMark.vue';

type FooterOrg = {
  key: string;
  name: string;
  href: string;
};

const hzLogoOk = ref(true);

const orgs: FooterOrg[] = [
  {
    key: 'huizhizhuochuang',
    name: '汇智卓创',
    href: '#'
  },
  {
    key: 'smart-teach',
    name: 'Smart Teach',
    href: '#'
  },
  {
    key: 'awesome-iwb',
    name: 'Awesome IWB',
    href: '#'
  }
];
</script>

<template>
  <footer class="border-t border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/20 backdrop-blur-sm">
    <div class="max-w-7xl mx-auto px-6 py-8">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 items-center justify-items-center">
        <a
          v-for="org in orgs"
          :key="org.key"
          :href="org.href"
          class="group flex items-center justify-center w-full py-2 opacity-80 hover:opacity-100 transition-opacity"
        >
          <div v-if="org.key === 'huizhizhuochuang'" class="shrink-0 h-10 w-full max-w-64 flex items-center justify-center">
            <img
              v-if="hzLogoOk"
              src="/assets/partners/hz-logo.png"
              alt="汇智卓创"
              class="h-full w-full object-contain scale-100 sm:scale-[1.5]"
              @error="hzLogoOk = false"
            />
            <div v-else class="h-full w-full flex items-center justify-center text-slate-500 dark:text-slate-300 font-extrabold text-xs">
              LOGO
            </div>
          </div>
          <div v-else-if="org.key === 'smart-teach'" class="shrink-0 h-10 w-full max-w-64 flex items-center justify-center">
            <span class="text-slate-800 dark:text-slate-100 font-black tracking-tight text-lg">
              {{ org.name }}
            </span>
          </div>
          <div v-else-if="org.key === 'awesome-iwb'" class="shrink-0 w-full flex items-center justify-center">
            <BrandMark variant="footer" />
          </div>
          <div v-else class="h-9 w-24"></div>
        </a>
      </div>

      <div class="mt-10 text-center text-xs text-slate-400">
        <span>© {{ new Date().getFullYear() }} Awesome IWB</span>
      </div>
    </div>
  </footer>
</template>

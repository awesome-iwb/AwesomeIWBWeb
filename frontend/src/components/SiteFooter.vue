<script setup lang="ts">
import { ref } from 'vue';
import BrandMark from './BrandMark.vue';

type FooterOrg = {
  key: string;
  name: string;
  href: string;
};

type Maintainer = {
  key: string;
  name: string;
  role: string;
  linkLabel: string;
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
    key: 'pending',
    name: '',
    href: ''
  },
  {
    key: 'awesome-iwb',
    name: 'Awesome IWB',
    href: '#'
  }
];

const maintainers: Maintainer[] = [
  { key: 'm1', name: 'Maintainer', role: 'Role', linkLabel: '@handle', href: '#' },
  { key: 'm2', name: 'Maintainer', role: 'Role', linkLabel: '@handle', href: '#' },
  { key: 'm3', name: 'Maintainer', role: 'Role', linkLabel: '@handle', href: '#' },
  { key: 'm4', name: 'Maintainer', role: 'Role', linkLabel: '@handle', href: '#' }
];
</script>

<template>
  <footer class="border-t border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/20 backdrop-blur-sm">
    <div class="max-w-7xl mx-auto px-6 py-8">
      <div class="grid grid-cols-3 gap-8 items-center justify-items-center">
        <a
          v-for="org in orgs"
          :key="org.key"
          :href="org.href"
          class="group flex items-center justify-center py-2 opacity-80 hover:opacity-100 transition-opacity"
          :class="org.key === 'pending' ? 'pointer-events-none opacity-0' : ''"
        >
          <div v-if="org.key === 'huizhizhuochuang'" class="shrink-0">
            <img
              v-if="hzLogoOk"
              src="/images/hz-logo.png"
              alt="汇智卓创"
              class="h-9 w-auto object-contain"
              @error="hzLogoOk = false"
            />
            <div v-else class="h-9 w-24 flex items-center justify-center text-slate-500 dark:text-slate-300 font-extrabold text-xs">
              LOGO
            </div>
          </div>
          <div v-else-if="org.key === 'awesome-iwb'" class="shrink-0">
            <BrandMark variant="footer" />
          </div>
          <div v-else class="h-9 w-24"></div>
        </a>
      </div>

      <div class="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <a
          v-for="m in maintainers"
          :key="m.key"
          :href="m.href"
          class="group flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity"
        >
          <div class="h-10 w-10 rounded-full bg-slate-200/70 dark:bg-slate-700/70 shrink-0"></div>
          <div class="min-w-0">
            <div class="text-sm font-bold text-slate-700 dark:text-slate-200 line-clamp-1">{{ m.name }}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{{ m.role }}</div>
            <div class="text-xs text-emerald-600 dark:text-emerald-400 line-clamp-1">{{ m.linkLabel }}</div>
          </div>
        </a>
      </div>

      <div class="mt-10 text-center text-xs text-slate-400">
        <span>© {{ new Date().getFullYear() }} Awesome IWB</span>
      </div>
    </div>
  </footer>
</template>

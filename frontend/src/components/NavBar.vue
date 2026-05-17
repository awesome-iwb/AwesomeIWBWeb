<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Sun, Moon, Search, Github, Plus, Menu, X, ArrowLeft, LogIn, LogOut, Shield, Wrench } from 'lucide-vue-next';
import BrandMark from './BrandMark.vue';
import { useAuth, getAvatarDisplaySrc } from '../composables/useAuth';

const props = defineProps<{
  title?: string;
  showBack?: boolean;
  hideSearch?: boolean;
  transparent?: boolean;
}>();

const emit = defineEmits(['openSearch']);

const router = useRouter();
const route = useRoute();

const isDark = ref(false);
const isMobileMenuOpen = ref(false);
const isUserMenuOpen = ref(false);
const userMenuCloseTimer = ref<number | null>(null);

const { user, isAuthenticated, logout, hasCapability } = useAuth();

const userInitial = computed(() => (user.value?.name ? user.value.name.charAt(0).toUpperCase() : '?'));

const openUserMenu = () => {
  if (userMenuCloseTimer.value) {
    window.clearTimeout(userMenuCloseTimer.value);
    userMenuCloseTimer.value = null;
  }
  isUserMenuOpen.value = true;
};

const closeUserMenuSoon = () => {
  if (userMenuCloseTimer.value) window.clearTimeout(userMenuCloseTimer.value);
  userMenuCloseTimer.value = window.setTimeout(() => {
    isUserMenuOpen.value = false;
    userMenuCloseTimer.value = null;
  }, 120);
};

const closeUserMenuNow = () => {
  if (userMenuCloseTimer.value) window.clearTimeout(userMenuCloseTimer.value);
  userMenuCloseTimer.value = null;
  isUserMenuOpen.value = false;
};

const handleLogout = async () => {
  await logout();
  closeUserMenuNow();
  router.push('/');
};

const navLinks = [
  { path: '/', name: '应用商场' },
  { path: '/today', name: 'Today 精选' },
  { path: '/about', name: '关于我们' }
];

const linkRefs = ref<HTMLElement[]>([]);
const activeIndicatorStyle = ref({ width: '0px', transform: 'translateX(0px)', opacity: 0 });

const updateIndicator = () => {
  // Give Vue router and DOM time to render the new route classes
  setTimeout(() => {
    const activeIndex = navLinks.findIndex(link => route.path === link.path);
    if (activeIndex !== -1 && linkRefs.value[activeIndex]) {
      // linkRefs.value[activeIndex] might be a Vue component wrapper (router-link), get its $el
      const el = (linkRefs.value[activeIndex] as any).$el || linkRefs.value[activeIndex];
      if (el && el.offsetWidth) {
        activeIndicatorStyle.value = {
          width: `${el.offsetWidth}px`,
          transform: `translateX(${el.offsetLeft}px)`,
          opacity: 1
        };
        return;
      }
    }
    activeIndicatorStyle.value.opacity = 0;
  }, 50);
};

watch(() => route.path, updateIndicator, { immediate: true });

onMounted(() => {
  updateIndicator();
  window.addEventListener('resize', updateIndicator);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateIndicator);
});

const toggleDark = () => {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
};

const checkTheme = () => {
  if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true;
    document.documentElement.classList.add('dark');
  } else {
    isDark.value = false;
    document.documentElement.classList.remove('dark');
  }
};

onMounted(() => {
  checkTheme();
  
  // Handle Cmd/Ctrl + K to open search globally
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      emit('openSearch');
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
});

onMounted(() => {
  const onDocClick = (e: MouseEvent) => {
    if (!isUserMenuOpen.value) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-user-menu-root="1"]')) return;
    closeUserMenuNow();
  };
  window.addEventListener('click', onDocClick);
  onUnmounted(() => window.removeEventListener('click', onDocClick));
});
</script>

<template>
  <nav class="sticky top-0 z-40 w-full transition-colors duration-300"
    :class="transparent ? 'bg-transparent border-b-0' : 'border-b border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-[#0B1120]/70 backdrop-blur-xl backdrop-saturate-150'">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      
      <!-- Left: Logo & Links -->
      <div class="flex items-center gap-8">
        <button 
          v-if="showBack"
          @click="router.back()" 
          class="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium transition-colors"
        >
          <ArrowLeft class="w-5 h-5" />
          <span class="hidden sm:inline">返回</span>
        </button>
        <div class="cursor-pointer" @click="router.push('/')">
          <BrandMark :title="title" variant="navbar" />
        </div>
        
        <!-- Desktop Links with Sliding Indicator -->
        <div v-if="!showBack" class="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 relative">
          <!-- The sliding green bar -->
          <div 
            class="absolute bottom-0 h-0.5 bg-emerald-500 dark:bg-emerald-400 transition-all duration-300 ease-out"
            :style="activeIndicatorStyle"
          ></div>
          
          <router-link 
            v-for="(link, index) in navLinks" 
            :key="link.path"
            :to="link.path"
            :ref="el => { if (el) linkRefs[index] = el as any }"
            class="px-3 py-2 transition-colors relative"
            :class="route.path === link.path ? 'text-emerald-600 dark:text-emerald-400' : 'hover:text-emerald-600 dark:hover:text-emerald-400'"
          >
            {{ link.name }}
          </router-link>
        </div>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-2 sm:gap-4 text-sm font-medium" :class="transparent ? 'text-white' : 'text-slate-600 dark:text-slate-300'">
        <!-- Search Button -->
        <div class="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]" :class="[hideSearch ? 'w-0 opacity-0 translate-x-4' : 'w-auto opacity-100 translate-x-0']">
          <button 
            @click="emit('openSearch')"
            class="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
          >
            <Search class="w-4 h-4 shrink-0" />
            <span class="text-xs whitespace-nowrap">搜索</span>
            <kbd class="hidden lg:inline-flex items-center gap-1 font-sans text-[10px] bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0">
              <span class="text-xs">⌘</span>K
            </kbd>
          </button>

          <!-- Search Icon Mobile -->
          <button @click="emit('openSearch')" class="sm:hidden p-2 rounded-lg transition-colors" :class="transparent ? 'hover:bg-white/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'">
            <Search class="w-5 h-5 shrink-0" />
          </button>
        </div>

        <button 
          @click="$router.push('/submit')"
          class="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl transition-colors font-bold"
        >
          <Plus class="w-4 h-4" /> 提交项目
        </button>

        <button @click="toggleDark" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" aria-label="Toggle Dark Mode">
          <Sun v-if="isDark" class="w-5 h-5 text-amber-400" />
          <Moon v-else class="w-5 h-5 text-slate-600" />
        </button>

        <a href="https://github.com/awesome-iwb/awesome-iwb" target="_blank" class="hidden sm:flex p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <Github class="w-5 h-5" />
        </a>

        <div
          class="hidden sm:flex relative"
          data-user-menu-root="1"
          @mouseenter="openUserMenu"
          @mouseleave="closeUserMenuSoon"
        >
          <button
            class="h-10 w-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors overflow-hidden flex items-center justify-center"
            @click="isUserMenuOpen = !isUserMenuOpen"
            aria-label="User menu"
          >
            <img v-if="user" :src="getAvatarDisplaySrc(user)" class="h-full w-full object-cover" />
            <span v-else class="text-sm font-extrabold text-slate-600 dark:text-slate-200">{{ userInitial }}</span>
          </button>

          <div
            v-if="isUserMenuOpen"
            class="absolute right-0 top-12 w-72 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-xl shadow-2xl shadow-slate-900/10 dark:shadow-black/40 overflow-hidden"
            @mouseenter="openUserMenu"
            @mouseleave="closeUserMenuSoon"
          >
            <div class="p-4 flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-slate-200/70 dark:bg-slate-700/70 overflow-hidden shrink-0">
                <img v-if="user" :src="getAvatarDisplaySrc(user)" class="h-full w-full object-cover" />
              </div>
              <div class="min-w-0">
                <div class="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">
                  {{ user?.name || '未登录' }}
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {{ isAuthenticated ? '已登录' : '登录后可提交项目' }}
                </div>
              </div>
            </div>

            <div class="px-4 pb-4 space-y-2">
              <button
                v-if="!isAuthenticated"
                @click="closeUserMenuNow(); router.push('/me')"
                class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold transition-colors"
              >
                <LogIn class="w-4 h-4" />
                智教联盟登录
              </button>

              <div v-else class="space-y-2">
                <button
                  @click="closeUserMenuNow(); router.push('/me')"
                  class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  个人中心
                </button>
                <button
                  v-if="hasCapability('admin_panel_access')"
                  @click="closeUserMenuNow(); router.push('/admin')"
                  class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-extrabold transition-colors"
                >
                  <Shield class="w-4 h-4" />
                  运维后台
                </button>
                <button
                  v-if="hasCapability('dev_panel_access')"
                  @click="closeUserMenuNow(); router.push('/dev')"
                  class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-extrabold transition-colors"
                >
                  <Wrench class="w-4 h-4" />
                  开发者后台
                </button>
                <button
                  @click="handleLogout"
                  class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
                >
                  <LogOut class="w-4 h-4" />
                  退出登录
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile Menu Toggle -->
        <button
          @click="router.push('/me')"
          class="sm:hidden p-2 rounded-lg transition-colors"
          :class="transparent ? 'hover:bg-white/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'"
          aria-label="Me"
        >
          <div class="h-6 w-6 rounded-full overflow-hidden flex items-center justify-center" :class="transparent ? 'bg-white/20 border border-white/30' : 'bg-slate-200/70 dark:bg-slate-700/70'">
            <img v-if="user" :src="getAvatarDisplaySrc(user)" class="h-full w-full object-cover" />
            <span v-else class="text-[10px] font-extrabold text-slate-600 dark:text-slate-200">{{ userInitial }}</span>
          </div>
        </button>
        <button @click="isMobileMenuOpen = !isMobileMenuOpen" class="md:hidden p-2 rounded-lg transition-colors" :class="transparent ? 'hover:bg-white/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'">
          <Menu v-if="!isMobileMenuOpen" class="w-5 h-5" />
          <X v-else class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Mobile Dropdown Menu -->
    <div v-if="isMobileMenuOpen" class="md:hidden absolute top-16 left-0 w-full bg-white dark:bg-[#0B1120] border-b border-slate-200 dark:border-slate-800 shadow-xl py-4 px-6 flex flex-col gap-4">
      <router-link @click="isMobileMenuOpen = false" to="/me" class="text-lg font-bold text-slate-800 dark:text-slate-200">个人中心</router-link>
      <div class="h-px w-full bg-slate-100 dark:bg-slate-800 my-2"></div>
      <button 
        @click="() => { isMobileMenuOpen = false; $router.push('/submit'); }"
        class="flex items-center justify-center gap-2 w-full py-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold"
      >
        <Plus class="w-5 h-5" /> 提交新项目
      </button>
      <a href="https://github.com/awesome-iwb/awesome-iwb" target="_blank" class="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold">
        <Github class="w-5 h-5" /> GitHub 仓库
      </a>
    </div>
  </nav>
</template>

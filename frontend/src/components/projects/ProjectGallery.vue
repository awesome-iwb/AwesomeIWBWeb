<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';
import { ChevronLeft, ChevronRight, Play, ExternalLink, Images } from 'lucide-vue-next';
import type { GalleryItem } from '../../composables/useProjects';
import { useAnalytics } from '../../composables/useAnalytics';
import { safeExternalUrl } from '../../lib/safeUrl';
import ProjectGalleryLightbox from './ProjectGalleryLightbox.vue';

const props = withDefaults(
  defineProps<{
    items: GalleryItem[];
    autoplay?: boolean;
    intervalMs?: number;
  }>(),
  { autoplay: true, intervalMs: 5000 }
);

const { trackGallery } = useAnalytics();

/** 后端已按 sort_index 排序且只下发启用项，这里只做一次防御性过滤。 */
const slides = computed(() => (props.items ?? []).filter((i) => i && i.is_enabled !== false));
const hasMultiple = computed(() => slides.value.length > 1);

const scroller = ref<HTMLElement | null>(null);
const slideEls = ref<HTMLElement[]>([]);
const activeIndex = ref(0);
const activeVideoId = ref<string | null>(null);
const lightboxIndex = ref<number | null>(null);
const isHovering = ref(false);
const isFocusWithin = ref(false);

const setSlideEl = (el: any, index: number) => {
  if (el) slideEls.value[index] = el as HTMLElement;
};

/**
 * 用滚动位置反推当前项，而不是维护独立的 index 状态。
 * 触摸滑动、trackpad、滚轮都不经过翻页函数，只有以滚动为唯一真相
 * 才不会出现指示点和实际画面对不上。
 */
let scrollRaf = 0;
const onScroll = () => {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    const el = scroller.value;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    slideEls.value.forEach((slide, i) => {
      if (!slide) return;
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const dist = Math.abs(slideCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    activeIndex.value = best;
  });
};

const goTo = (index: number, behavior: ScrollBehavior = 'smooth') => {
  const el = scroller.value;
  const total = slides.value.length;
  if (!el || total === 0) return;
  const target = ((index % total) + total) % total;
  const slide = slideEls.value[target];
  if (!slide) return;
  el.scrollTo({ left: slide.offsetLeft - el.offsetLeft, behavior });
  activeIndex.value = target;
};

/** 用户手动操作后暂时让路，避免"刚划过去它又自己跳走"。 */
const interactionPauseUntil = ref(0);
const pauseAutoplayForInteraction = () => {
  interactionPauseUntil.value = Date.now() + 10000;
};

const next = () => goTo(activeIndex.value + 1);
const prev = () => goTo(activeIndex.value - 1);

const onArrow = (dir: 1 | -1) => {
  pauseAutoplayForInteraction();
  if (dir === 1) next();
  else prev();
};

const onDot = (i: number) => {
  pauseAutoplayForInteraction();
  goTo(i);
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    onArrow(1);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    onArrow(-1);
  }
};

const prefersReducedMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

let autoplayTimer: ReturnType<typeof setInterval> | null = null;

const canAutoplay = computed(
  () =>
    props.autoplay &&
    !prefersReducedMotion &&
    hasMultiple.value &&
    activeVideoId.value === null &&
    lightboxIndex.value === null &&
    !isHovering.value &&
    !isFocusWithin.value
);

const tick = () => {
  if (!canAutoplay.value) return;
  if (Date.now() < interactionPauseUntil.value) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  next();
};

const stopAutoplay = () => {
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
};

const startAutoplay = () => {
  stopAutoplay();
  if (!canAutoplay.value) return;
  autoplayTimer = setInterval(tick, Math.max(2000, props.intervalMs));
};

watch(canAutoplay, (ok) => (ok ? startAutoplay() : stopAutoplay()));

/**
 * 曝光判定：可见过半 + 停留满 1 秒。
 * 快速划过不计入，否则曝光数会被滑动行为灌水。
 * 每个条目每次页面生命周期只报一次（Set 去重 + unobserve）。
 */
const reported = new Set<string>();
const dwellTimers = new Map<string, ReturnType<typeof setTimeout>>();
let observer: IntersectionObserver | null = null;

const clearDwell = (id: string) => {
  const t = dwellTimers.get(id);
  if (t) {
    clearTimeout(t);
    dwellTimers.delete(id);
  }
};

const setupObserver = () => {
  if (typeof IntersectionObserver === 'undefined') return;
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.itemId;
        if (!id || reported.has(id)) continue;
        if (entry.isIntersecting) {
          if (dwellTimers.has(id)) continue;
          dwellTimers.set(
            id,
            setTimeout(() => {
              dwellTimers.delete(id);
              if (reported.has(id)) return;
              reported.add(id);
              trackGallery(id, 'impression');
              const el = slideEls.value.find((s) => s?.dataset.itemId === id);
              if (el && observer) observer.unobserve(el);
            }, 1000)
          );
        } else {
          clearDwell(id);
        }
      }
    },
    { threshold: 0.5 }
  );
  slideEls.value.forEach((el) => {
    if (el && el.dataset.itemId && !reported.has(el.dataset.itemId)) observer!.observe(el);
  });
};

const itemHref = (item: GalleryItem): string => {
  if (item.linked_project_slug) return `/project/${encodeURIComponent(item.linked_project_slug)}`;
  if (item.link_url) return safeExternalUrl(item.link_url);
  return '';
};

const isInternalHref = (item: GalleryItem) => Boolean(item.linked_project_slug);

const onItemClick = (item: GalleryItem) => {
  trackGallery(item.id, 'click');
};

const openLightbox = (index: number) => {
  const item = slides.value[index];
  if (!item) return;
  trackGallery(item.id, 'click');
  lightboxIndex.value = index;
};

const playVideo = (item: GalleryItem) => {
  if (!item.video_embed_url) return;
  trackGallery(item.id, 'click');
  activeVideoId.value = item.id;
};

const videoProviderLabel = (p: string) =>
  p === 'bilibili' ? '哔哩哔哩' : p === 'tencent' ? '腾讯视频' : p === 'youku' ? '优酷' : '视频';

/** 只有图片进灯箱；文字卡和视频卡在原位交互。 */
const imageSlideIndexes = computed(() =>
  slides.value.map((s, i) => (s.media_type === 'image' && s.image_url ? i : -1)).filter((i) => i >= 0)
);

onMounted(async () => {
  await nextTick();
  setupObserver();
  startAutoplay();
});

watch(
  () => slides.value.map((s) => s.id).join(','),
  async () => {
    // 路由切到另一个项目时槽位整体换掉，旧的 ref 要清空重建
    slideEls.value = [];
    activeIndex.value = 0;
    activeVideoId.value = null;
    await nextTick();
    setupObserver();
    startAutoplay();
  }
);

onBeforeUnmount(() => {
  stopAutoplay();
  observer?.disconnect();
  observer = null;
  dwellTimers.forEach((t) => clearTimeout(t));
  dwellTimers.clear();
  if (scrollRaf) cancelAnimationFrame(scrollRaf);
});
</script>

<template>
  <section
    v-if="slides.length > 0"
    class="mb-12"
    role="region"
    aria-roledescription="carousel"
    aria-label="项目详情图"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
    @focusin="isFocusWithin = true"
    @focusout="isFocusWithin = false"
  >
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-2xl font-bold text-foreground flex items-center gap-2">
        <Images class="w-6 h-6 text-emerald-500" /> 项目详情
      </h2>
      <div v-if="hasMultiple" class="hidden sm:flex items-center gap-2">
        <button
          type="button"
          class="w-10 h-10 rounded-full bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground border border-border flex items-center justify-center transition-colors"
          aria-label="上一张"
          @click="onArrow(-1)"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>
        <button
          type="button"
          class="w-10 h-10 rounded-full bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground border border-border flex items-center justify-center transition-colors"
          aria-label="下一张"
          @click="onArrow(1)"
        >
          <ChevronRight class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!--
      横向 scroll-snap 而非 translateX：原生滚动自带触摸惯性、trackpad
      与无障碍滚动条支持，不用手写拖拽手势。
    -->
    <div
      ref="scroller"
      tabindex="0"
      class="gallery-scroller flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-2xl"
      @scroll.passive="onScroll"
      @keydown="onKeydown"
      @pointerdown="pauseAutoplayForInteraction"
    >
      <div
        v-for="(item, index) in slides"
        :key="item.id"
        :ref="(el) => setSlideEl(el, index)"
        :data-item-id="item.id"
        class="snap-start shrink-0 w-[85%] sm:w-[420px] lg:w-[520px]"
        role="group"
        aria-roledescription="slide"
        :aria-label="`${index + 1} / ${slides.length}`"
      >
        <!-- 图片 -->
        <template v-if="item.media_type === 'image'">
          <button
            type="button"
            class="group w-full aspect-video rounded-2xl overflow-hidden border border-border bg-muted/40 relative block cursor-zoom-in"
            :aria-label="item.title || `查看第 ${index + 1} 张详情图`"
            @click="openLightbox(index)"
          >
            <img
              :src="item.image_url"
              :alt="item.title || `详情图 ${index + 1}`"
              class="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
              :loading="index === 0 ? 'eager' : 'lazy'"
              :fetchpriority="index === 0 ? 'high' : 'auto'"
              decoding="async"
            />
          </button>
        </template>

        <!-- 视频外链：点击后才注入 iframe，避免一进页面就加载多个第三方播放器 -->
        <template v-else-if="item.media_type === 'video_embed'">
          <div class="w-full aspect-video rounded-2xl overflow-hidden border border-border bg-black relative">
            <iframe
              v-if="activeVideoId === item.id"
              :src="item.video_embed_url"
              class="w-full h-full"
              frameborder="0"
              scrolling="no"
              referrerpolicy="no-referrer"
              allow="fullscreen; encrypted-media; picture-in-picture"
              allowfullscreen
              :title="item.title || videoProviderLabel(item.video_provider)"
            ></iframe>
            <button
              v-else
              type="button"
              class="group absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-900 to-slate-800 text-white/90 hover:text-white transition-colors"
              :aria-label="`播放视频：${item.title || videoProviderLabel(item.video_provider)}`"
              @click="playVideo(item)"
            >
              <span
                class="w-16 h-16 rounded-full bg-white/15 backdrop-blur flex items-center justify-center border border-white/25 group-hover:scale-105 transition-transform"
              >
                <Play class="w-7 h-7 fill-current ml-1" />
              </span>
              <span class="text-sm font-semibold">{{ videoProviderLabel(item.video_provider) }}</span>
            </button>
          </div>
        </template>

        <!-- 文字卡 -->
        <template v-else>
          <component
            :is="itemHref(item) ? 'a' : 'div'"
            v-bind="
              itemHref(item)
                ? isInternalHref(item)
                  ? { href: itemHref(item) }
                  : { href: itemHref(item), target: '_blank', rel: 'noopener noreferrer' }
                : {}
            "
            class="w-full aspect-video rounded-2xl border border-emerald-200/60 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 p-6 sm:p-8 flex flex-col justify-center"
            :class="itemHref(item) ? 'hover:shadow-lg hover:-translate-y-0.5 transition-all' : ''"
            @click="itemHref(item) ? onItemClick(item) : null"
          >
            <h3 v-if="item.title" class="text-xl sm:text-2xl font-extrabold text-emerald-900 dark:text-emerald-300 mb-2 line-clamp-2">
              {{ item.title }}
            </h3>
            <p class="text-emerald-900/75 dark:text-emerald-200/75 leading-relaxed line-clamp-4">{{ item.caption }}</p>
            <span
              v-if="itemHref(item)"
              class="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-400"
            >
              {{ item.linked_project_name || '了解更多' }}
              <ExternalLink class="w-4 h-4" />
            </span>
          </component>
        </template>

        <!-- 图片 / 视频的说明文字与跳转 -->
        <div v-if="item.media_type !== 'text'" class="mt-3 px-1">
          <p v-if="item.title" class="text-sm font-bold text-foreground truncate">{{ item.title }}</p>
          <p v-if="item.caption" class="text-sm text-muted-foreground line-clamp-2 mt-0.5">{{ item.caption }}</p>
          <a
            v-if="itemHref(item)"
            :href="itemHref(item)"
            :target="isInternalHref(item) ? undefined : '_blank'"
            :rel="isInternalHref(item) ? undefined : 'noopener noreferrer'"
            class="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            @click="onItemClick(item)"
          >
            {{ item.linked_project_name || '查看详情' }}
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>

    <!-- 指示点 -->
    <div v-if="hasMultiple" class="flex items-center justify-center gap-2 mt-2">
      <button
        v-for="(item, i) in slides"
        :key="`dot-${item.id}`"
        type="button"
        class="h-2 rounded-full transition-all"
        :class="i === activeIndex ? 'w-6 bg-emerald-500' : 'w-2 bg-border hover:bg-muted-foreground/40'"
        :aria-label="`跳到第 ${i + 1} 张`"
        :aria-current="i === activeIndex ? 'true' : undefined"
        @click="onDot(i)"
      ></button>
    </div>

    <ProjectGalleryLightbox
      v-if="lightboxIndex !== null"
      :items="slides"
      :start-index="lightboxIndex"
      :image-indexes="imageSlideIndexes"
      @close="lightboxIndex = null"
    />
  </section>
</template>

<style scoped>
/* 隐藏滚动条但保留滚动能力：轮播下方已有指示点，横向滚动条会打断视觉。 */
.gallery-scroller {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.gallery-scroller::-webkit-scrollbar {
  display: none;
}
</style>

export type GalleryTrackEvent = { itemId: string; type: 'impression' | 'click' };

/**
 * 详情图埋点缓冲区。
 *
 * 模块级单例，而不是每个 useAnalytics() 调用一份 —— 一个页面上可能有多个组件
 * 同时上报，共用缓冲区才能真正合并成一次请求。
 */
const galleryQueue: GalleryTrackEvent[] = [];
let galleryFlushTimer: ReturnType<typeof setTimeout> | null = null;
const GALLERY_FLUSH_DELAY_MS = 3000;
/** 与后端 MAX_GALLERY_TRACK_EVENTS 对齐，超出的直接丢弃而不是发一个会被截断的包。 */
const GALLERY_MAX_BATCH = 50;

function sendGalleryBatch(events: GalleryTrackEvent[]) {
  if (events.length === 0) return;
  const body = JSON.stringify({ events });
  try {
    // sendBeacon 在页面卸载时也能送达，是埋点的正确工具。
    if (navigator.sendBeacon('/api/track/gallery', new Blob([body], { type: 'application/json' }))) {
      return;
    }
  } catch {}
  // sendBeacon 不可用或被拒（例如队列已满）时降级。keepalive 让卸载中的请求也有机会完成。
  try {
    void fetch('/api/track/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

function flushGalleryQueue() {
  if (galleryFlushTimer) {
    clearTimeout(galleryFlushTimer);
    galleryFlushTimer = null;
  }
  if (galleryQueue.length === 0) return;
  const batch = galleryQueue.splice(0, galleryQueue.length);
  for (let i = 0; i < batch.length; i += GALLERY_MAX_BATCH) {
    sendGalleryBatch(batch.slice(i, i + GALLERY_MAX_BATCH));
  }
}

let galleryLifecycleBound = false;
function bindGalleryLifecycle() {
  if (galleryLifecycleBound || typeof document === 'undefined') return;
  galleryLifecycleBound = true;
  // visibilitychange 是移动端唯一可靠的“页面要走了”信号，pagehide 覆盖 bfcache。
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushGalleryQueue();
  });
  window.addEventListener('pagehide', flushGalleryQueue);
}

export function useAnalytics() {
  const trackPageView = (path: string, referrer?: string) => {
    try {
      navigator.sendBeacon(
        '/api/track/pageview',
        new Blob([JSON.stringify({ path, referrer: referrer || document.referrer })], { type: 'application/json' })
      );
    } catch {}
  };

  const trackClick = (projectSlug: string, eventType: 'click' | 'download' | 'github') => {
    try {
      navigator.sendBeacon(
        '/api/track/click',
        new Blob([JSON.stringify({ projectSlug, eventType })], { type: 'application/json' })
      );
    } catch {}
  };

  const trackSearch = (query: string, resultsCount: number) => {
    if (!query.trim()) return;
    try {
      navigator.sendBeacon(
        '/api/track/search',
        new Blob([JSON.stringify({ query: query.trim(), resultsCount })], { type: 'application/json' })
      );
    } catch {}
  };

  /**
   * 详情图曝光 / 点击上报。
   *
   * 攒批 3 秒再发：轮播滑动会在短时间内产生密集曝光，逐条发请求既浪费又容易被限流。
   * 点击同样进队列而不是立刻发 —— 页面跳转由 pagehide / visibilitychange 兜底 flush。
   */
  const trackGallery = (itemId: string, type: 'impression' | 'click') => {
    if (!itemId) return;
    bindGalleryLifecycle();
    galleryQueue.push({ itemId, type });
    if (galleryQueue.length >= GALLERY_MAX_BATCH) {
      flushGalleryQueue();
      return;
    }
    if (!galleryFlushTimer) {
      galleryFlushTimer = setTimeout(flushGalleryQueue, GALLERY_FLUSH_DELAY_MS);
    }
  };

  return { trackPageView, trackClick, trackSearch, trackGallery, flushGalleryQueue };
}

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

  return { trackPageView, trackClick, trackSearch };
}

export function safeExternalUrl(value: unknown, fallback = '#'): string {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw, 'https://aiwb.stcn.moe');
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
      return url.href;
    }
  } catch {}
  return fallback;
}

export function openBlankNoopener(url: string): Window | null {
  const child = window.open(url, '_blank', 'noopener,noreferrer');
  if (child) {
    try {
      child.opener = null;
    } catch {}
  }
  return child;
}

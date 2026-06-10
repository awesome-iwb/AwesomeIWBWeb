import DOMPurify from 'dompurify';

const SAFE_URI_REGEXP = /^(?:(?:https?|mailto):|\/(?!\/)|#|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i;
const DEFAULT_FORBID_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'base', 'meta', 'link'];
const DEFAULT_FORBID_ATTRS = ['style', 'srcdoc', 'srcset'];

export function isSafeContentUri(value: string | null | undefined): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return true;
  if (raw.startsWith('//')) return false;
  if (raw.startsWith('/') || raw.startsWith('#')) return true;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) return true;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}

function getDomPurifySanitize(): ((html: string, options: Record<string, unknown>) => unknown) | null {
  const candidate = DOMPurify as any;
  if (typeof candidate?.sanitize === 'function') return candidate.sanitize.bind(candidate);
  if (typeof candidate?.default?.sanitize === 'function') return candidate.default.sanitize.bind(candidate.default);
  return null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fallbackSanitize(html: string, options: Record<string, unknown>): string {
  const forbidTags = [...new Set([...DEFAULT_FORBID_TAGS, ...stringArray(options.FORBID_TAGS)])];
  const forbidAttrs = [...new Set([...DEFAULT_FORBID_ATTRS, ...stringArray(options.FORBID_ATTR)])];
  let safe = html;

  for (const tag of forbidTags) {
    const escaped = escapeRegExp(tag);
    safe = safe.replace(new RegExp(`<\\s*${escaped}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${escaped}\\s*>`, 'gi'), '');
    safe = safe.replace(new RegExp(`<\\/?\\s*${escaped}\\b[^>]*>`, 'gi'), '');
  }

  const attrPattern = [...forbidAttrs.map(escapeRegExp), 'on[a-z0-9_-]+'].join('|');
  safe = safe.replace(
    new RegExp(`\\s(?:${attrPattern})\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'=<>]+)`, 'gi'),
    ''
  );

  return safe.replace(
    /\s((?:href|src|xlink:href|formaction|poster))\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>]+))/gi,
    (match, _attr, _quoted, dq, sq, bare) => {
      const uri = dq ?? sq ?? bare ?? '';
      return isSafeContentUri(uri) ? match : '';
    }
  );
}

export function sanitizeHtml(html: string, options: Record<string, unknown> = {}): string {
  const sanitizeFn = getDomPurifySanitize();
  const forbidTags = [...new Set([...DEFAULT_FORBID_TAGS, ...stringArray(options.FORBID_TAGS)])];
  const forbidAttrs = [...new Set([...DEFAULT_FORBID_ATTRS, ...stringArray(options.FORBID_ATTR)])];
  const mergedOptions = {
    ALLOWED_URI_REGEXP: SAFE_URI_REGEXP,
    ...options,
    FORBID_TAGS: forbidTags,
    FORBID_ATTR: forbidAttrs,
  };
  if (sanitizeFn) {
    return String(sanitizeFn(html, mergedOptions));
  }
  return fallbackSanitize(html, mergedOptions);
}

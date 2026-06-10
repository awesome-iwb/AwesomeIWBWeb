import MarkdownIt from 'markdown-it';
import { isSafeContentUri, sanitizeHtml } from './sanitizeHtml';

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
});

md.validateLink = isSafeContentUri;

function sanitizeRenderedMarkdown(html: string): string {
  return sanitizeHtml(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
    ADD_ATTR: ['target', 'rel'],
  });
}

export function renderSafeMarkdown(text: string): string {
  if (!text) return '';
  return sanitizeRenderedMarkdown(md.render(String(text))).replace(/<a\s+([^>]*href="([^"]+)"[^>]*)>/gi, (match, attrs, href) => {
    if (!isSafeContentUri(href)) return match.replace(/href="[^"]*"/i, 'href="#"');
    if (/\starget=/i.test(attrs)) return match;
    return `<a ${attrs} target="_blank" rel="noopener noreferrer">`;
  });
}

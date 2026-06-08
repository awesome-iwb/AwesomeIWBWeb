import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import katex from 'katex';
import hljs from 'highlight.js';
import { replaceWikilinksForMarkdown } from './wikilink';

export type ArticleContentFormat = 'markdown' | 'html' | 'latex' | 'plain' | 'flarum';

// Custom markdown-it plugin to parse math equations
const mathPlugin = (md: MarkdownIt) => {
  // Parse inline and block math
  md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
    const src = state.src;
    const max = state.posMax;
    const start = state.pos;
    
    if (src[start] !== '$') return false;
    
    // Check if it's block math ($$)
    let isBlock = false;
    if (start + 1 < max && src[start + 1] === '$') {
      isBlock = true;
    }
    
    const openMarker = isBlock ? '$$' : '$';
    const closeMarker = isBlock ? '$$' : '$';
    const startContent = start + openMarker.length;
    
    const end = src.indexOf(closeMarker, startContent);
    if (end === -1 || end > max) return false;
    if (end === startContent) return false;
    
    if (!isBlock) {
      // Inline math must not span multiple lines
      const content = src.slice(startContent, end);
      if (content.includes('\n')) return false;
      
      // Inline math markers cannot be adjacent to spaces
      if (src[startContent] === ' ') return false;
      if (src[end - 1] === ' ') return false;
    }
    
    if (!silent) {
      const content = src.slice(startContent, end).trim();
      const token = state.push(isBlock ? 'math_block' : 'math_inline', 'math', 0);
      token.content = content;
      token.markup = openMarker;
    }
    
    state.pos = end + closeMarker.length;
    return true;
  });
  
  // Render formulas with KaTeX
  md.renderer.rules.math_inline = (tokens, idx) => {
    try {
      return katex.renderToString(tokens[idx].content, { displayMode: false, throwOnError: false });
    } catch {
      return `<code class="katex-error">${escapeHtml(tokens[idx].content)}</code>`;
    }
  };
  
  md.renderer.rules.math_block = (tokens, idx) => {
    try {
      return katex.renderToString(tokens[idx].content, { displayMode: true, throwOnError: false });
    } catch {
      return `<pre class="katex-error">${escapeHtml(tokens[idx].content)}</pre>`;
    }
  };
};

const md = new MarkdownIt({ html: true, breaks: true, linkify: true });
md.use(mathPlugin);

// Custom code block renderer (fence)
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const code = token.content;
  const lang = token.info.trim();
  
  let highlighted = escapeHtml(code);
  if (lang && hljs.getLanguage(lang)) {
    try {
      highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } catch (__) {}
  }
  
  const langLabel = lang ? lang.toUpperCase() : 'TEXT';
  const encodedCode = encodeURIComponent(code);
  
  return `
<div class="code-block-wrapper my-4 rounded-xl overflow-hidden border border-border bg-[#1e1e2e] text-slate-200">
  <div class="code-block-header flex items-center justify-between px-4 py-1.5 bg-slate-900/60 text-xs font-semibold text-slate-400 border-b border-border/40 select-none">
    <span>${langLabel}</span>
    <button class="copy-code-btn flex items-center gap-1 hover:text-slate-200 active:scale-95 transition-all cursor-pointer" data-code="${encodedCode}">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      <span>复制</span>
    </button>
  </div>
  <pre class="hljs p-4 overflow-x-auto m-0 text-sm leading-relaxed font-mono bg-transparent"><code>${highlighted}</code></pre>
</div>
`;
};

function sanitize(html: string) {
  const sanitizeFn = (DOMPurify && typeof DOMPurify.sanitize === 'function')
    ? DOMPurify.sanitize
    : ((DOMPurify as any)?.default?.sanitize || (DOMPurify as any)?.sanitize);
    
  if (typeof sanitizeFn !== 'function') {
    return html;
  }
  
  return String(
    sanitizeFn(html, {
      USE_PROFILES: { html: true, mathMl: true },
      ADD_TAGS: [
        'span', 'math', 'annotation', 'semantics', 'mrow', 'mi', 'mo', 'mn',
        'svg', 'path', 'circle', 'line', 'rect', 'input', 'blockquote',
        'figure', 'figcaption'
      ],
      ADD_ATTR: [
        'class', 'style', 'aria-hidden', 'data-code', 'data-anchor',
        'data-callout-type', 'data-poll-name', 'data-poll-options',
        'viewBox', 'fill', 'stroke', 'stroke-width',
        'stroke-linecap', 'stroke-linejoin', 'x', 'y', 'width', 'height',
        'rx', 'ry', 'x1', 'x2', 'y1', 'y2', 'd', 'cx', 'cy', 'r', 'type',
        'disabled', 'checked'
      ],
    })
  );
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replaceCallouts(text: string): string {
  return text.replace(/^:::\s*(note|tip|warning|error)\r?\n([\s\S]*?)\r?\n:::\s*$/gm, (_, type, content) => {
    return `<div class="callout-block callout-${type}" data-callout-type="${type}">\n\n${content}\n\n</div>`;
  });
}

function renderCallouts(html: string): string {
  return html.replace(/<div class="callout-block callout-(note|tip|warning|error)" data-callout-type="\1">([\s\S]*?)<\/div>/g, (_, type, content) => {
    const titles = { note: '备注', warning: '警告', tip: '提示', error: '错误' };
    const icons = {
      note: `<svg class="w-5 h-5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
      warning: `<svg class="w-5 h-5 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      tip: `<svg class="w-5 h-5 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>`,
      error: `<svg class="w-5 h-5 text-rose-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
    };
    const title = titles[type as keyof typeof titles];
    const icon = icons[type as keyof typeof icons];
    return `
<div class="callout-block callout-${type} my-4 p-4 rounded-xl border flex gap-3">
  <div class="callout-icon">${icon}</div>
  <div class="callout-content flex-1">
    <div class="callout-title text-xs font-bold uppercase tracking-wider mb-1 opacity-80">${title}</div>
    <div class="callout-body text-sm leading-relaxed">${content.trim()}</div>
  </div>
</div>
`;
  });
}

function replaceFlarumElements(text: string): string {
  // Parse [upl-image-preview uuid=... url=... alt=...]
  let result = text.replace(/\[upl-image-preview\s+([^\]]+)\]/g, (match, attrsStr) => {
    const urlMatch = attrsStr.match(/url=([^\s\]]+)/);
    const altMatch = attrsStr.match(/alt=([^\s\]]+)/) || attrsStr.match(/alt="([^"]*)"/);
    
    if (urlMatch) {
      const url = urlMatch[1];
      let alt = altMatch ? (altMatch[1] ?? altMatch[2] ?? '') : '';
      alt = alt.trim();
      if (alt === '{TEXT?}' || alt === 'TEXT?') {
        alt = '';
      }
      return `![${alt}](${url})`;
    }
    return match;
  });

  // Parse user mentions @"username"#id
  result = result.replace(/@"([^"]+)"#(\d+)/g, '<span class="user-mention">@$1</span>');

  return result;
}

function replacePolls(text: string): string {
  // Matches [poll name="标题"] options [/poll]
  return text.replace(/\[poll\s+name="([^"]+)"\]([\s\S]*?)\[\/poll\]/g, (_, name, optionsBlock) => {
    const lines = optionsBlock.split(/\r?\n/);
    const options: string[] = [];
    for (const line of lines) {
      const match = line.match(/^\s*[-*+]\s+(.+)$/);
      if (match) {
        options.push(match[1].trim());
      } else {
        const trimmed = line.trim();
        if (trimmed) {
          options.push(trimmed);
        }
      }
    }
    const encodedOptions = encodeURIComponent(JSON.stringify(options));
    return `<div class="poll-card-placeholder" data-poll-name="${escapeHtml(name)}" data-poll-options="${encodedOptions}"></div>`;
  });
}

function renderPolls(html: string): string {
  return html.replace(/<div class="poll-card-placeholder" data-poll-name="([^"]+)" data-poll-options="([^"]+)"><\/div>/g, (_, name, encodedOptions) => {
    let options: string[] = [];
    try {
      options = JSON.parse(decodeURIComponent(encodedOptions));
    } catch {
      return '';
    }
    
    const optionsHtml = options.map((opt, index) => {
      const percentages = [45, 30, 15, 10];
      const percent = percentages[index % percentages.length];
      const votes = Math.round(percent * 1.2);
      return `
<div class="poll-option-item my-2.5 p-3 rounded-xl border border-border bg-card/50 hover:bg-accent/40 transition-all select-none cursor-pointer relative overflow-hidden group">
  <div class="poll-option-progress absolute top-0 left-0 bottom-0 bg-brand-500/10 dark:bg-brand-400/15 transition-all duration-500" style="width: ${percent}%"></div>
  <div class="poll-option-content flex justify-between items-center relative z-10 text-sm">
    <span class="font-medium text-foreground">${opt}</span>
    <span class="text-xs font-bold text-brand-600 dark:text-brand-400">${votes} 票 (${percent}%)</span>
  </div>
</div>
      `;
    }).join('');
    
    return `
<div class="poll-card-wrapper my-6 p-5 rounded-2xl border border-border bg-card/30 backdrop-blur-md shadow-lg shadow-black/5">
  <div class="poll-header flex items-center gap-2 mb-4">
    <div class="p-1.5 rounded-lg bg-brand-500/10 dark:bg-brand-400/20 text-brand-500 dark:text-brand-400">
      <svg class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
    </div>
    <h4 class="m-0 text-base font-bold text-foreground">${name}</h4>
  </div>
  <div class="poll-options flex flex-col">
    ${optionsHtml}
  </div>
  <div class="poll-footer mt-4 text-[10px] text-muted-foreground flex justify-between items-center border-t border-border/40 pt-2.5">
    <span>🗳 运维投票组件（预览模式）</span>
    <span>共计 ${120} 人参与投票</span>
  </div>
</div>
    `;
  });
}

function renderTaskLists(html: string): string {
  return html
    .replace(/<li>\[ \] /g, '<li class="task-list-item flex items-start gap-2"><input type="checkbox" disabled class="mt-1.5 shrink-0 rounded border-gray-300 text-emerald-500 focus:ring-emerald-400"> ')
    .replace(/<li>\[x\] /g, '<li class="task-list-item flex items-start gap-2"><input type="checkbox" checked disabled class="mt-1.5 shrink-0 rounded border-gray-300 text-emerald-500 focus:ring-emerald-400"> ');
}

export function renderArticleContent(format: ArticleContentFormat, raw: string, enableAnchors = false): string {
  const source = raw ?? '';
  let html: string;
  switch (format) {
    case 'html':
      if (enableAnchors) {
        return injectBlockAnchors(source);
      }
      return source;
    case 'plain':
      return `<pre class="article-plain whitespace-pre-wrap">${escapeHtml(source)}</pre>`;
    case 'flarum':
    case 'latex':
    case 'markdown':
    default: {
      const flarumProcessed = format === 'flarum' ? replaceFlarumElements(source) : source;
      const withPolls = replacePolls(flarumProcessed);
      const preprocessed = replaceCallouts(withPolls);
      const withLinks = replaceWikilinksForMarkdown(preprocessed);
      html = md.render(withLinks);
      
      // Wrap images with non-empty alt inside <figure> and <figcaption>
      html = html.replace(/<img\s+[^>]*src="([^"]+)"[^>]*alt="([^"]+)"[^>]*>/g, (match, src, alt) => {
        if (alt && alt.trim()) {
          return `<figure class="image-figure"><img src="${src}" alt="${alt}"><figcaption class="image-caption">${escapeHtml(alt)}</figcaption></figure>`;
        }
        return match;
      });

      html = renderCallouts(html);
      html = renderPolls(html);
      html = renderTaskLists(html);
      break;
    }
  }
  const sanitized = sanitize(html);
  if (enableAnchors) {
    return injectBlockAnchors(sanitized);
  }
  return sanitized;
}

function injectBlockAnchors(html: string): string {
  let idx = 0;
  return html.replace(/<(h[1-6]|p|pre|ul|ol|blockquote)(\s[^>]*)?>/gi, (_match, tag, attrs) => {
    const id = `p-${idx++}`;
    return `<${tag} id="${id}"${attrs ?? ''} data-anchor>`;
  });
}

export const INTERVIEW_BLOCK_SNIPPET = `<!-- interview-block -->
<div class="interview-block">
  <h3 class="interview-q">问：在这里写问题</h3>
  <div class="interview-a">
    <blockquote>在这里写回答或引述</blockquote>
  </div>
</div>
`;

import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import katex from 'katex';
import { replaceWikilinksForMarkdown } from './wikilink';

export type ArticleContentFormat = 'markdown' | 'html' | 'latex' | 'plain';

const md = new MarkdownIt({ html: true, breaks: true, linkify: true });

function sanitize(html: string) {
  return String(
    DOMPurify.sanitize(html, {
      ADD_TAGS: ['span', 'math', 'annotation', 'semantics', 'mrow', 'mi', 'mo', 'mn'],
      ADD_ATTR: ['class', 'style', 'aria-hidden'],
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

function renderLatexInline(src: string) {
  return src
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
      try {
        return katex.renderToString(String(tex).trim(), { displayMode: true, throwOnError: false });
      } catch {
        return `<pre class="katex-error">${escapeHtml(tex)}</pre>`;
      }
    })
    .replace(/\$([^$\n]+?)\$/g, (_, tex) => {
      try {
        return katex.renderToString(String(tex).trim(), { displayMode: false, throwOnError: false });
      } catch {
        return `<code class="katex-error">${escapeHtml(tex)}</code>`;
      }
    });
}

export function renderArticleContent(format: ArticleContentFormat, raw: string, enableAnchors = false): string {
  const source = raw ?? '';
  let html: string;
  switch (format) {
    case 'html':
      html = source;
      break;
    case 'plain':
      return `<pre class="article-plain whitespace-pre-wrap">${escapeHtml(source)}</pre>`;
    case 'latex': {
      const withMath = renderLatexInline(source);
      html = md.render(withMath);
      break;
    }
    case 'markdown':
    default:
      html = md.render(replaceWikilinksForMarkdown(source));
      break;
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

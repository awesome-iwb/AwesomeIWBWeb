<script setup lang="ts">
import { computed, ref, onMounted, onUpdated, nextTick } from 'vue';
import { renderArticleContent, type ArticleContentFormat } from '../../lib/renderArticleContent';
import 'katex/dist/katex.min.css';

const props = defineProps<{
  format: ArticleContentFormat;
  content: string;
  enableAnchors?: boolean;
}>();

const contentRef = ref<HTMLElement | null>(null);

const html = computed(() => renderArticleContent(props.format, props.content, props.enableAnchors ?? false));

function setupCopyButtons() {
  nextTick(() => {
    if (!contentRef.value) return;
    const buttons = contentRef.value.querySelectorAll('.copy-code-btn');
    buttons.forEach((btn) => {
      if ((btn as any).__hasCopyListener) return;
      (btn as any).__hasCopyListener = true;
      
      btn.addEventListener('click', async () => {
        const code = decodeURIComponent(btn.getAttribute('data-code') || '');
        try {
          await navigator.clipboard.writeText(code);
          const span = btn.querySelector('span');
          if (span) {
            const oldText = span.textContent;
            span.textContent = '已复制!';
            btn.classList.add('text-emerald-400');
            setTimeout(() => {
              span.textContent = oldText;
              btn.classList.remove('text-emerald-400');
            }, 2000);
          }
        } catch (err) {
          console.error('Failed to copy', err);
        }
      });
    });
  });
}

onMounted(setupCopyButtons);
onUpdated(setupCopyButtons);
</script>

<template>
  <div ref="contentRef" class="article-content prose prose-slate dark:prose-invert max-w-none" v-html="html" />
</template>

<style scoped>
/* Headings styling */
:deep(h1) {
  font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
  font-weight: 800;
  font-size: 2.25rem;
  line-height: 1.25;
  margin-top: 2.5rem !important;
  margin-bottom: 1.5rem !important;
  background: linear-gradient(135deg, var(--color-brand-600, #059669), var(--color-brand-400, #34d399));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  border-bottom: 1px solid rgba(16, 185, 129, 0.1);
  padding-bottom: 0.6rem;
}
:deep(h2) {
  font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
  font-weight: 700;
  font-size: 1.65rem;
  line-height: 1.35;
  margin-top: 2rem !important;
  margin-bottom: 1.25rem !important;
  padding-left: 0.75rem !important;
  border-left: 4px solid var(--color-brand-500, #10b981) !important;
}
:deep(h3) {
  font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
  font-weight: 600;
  font-size: 1.35rem;
  line-height: 1.4;
  margin-top: 1.75rem !important;
  margin-bottom: 1rem !important;
  padding-left: 0.6rem !important;
  border-left: 2px solid rgba(16, 185, 129, 0.5) !important;
}

/* Blockquotes styling */
:deep(blockquote) {
  background-color: rgba(16, 185, 129, 0.02) !important;
  border-left: 4px solid var(--color-brand-500, #10b981) !important;
  border-radius: 0.75rem !important;
  padding: 1.25rem 1.5rem !important;
  margin: 1.5rem 0 !important;
  color: var(--muted-foreground, #475569) !important;
  font-style: italic !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.01) !important;
}
.dark :deep(blockquote) {
  background-color: rgba(16, 185, 129, 0.04) !important;
  color: #94a3b8 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

/* Custom Table Styles */
:deep(table) {
  width: 100% !important;
  border-collapse: separate !important;
  border-spacing: 0 !important;
  margin: 2rem 0 !important;
  font-size: 0.875rem !important;
  border-radius: 0.75rem !important;
  overflow: hidden !important;
  border: 1px solid rgba(226, 232, 240, 0.8) !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.01) !important;
}
.dark :deep(table) {
  border: 1px solid rgba(51, 65, 85, 0.8) !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
}
:deep(th) {
  background-color: rgba(241, 245, 249, 0.6) !important;
  border-bottom: 2px solid rgba(226, 232, 240, 0.8) !important;
  padding: 0.875rem 1.25rem !important;
  font-weight: 600 !important;
  text-align: left !important;
  color: var(--foreground, #0f172a) !important;
}
.dark :deep(th) {
  background-color: rgba(30, 41, 59, 0.6) !important;
  border-bottom: 2px solid rgba(51, 65, 85, 0.8) !important;
  color: #f8fafc !important;
}
:deep(td) {
  border-bottom: 1px solid rgba(226, 232, 240, 0.5) !important;
  padding: 0.875rem 1.25rem !important;
  color: var(--foreground, #334155) !important;
  transition: background-color 0.2s ease !important;
}
.dark :deep(td) {
  border-bottom: 1px solid rgba(51, 65, 85, 0.5) !important;
  color: #cbd5e1 !important;
}
:deep(tr:last-child td) {
  border-bottom: none !important;
}
:deep(tr:nth-child(even) td) {
  background-color: rgba(248, 250, 252, 0.4) !important;
}
.dark :deep(tr:nth-child(even) td) {
  background-color: rgba(15, 23, 42, 0.2) !important;
}
:deep(tr:hover td) {
  background-color: rgba(16, 185, 129, 0.04) !important;
}
.dark :deep(tr:hover td) {
  background-color: rgba(16, 185, 129, 0.08) !important;
}

/* Custom Lists styling */
:deep(.article-content ul:not(.task-list-item)) {
  padding-left: 1.5rem !important;
  list-style-type: none !important;
  margin: 1.25rem 0 !important;
}
:deep(.article-content ul:not(.task-list-item) li) {
  position: relative !important;
  padding-left: 1.25rem !important;
  margin-bottom: 0.5rem !important;
}
:deep(.article-content ul:not(.task-list-item) li::before) {
  content: "" !important;
  position: absolute !important;
  left: 0 !important;
  top: 0.55rem !important;
  width: 6px !important;
  height: 6px !important;
  background-color: var(--color-brand-500, #10b981) !important;
  border-radius: 50% !important;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6) !important;
}
:deep(.article-content ol) {
  padding-left: 1.5rem !important;
  list-style-type: none !important;
  margin: 1.25rem 0 !important;
  counter-reset: ol-counter !important;
}
:deep(.article-content ol li) {
  position: relative !important;
  padding-left: 1.5rem !important;
  margin-bottom: 0.5rem !important;
  counter-increment: ol-counter !important;
}
:deep(.article-content ol li::before) {
  content: counter(ol-counter) "." !important;
  position: absolute !important;
  left: 0 !important;
  top: 0rem !important;
  font-weight: 700 !important;
  color: var(--color-brand-500, #10b981) !important;
  font-size: 0.9rem !important;
}

/* Custom Checkbox (Reset default system checkbox styles) */
:deep(.task-list-item) {
  list-style-type: none !important;
  margin-left: -1.25rem !important;
}
:deep(.task-list-item input[type="checkbox"]) {
  -webkit-appearance: none !important;
  appearance: none !important;
  width: 1.1rem !important;
  height: 1.1rem !important;
  border: 2px solid rgba(16, 185, 129, 0.4) !important;
  border-radius: 0.35rem !important;
  outline: none !important;
  background-color: transparent !important;
  cursor: not-allowed !important;
  position: relative !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  margin-top: 0.25rem !important;
}
:deep(.task-list-item input[type="checkbox"]:checked) {
  border-color: var(--color-brand-500, #10b981) !important;
  background-color: var(--color-brand-500, #10b981) !important;
}
:deep(.task-list-item input[type="checkbox"]:checked::after) {
  content: "" !important;
  position: absolute !important;
  left: 0.28rem !important;
  top: 0.1rem !important;
  width: 0.3rem !important;
  height: 0.55rem !important;
  border: solid white !important;
  border-width: 0 2px 2px 0 !important;
  transform: rotate(45deg) !important;
  animation: checkmark 0.2s ease-in-out forwards !important;
}
@keyframes checkmark {
  from {
    opacity: 0;
    transform: rotate(45deg) scale(0.5);
  }
  to {
    opacity: 1;
    transform: rotate(45deg) scale(1);
  }
}

/* Divider Lines */
:deep(hr) {
  border: none !important;
  height: 1px !important;
  background: linear-gradient(to right, transparent, rgba(16, 185, 129, 0.35), transparent) !important;
  margin: 2.5rem 0 !important;
}

/* Hyperlinks with Underline Transition */
:deep(.article-content a) {
  color: var(--color-brand-600, #059669) !important;
  text-decoration: none !important;
  font-weight: 500 !important;
  position: relative !important;
  padding-bottom: 2px !important;
  transition: color 0.2s ease !important;
}
.dark :deep(.article-content a) {
  color: var(--color-brand-400, #34d399) !important;
}
:deep(.article-content a::after) {
  content: "" !important;
  position: absolute !important;
  width: 100% !important;
  transform: scaleX(0) !important;
  height: 1.5px !important;
  bottom: 0 !important;
  left: 0 !important;
  background-color: var(--color-brand-500, #10b981) !important;
  transform-origin: bottom left !important;
  transition: transform 0.25s ease-out !important;
}
:deep(.article-content a:hover::after) {
  transform: scaleX(1) !important;
}

/* Images and Figures */
:deep(.image-figure) {
  margin: 2.25rem auto !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  max-width: 90% !important;
}
:deep(.image-figure img) {
  border-radius: 0.75rem !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  margin: 0 auto !important;
  max-width: 100% !important;
}
.dark :deep(.image-figure img) {
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25) !important;
}
:deep(.image-figure img:hover) {
  transform: translateY(-4px) !important;
  box-shadow: 0 15px 35px rgba(16, 185, 129, 0.08) !important;
}
.dark :deep(.image-figure img:hover) {
  box-shadow: 0 15px 35px rgba(16, 185, 129, 0.18) !important;
}
:deep(.image-caption) {
  text-align: center !important;
  font-size: 0.8rem !important;
  color: var(--muted-foreground, #64748b) !important;
  margin-top: 0.75rem !important;
  font-style: italic !important;
}
.dark :deep(.image-caption) {
  color: #94a3b8 !important;
}

/* Custom Poll Card Component */
:deep(.poll-card-wrapper) {
  margin: 2rem 0 !important;
  padding: 1.5rem !important;
  border-radius: 1.25rem !important;
  border: 1px solid rgba(16, 185, 129, 0.15) !important;
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(12px) !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.02) !important;
}
.dark :deep(.poll-card-wrapper) {
  border: 1px solid rgba(16, 185, 129, 0.25) !important;
  background: rgba(15, 23, 42, 0.35) !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2) !important;
}
:deep(.poll-header) {
  display: flex !important;
  align-items: center !important;
  gap: 0.75rem !important;
  margin-bottom: 1.25rem !important;
}
:deep(.poll-header h4) {
  font-size: 1.05rem !important;
  font-weight: 700 !important;
  margin: 0 !important;
  color: var(--foreground, #0f172a) !important;
}
.dark :deep(.poll-header h4) {
  color: #f8fafc !important;
}
:deep(.poll-option-item) {
  position: relative !important;
  margin: 0.625rem 0 !important;
  padding: 0.8rem 1.1rem !important;
  border-radius: 0.75rem !important;
  border: 1px solid rgba(226, 232, 240, 0.8) !important;
  background: rgba(248, 250, 252, 0.5) !important;
  overflow: hidden !important;
  cursor: pointer !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.dark :deep(.poll-option-item) {
  border: 1px solid rgba(51, 65, 85, 0.5) !important;
  background: rgba(30, 41, 59, 0.3) !important;
}
:deep(.poll-option-item:hover) {
  border-color: rgba(16, 185, 129, 0.35) !important;
  transform: translateY(-1.5px) !important;
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.04) !important;
}
.dark :deep(.poll-option-item:hover) {
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.08) !important;
}
:deep(.poll-option-progress) {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  bottom: 0 !important;
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.06), rgba(16, 185, 129, 0.12)) !important;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
:deep(.poll-option-progress-10) {
  width: 10% !important;
}
:deep(.poll-option-progress-15) {
  width: 15% !important;
}
:deep(.poll-option-progress-30) {
  width: 30% !important;
}
:deep(.poll-option-progress-45) {
  width: 45% !important;
}
.dark :deep(.poll-option-progress) {
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.18)) !important;
}
:deep(.poll-option-content) {
  position: relative !important;
  z-index: 1 !important;
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
}
:deep(.poll-option-content span:first-child) {
  font-weight: 600 !important;
  color: var(--foreground, #334155) !important;
}
.dark :deep(.poll-option-content span:first-child) {
  color: #e2e8f0 !important;
}
:deep(.poll-option-content span:last-child) {
  font-size: 0.8rem !important;
  font-weight: 700 !important;
  color: var(--color-brand-600, #059669) !important;
}
.dark :deep(.poll-option-content span:last-child) {
  color: var(--color-brand-400, #34d399) !important;
}
:deep(.poll-footer) {
  margin-top: 1.25rem !important;
  padding-top: 0.8rem !important;
  border-top: 1px solid rgba(226, 232, 240, 0.6) !important;
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  font-size: 0.75rem !important;
  color: var(--muted-foreground, #64748b) !important;
}
.dark :deep(.poll-footer) {
  border-top: 1px solid rgba(51, 65, 85, 0.4) !important;
  color: #94a3b8 !important;
}

/* Callout block cards styling */
:deep(.callout-block) {
  border-left-width: 4px !important;
  transition: all 0.2s ease-in-out;
}
:deep(.callout-block.callout-note) {
  background-color: var(--color-bg-hover, #f1f5f9);
  border-color: #3b82f6;
}
.dark :deep(.callout-block.callout-note) {
  background-color: rgba(59, 130, 246, 0.08);
  border-color: #3b82f6;
}
:deep(.callout-block.callout-tip) {
  background-color: rgba(16, 185, 129, 0.03);
  border-color: #10b981;
}
.dark :deep(.callout-block.callout-tip) {
  background-color: rgba(16, 185, 129, 0.08);
  border-color: #10b981;
}
:deep(.callout-block.callout-warning) {
  background-color: rgba(245, 158, 11, 0.03);
  border-color: #f59e0b;
}
.dark :deep(.callout-block.callout-warning) {
  background-color: rgba(245, 158, 11, 0.08);
  border-color: #f59e0b;
}
:deep(.callout-block.callout-error) {
  background-color: rgba(244, 63, 94, 0.03);
  border-color: #f43f5e;
}
.dark :deep(.callout-block.callout-error) {
  background-color: rgba(244, 63, 94, 0.08);
  border-color: #f43f5e;
}

/* Katex adjustments */
:deep(.katex-display) {
  margin: 1.2rem 0;
  padding: 0.8rem;
  background-color: rgba(15, 23, 42, 0.015);
  border-radius: 0.75rem;
  overflow-x: auto;
}
.dark :deep(.katex-display) {
  background-color: rgba(255, 255, 255, 0.015);
}
:deep(.katex-error) {
  color: var(--color-danger, #f43f5e);
  background-color: rgba(244, 63, 94, 0.05);
  padding: 0.2rem 0.4rem;
  border-radius: 0.25rem;
}

/* Standard interview styling */
:deep(.interview-block) {
  margin: 2rem 0;
}
:deep(.interview-q) {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}
:deep(.interview-a blockquote) {
  border-left: 3px solid var(--color-brand-500, #10b981);
  padding-left: 1rem;
  margin: 0;
  color: var(--muted-foreground, #64748b);
}
:deep([data-anchor]) {
  position: relative;
  scroll-margin-top: 2rem;
}

/* User mention badges styling */
:deep(.user-mention) {
  background-color: rgba(16, 185, 129, 0.08);
  color: var(--color-brand-600, #059669);
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 0.85em;
  border: 1px solid rgba(16, 185, 129, 0.15);
  display: inline-flex;
  align-items: center;
  margin: 0 0.15rem;
}
.dark :deep(.user-mention) {
  background-color: rgba(16, 185, 129, 0.15);
  color: var(--color-brand-400, #34d399);
  border: 1px solid rgba(16, 185, 129, 0.25);
}
</style>

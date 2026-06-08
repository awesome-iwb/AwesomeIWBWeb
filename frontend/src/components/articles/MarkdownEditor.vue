<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, shallowRef } from 'vue';
import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  placeholder as cmPlaceholder,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  undo as cmUndo,
  redo as cmRedo,
} from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { html as langHtml } from '@codemirror/lang-html';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { autocompletion, completionKeymap, type CompletionContext } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { uploadFile } from '../../composables/useAdminFetch';
import type { ArticleContentFormat } from '../../lib/renderArticleContent';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link as LinkIcon,
} from 'lucide-vue-next';

export type ArticleSearchResult = { slug: string; title: string };

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    articleSearch?: (q: string) => Promise<ArticleSearchResult[]>;
    format?: ArticleContentFormat;
  }>(),
  { placeholder: '文章内容…', format: 'markdown' },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  uploading: [active: boolean];
  uploadError: [message: string];
  scroll: [percent: number];
}>();

const hostRef = ref<HTMLElement | null>(null);
const viewRef = shallowRef<EditorView | null>(null);
const themeCompartment = new Compartment();
const languageCompartment = new Compartment();
let syncingFromProp = false;
let darkObserver: MutationObserver | null = null;

// Floating bubble selection toolbar states
const showBubble = ref(false);
const bubbleX = ref(0);
const bubbleY = ref(0);

function handleSelectionChange(view: EditorView) {
  const { from, to } = view.state.selection.main;
  if (from === to) {
    showBubble.value = false;
    return;
  }
  
  // Selection check
  const domSel = window.getSelection();
  if (!domSel || domSel.isCollapsed || domSel.rangeCount === 0) {
    showBubble.value = false;
    return;
  }
  
  const range = domSel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const hostRect = hostRef.value?.getBoundingClientRect();
  const scroller = hostRef.value?.querySelector('.cm-scroller');
  const scrollerRect = scroller?.getBoundingClientRect();
  
  if (rect && hostRect && scrollerRect) {
    // Hide bubble if the selection scrolls out of visible viewport
    if (rect.bottom < scrollerRect.top || rect.top > scrollerRect.bottom) {
      showBubble.value = false;
      return;
    }
    bubbleX.value = rect.left - hostRect.left + rect.width / 2;
    bubbleY.value = rect.top - hostRect.top - 48; // 48px above
    showBubble.value = true;
  }
}

function isDarkMode() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

function getLanguageExtension(format: ArticleContentFormat) {
  switch (format) {
    case 'html':
      return langHtml();
    case 'latex':
    case 'flarum':
      return markdown();
    case 'plain':
      return [];
    case 'markdown':
    default:
      return markdown();
  }
}

function editorTheme() {
  const light = EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '14px',
      backgroundColor: 'transparent',
    },
    '.cm-scroller': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      lineHeight: '1.6',
    },
    '.cm-content': {
      padding: '16px 0',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--muted-foreground, #94a3b8)',
    },
    '&.cm-focused': {
      outline: 'none',
    },
  });
  return isDarkMode() ? [light, oneDark] : light;
}

function wikilinkAutocomplete(context: CompletionContext) {
  const before = context.matchBefore(/\[\[[^\]]*/);
  if (!before) return null;
  if (before.from === before.to && !context.explicit) return null;
  const query = before.text.slice(2).trim().toLowerCase();
  const searchFn = props.articleSearch;
  if (!searchFn) {
    return { from: before.from + 2, options: [] };
  }

  return searchFn(query).then((items) => ({
    from: before.from + 2,
    options: items.map((item) => ({
      label: item.title || item.slug,
      detail: item.slug,
      apply: `${item.slug}]]`,
    })),
  }));
}

async function uploadImages(files: FileList | File[]) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (list.length === 0) return;
  emit('uploading', true);
  try {
    for (const file of list) {
      const url = await uploadFile(file);
      insertAtCursor(`\n![${file.name.replace(/\.[^.]+$/, '')}](${url})\n`);
    }
  } catch (e: unknown) {
    emit('uploadError', e instanceof Error ? e.message : '上传失败');
  } finally {
    emit('uploading', false);
  }
}

// Editor helper actions
function toggleWrapSelection(prefix: string, suffix: string = prefix, defaultPlaceholder: string = '') {
  const view = viewRef.value;
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const selectedText = view.state.doc.sliceString(from, to);
  
  if (selectedText.length > 0) {
    view.dispatch({
      changes: { from, to, insert: `${prefix}${selectedText}${suffix}` },
      selection: { anchor: from + prefix.length + selectedText.length + suffix.length },
    });
  } else {
    const insertText = defaultPlaceholder || '文字';
    view.dispatch({
      changes: { from, to, insert: `${prefix}${insertText}${suffix}` },
      selection: { anchor: from + prefix.length, head: from + prefix.length + insertText.length },
    });
  }
  view.focus();
}

function insertHtmlTag(tag: string, attrs: string = '') {
  const view = viewRef.value;
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const selectedText = view.state.doc.sliceString(from, to);
  
  const attrStr = attrs ? ` ${attrs}` : '';
  const openTag = `<${tag}${attrStr}>`;
  const closeTag = `</${tag}>`;
  
  if (selectedText.length > 0) {
    view.dispatch({
      changes: { from, to, insert: `${openTag}${selectedText}${closeTag}` },
      selection: { anchor: from + openTag.length + selectedText.length + closeTag.length }
    });
  } else {
    const placeholder = '内容';
    view.dispatch({
      changes: { from, to, insert: `${openTag}${placeholder}${closeTag}` },
      selection: { anchor: from + openTag.length, head: from + openTag.length + placeholder.length }
    });
  }
  view.focus();
}

// Unified Editing Interface
function toggleBold() {
  if (props.format === 'html') {
    insertHtmlTag('strong');
  } else {
    toggleWrapSelection('**', '**', '粗体');
  }
}

function toggleItalic() {
  if (props.format === 'html') {
    insertHtmlTag('em');
  } else {
    toggleWrapSelection('*', '*', '斜体');
  }
}

function toggleUnderline() {
  if (props.format === 'html') {
    insertHtmlTag('u');
  } else {
    toggleWrapSelection('<u>', '</u>', '下划线');
  }
}

function toggleStrikethrough() {
  if (props.format === 'html') {
    insertHtmlTag('del');
  } else {
    toggleWrapSelection('~~', '~~', '删除线');
  }
}

function toggleCodeInline() {
  if (props.format === 'html') {
    insertHtmlTag('code');
  } else {
    toggleWrapSelection('`', '`', '代码');
  }
}

function toggleCodeBlock() {
  if (props.format === 'html') {
    insertHtmlTag('pre');
  } else {
    toggleWrapSelection('```\n', '\n```', '代码块');
  }
}

function toggleHeading(level: number) {
  if (props.format === 'html') {
    insertHtmlTag(`h${level}`);
    return;
  }
  const view = viewRef.value;
  if (!view) return;
  
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const match = line.text.match(/^(#{1,6})\s+/);
  const headingPrefix = '#'.repeat(level) + ' ';
  
  if (match) {
    const existingLevel = match[1].length;
    if (existingLevel === level) {
      view.dispatch({
        changes: { from: line.from, to: line.from + match[0].length, insert: '' },
        selection: { anchor: Math.max(line.from, from - match[0].length) }
      });
    } else {
      view.dispatch({
        changes: { from: line.from, to: line.from + match[0].length, insert: headingPrefix },
        selection: { anchor: from - match[0].length + headingPrefix.length }
      });
    }
  } else {
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: headingPrefix },
      selection: { anchor: from + headingPrefix.length }
    });
  }
  view.focus();
}

function toggleLineStart(prefix: string) {
  const view = viewRef.value;
  if (!view) return;
  
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const hasPrefix = line.text.startsWith(prefix);
  
  if (hasPrefix) {
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' },
      selection: { anchor: Math.max(line.from, from - prefix.length) }
    });
  } else {
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
      selection: { anchor: from + prefix.length }
    });
  }
  view.focus();
}

function toggleBulletList() {
  if (props.format === 'html') {
    const view = viewRef.value;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const snippet = `\n<ul>\n  <li>列表项 1</li>\n  <li>列表项 2</li>\n</ul>\n`;
    view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + snippet.length }
    });
    view.focus();
  } else {
    toggleLineStart('- ');
  }
}

function toggleOrderedList() {
  if (props.format === 'html') {
    const view = viewRef.value;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const snippet = `\n<ol>\n  <li>第一项</li>\n  <li>第二项</li>\n</ol>\n`;
    view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + snippet.length }
    });
    view.focus();
  } else {
    toggleLineStart('1. ');
  }
}

function toggleTaskList() {
  if (props.format === 'html') {
    const view = viewRef.value;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const snippet = `<input type="checkbox" /> `;
    view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + snippet.length }
    });
    view.focus();
  } else {
    toggleLineStart('- [ ] ');
  }
}

function insertLink() {
  const view = viewRef.value;
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const selectedText = view.state.doc.sliceString(from, to);
  
  if (props.format === 'html') {
    insertHtmlTag('a', 'href="链接地址"');
    return;
  }
  
  if (selectedText.length > 0) {
    view.dispatch({
      changes: { from, to, insert: `[${selectedText}](链接地址)` },
      selection: { anchor: from + selectedText.length + 3, head: from + selectedText.length + 7 }
    });
  } else {
    view.dispatch({
      changes: { from, to, insert: `[链接文字](链接地址)` },
      selection: { anchor: from + 1, head: from + 5 }
    });
  }
  view.focus();
}

function insertImage() {
  const view = viewRef.value;
  if (!view) return;
  const { from, to } = view.state.selection.main;
  
  if (props.format === 'html') {
    const snippet = `<img src="图片链接" alt="图片描述" />`;
    view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + 10, head: from + 14 }
    });
    view.focus();
    return;
  }
  
  view.dispatch({
    changes: { from, to, insert: `![图片描述](图片链接)` },
    selection: { anchor: from + 2, head: from + 6 }
  });
  view.focus();
}

function insertTable() {
  const view = viewRef.value;
  if (!view) return;
  const { from, to } = view.state.selection.main;
  
  if (props.format === 'html') {
    const tableSnippet = `\n<table>\n  <thead>\n    <tr>\n      <th>表头 1</th>\n      <th>表头 2</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td>内容 1</td>\n      <td>内容 2</td>\n    </tr>\n  </tbody>\n</table>\n`;
    view.dispatch({
      changes: { from, to, insert: tableSnippet },
      selection: { anchor: from + tableSnippet.length }
    });
    view.focus();
    return;
  }
  
  const tableSnippet = `\n| 表头 1 | 表头 2 |\n| :--- | :--- |\n| 单元格 1 | 单元格 2 |\n| 单元格 3 | 单元格 4 |\n`;
  view.dispatch({
    changes: { from, to, insert: tableSnippet },
    selection: { anchor: from + tableSnippet.length }
  });
  view.focus();
}

function insertCallout(type: 'note' | 'tip' | 'warning' | 'error') {
  const view = viewRef.value;
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const selectedText = view.state.doc.sliceString(from, to) || '在此输入提示内容';
  
  if (props.format === 'html') {
    const snippet = `\n<div class="callout-block callout-${type}" data-callout-type="${type}">\n  ${selectedText}\n</div>\n`;
    view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + snippet.length }
    });
    view.focus();
    return;
  }
  
  const snippet = `\n::: ${type}\n${selectedText}\n:::\n`;
  view.dispatch({
    changes: { from, to, insert: snippet },
    selection: { anchor: from + snippet.length }
  });
  view.focus();
}

function undo() {
  if (viewRef.value) cmUndo(viewRef.value);
}

function redo() {
  if (viewRef.value) cmRedo(viewRef.value);
}

function setScrollPercent(percent: number) {
  const scroller = hostRef.value?.querySelector('.cm-scroller') as HTMLElement;
  if (scroller) {
    scroller.scrollTop = percent * (scroller.scrollHeight - scroller.clientHeight);
  }
}

function onEditorScroll(event: Event) {
  const el = event.target as HTMLElement;
  const denominator = el.scrollHeight - el.clientHeight;
  if (denominator <= 0) return;
  const percent = el.scrollTop / denominator;
  emit('scroll', percent);
  
  if (showBubble.value && viewRef.value) {
    handleSelectionChange(viewRef.value);
  }
}

function buildExtensions() {
  return [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    highlightSelectionMatches(),
    cmPlaceholder(props.placeholder),
    autocompletion({ override: [wikilinkAutocomplete] }),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...completionKeymap,
      ...searchKeymap,
      indentWithTab,
      { key: 'Mod-b', run: () => { toggleBold(); return true; } },
      { key: 'Mod-i', run: () => { toggleItalic(); return true; } },
      { key: 'Mod-h', run: () => { 
        if (!viewRef.value) return false;
        const { from } = viewRef.value.state.selection.main;
        const line = viewRef.value.state.doc.lineAt(from);
        const match = line.text.match(/^(#{1,6})\s+/);
        if (match) {
          const lv = match[1].length;
          if (lv >= 3) toggleHeading(1);
          else toggleHeading(lv + 1);
        } else {
          toggleHeading(1);
        }
        return true;
      } },
      { key: 'Mod-k', run: () => { insertLink(); return true; } },
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !syncingFromProp) {
        emit('update:modelValue', update.state.doc.toString());
      }
      if (update.selectionSet || update.docChanged) {
        handleSelectionChange(update.view);
      }
    }),
    EditorView.domEventHandlers({
      paste(event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const files: File[] = [];
        for (const item of items) {
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        }
        if (files.length === 0) return false;
        event.preventDefault();
        void uploadImages(files);
        return true;
      },
      drop(event) {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const images = [...files].filter((f) => f.type.startsWith('image/'));
        if (images.length === 0) return false;
        event.preventDefault();
        void uploadImages(images);
        return true;
      },
    }),
    themeCompartment.of(editorTheme()),
    languageCompartment.of(getLanguageExtension(props.format)),
  ];
}

function createView() {
  if (!hostRef.value) return;
  const state = EditorState.create({
    doc: props.modelValue,
    extensions: buildExtensions(),
  });
  const view = new EditorView({ state, parent: hostRef.value });
  viewRef.value = view;
  
  const scroller = hostRef.value.querySelector('.cm-scroller');
  if (scroller) {
    scroller.addEventListener('scroll', onEditorScroll);
  }
}

function insertAtCursor(text: string) {
  const view = viewRef.value;
  if (!view) {
    emit('update:modelValue', props.modelValue + text);
    return;
  }
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
  view.focus();
}

function scrollToLine(lineIndex: number) {
  const view = viewRef.value;
  if (!view) return;
  const lineNo = Math.min(Math.max(1, lineIndex + 1), view.state.doc.lines);
  const line = view.state.doc.line(lineNo);
  view.dispatch({
    effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 64 }),
    selection: { anchor: line.from },
  });
  view.focus();
}

function focusEditor() {
  viewRef.value?.focus();
}

watch(
  () => props.modelValue,
  (val) => {
    const view = viewRef.value;
    if (!view) return;
    const current = view.state.doc.toString();
    if (val === current) return;
    syncingFromProp = true;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: val },
    });
    syncingFromProp = false;
  },
);

watch(
  () => props.format,
  (newFormat) => {
    const view = viewRef.value;
    if (!view || !newFormat) return;
    view.dispatch({
      effects: languageCompartment.reconfigure(getLanguageExtension(newFormat)),
    });
  },
);

onMounted(() => {
  createView();
  darkObserver = new MutationObserver(() => {
    const view = viewRef.value;
    if (!view) return;
    view.dispatch({ effects: themeCompartment.reconfigure(editorTheme()) });
  });
  darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});

onBeforeUnmount(() => {
  const scroller = hostRef.value?.querySelector('.cm-scroller');
  if (scroller) {
    scroller.removeEventListener('scroll', onEditorScroll);
  }
  darkObserver?.disconnect();
  viewRef.value?.destroy();
  viewRef.value = null;
});

defineExpose({
  insertAtCursor,
  scrollToLine,
  focus: focusEditor,
  toggleWrapSelection,
  toggleHeading,
  toggleLineStart,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrikethrough,
  toggleCodeInline,
  toggleCodeBlock,
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
  insertLink,
  insertImage,
  insertTable,
  insertCallout,
  undo,
  redo,
  setScrollPercent,
});
</script>

<template>
  <div class="relative h-full w-full">
    <div ref="hostRef" class="h-full min-h-0 overflow-hidden cm-host" />
    
    <!-- Floating formatting bubble toolbar -->
    <div 
      v-if="showBubble"
      class="absolute z-50 flex items-center gap-0.5 p-1 rounded-xl shadow-xl backdrop-blur-md transition-all duration-150 ease-out select-none transform -translate-x-1/2 floating-bubble"
      :style="{ left: `${bubbleX}px`, top: `${bubbleY}px` }"
    >
      <button type="button" class="p-1.5 rounded-lg text-foreground transition-all active:scale-95 cursor-pointer" title="加粗" @mousedown.prevent="toggleBold">
        <Bold class="w-3.5 h-3.5" />
      </button>
      <button type="button" class="p-1.5 rounded-lg text-foreground transition-all active:scale-95 cursor-pointer" title="斜体" @mousedown.prevent="toggleItalic">
        <Italic class="w-3.5 h-3.5" />
      </button>
      <button type="button" class="p-1.5 rounded-lg text-foreground transition-all active:scale-95 cursor-pointer" title="下划线" @mousedown.prevent="toggleUnderline">
        <Underline class="w-3.5 h-3.5" />
      </button>
      <button type="button" class="p-1.5 rounded-lg text-foreground transition-all active:scale-95 cursor-pointer" title="删除线" @mousedown.prevent="toggleStrikethrough">
        <Strikethrough class="w-3.5 h-3.5" />
      </button>
      <button type="button" class="p-1.5 rounded-lg text-foreground transition-all active:scale-95 cursor-pointer" title="行内代码" @mousedown.prevent="toggleCodeInline">
        <Code class="w-3.5 h-3.5" />
      </button>
      <button type="button" class="p-1.5 rounded-lg text-foreground transition-all active:scale-95 cursor-pointer" title="链接" @mousedown.prevent="insertLink">
        <LinkIcon class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.cm-host :deep(.cm-editor) {
  height: 100%;
}
.cm-host :deep(.cm-scroller) {
  overflow: auto;
  height: 100%;
}

.floating-bubble {
  background-color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
}
.dark .floating-bubble {
  background-color: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(51, 65, 85, 0.8);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}
.floating-bubble button {
  color: #334155;
}
.dark .floating-bubble button {
  color: #cbd5e1;
}
.floating-bubble button:hover {
  background-color: rgba(16, 185, 129, 0.08) !important;
  color: #10b981 !important;
}
.dark .floating-bubble button:hover {
  background-color: rgba(16, 185, 129, 0.15) !important;
  color: #34d399 !important;
}
</style>

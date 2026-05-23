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
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { autocompletion, completionKeymap, type CompletionContext } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { uploadFile } from '../../composables/useAdminFetch';

export type ArticleSearchResult = { slug: string; title: string };

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    articleSearch?: (q: string) => Promise<ArticleSearchResult[]>;
  }>(),
  { placeholder: 'Markdown 正文…' },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  uploading: [active: boolean];
  uploadError: [message: string];
}>();

const hostRef = ref<HTMLElement | null>(null);
const viewRef = shallowRef<EditorView | null>(null);
const themeCompartment = new Compartment();
let syncingFromProp = false;
let darkObserver: MutationObserver | null = null;

function isDarkMode() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
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
    markdown(),
    cmPlaceholder(props.placeholder),
    autocompletion({ override: [wikilinkAutocomplete] }),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...completionKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !syncingFromProp) {
        emit('update:modelValue', update.state.doc.toString());
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
  darkObserver?.disconnect();
  viewRef.value?.destroy();
  viewRef.value = null;
});

defineExpose({ insertAtCursor, scrollToLine, focus: focusEditor });
</script>

<template>
  <div ref="hostRef" class="h-full min-h-0 overflow-hidden cm-host" />
</template>

<style scoped>
.cm-host :deep(.cm-editor) {
  height: 100%;
}
.cm-host :deep(.cm-scroller) {
  overflow: auto;
  height: 100%;
}
</style>

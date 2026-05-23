<script setup lang="ts">
import { computed } from 'vue';
import { parseMarkdownHeadings, type MarkdownHeading } from '../../lib/parseMarkdownHeadings';

const props = defineProps<{
  content: string;
}>();

const emit = defineEmits<{
  select: [heading: MarkdownHeading];
}>();

const headings = computed(() => parseMarkdownHeadings(props.content));

function onSelect(heading: MarkdownHeading) {
  emit('select', heading);
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wide border-b border-border">
      大纲
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto p-2">
      <p v-if="headings.length === 0" class="text-xs text-muted-foreground px-2 py-4">
        暂无标题，使用 # 创建大纲
      </p>
      <button
        v-for="(heading, idx) in headings"
        :key="`${heading.line}-${idx}`"
        type="button"
        class="w-full text-left text-sm py-1.5 px-2 rounded-lg hover:bg-accent transition-colors truncate"
        :style="{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }"
        @click="onSelect(heading)"
      >
        {{ heading.text }}
      </button>
    </div>
  </div>
</template>

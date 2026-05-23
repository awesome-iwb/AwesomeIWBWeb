<script setup lang="ts">
import { computed } from 'vue';
import { Zap, ShieldCheck, Tag, Code2, Clock } from 'lucide-vue-next';
import type { ResolvedTag } from '../../lib/resolveProjectDisplayTags';
import { tagVariantClass } from '../../lib/resolveProjectDisplayTags';

const props = withDefaults(
  defineProps<{
    tag: ResolvedTag;
    size?: 'sm' | 'md';
    uppercase?: boolean;
  }>(),
  { size: 'sm', uppercase: false }
);

const Icon = computed(() => {
  switch (props.tag.icon) {
    case 'zap':
      return Zap;
    case 'shield':
      return ShieldCheck;
    case 'tag':
      return Tag;
    case 'code':
      return Code2;
    case 'clock':
      return Clock;
    default:
      return null;
  }
});

const sizeClass = computed(() =>
  props.size === 'md'
    ? 'px-3 py-1.5 text-sm rounded-lg'
    : 'px-2.5 py-1 text-[10px] rounded-md'
);
</script>

<template>
  <span
    class="inline-flex items-center gap-1 font-bold border tracking-wider"
    :class="[sizeClass, tagVariantClass(tag.variant), uppercase ? 'uppercase' : '']"
  >
    <component :is="Icon" v-if="Icon" class="w-3 h-3 shrink-0" />
    {{ tag.label }}
  </span>
</template>

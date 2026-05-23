<script setup lang="ts">
import { computed } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import type { ResolvedTag } from '../../lib/resolveProjectDisplayTags';
import { CARD_TAG_LIMIT, CARD_TAG_LIMIT_MOBILE } from '../../lib/resolveProjectDisplayTags';
import ProjectTagChip from './ProjectTagChip.vue';

const props = withDefaults(
  defineProps<{
    tags: ResolvedTag[];
    max?: number;
    maxMobile?: number;
    size?: 'sm' | 'md';
  }>(),
  {
    max: CARD_TAG_LIMIT,
    maxMobile: CARD_TAG_LIMIT_MOBILE,
    size: 'sm',
  }
);

const isMd = useMediaQuery('(min-width: 768px)');
const visibleTags = computed(() => {
  const limit = isMd.value ? props.max : props.maxMobile;
  return props.tags.slice(0, limit);
});
</script>

<template>
  <div v-if="visibleTags.length" class="flex flex-wrap items-center gap-2">
    <ProjectTagChip
      v-for="t in visibleTags"
      :key="t.id"
      :tag="t"
      :size="size"
      :uppercase="t.group === 'system' && (t.icon === 'zap' || t.icon === 'shield' || t.icon === 'tag')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Tags } from 'lucide-vue-next';
import type { ResolvedTag } from '../../lib/resolveProjectDisplayTags';
import { GALLERY_GROUP_LABELS } from '../../lib/resolveProjectDisplayTags';
import ProjectTagChip from './ProjectTagChip.vue';

const props = defineProps<{
  gallery: Record<string, ResolvedTag[]>;
}>();

const expanded = ref<Record<string, boolean>>({});

const sections = computed(() => {
  const order = ['state', 'feature', 'release', 'community', 'custom'] as const;
  return order
    .map((key) => ({
      key,
      label: GALLERY_GROUP_LABELS[key] ?? key,
      tags: props.gallery[key] ?? [],
    }))
    .filter((s) => s.tags.length > 0);
});

const hasAny = computed(() => sections.value.length > 0);

function visibleTags(key: string, tags: ResolvedTag[]) {
  if (expanded.value[key]) return tags;
  return tags.slice(0, 6);
}
</script>

<template>
  <div v-if="hasAny" class="bg-card rounded-3xl p-6 border border-border/80">
    <h3 class="font-bold text-lg text-foreground mb-4 flex items-center gap-2">
      <Tags class="w-5 h-5 text-emerald-500" />
      项目标签
    </h3>
    <div class="space-y-5">
      <section v-for="section in sections" :key="section.key">
        <h4 class="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{{ section.label }}</h4>
        <div class="flex flex-wrap gap-2">
          <ProjectTagChip v-for="t in visibleTags(section.key, section.tags)" :key="t.id" :tag="t" size="md" />
        </div>
        <button
          v-if="section.tags.length > 6"
          type="button"
          class="mt-2 text-xs font-bold text-emerald-600 hover:underline"
          @click="expanded[section.key] = !expanded[section.key]"
        >
          {{ expanded[section.key] ? '收起' : `展开更多（${section.tags.length - 6}）` }}
        </button>
      </section>
    </div>
  </div>
</template>

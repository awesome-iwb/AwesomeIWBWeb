<template>
  <div :class="containerClass" @click="$emit('click')">
    <div v-if="icon" class="flex-shrink-0" :class="active ? 'text-[var(--color-brand-500)]' : 'text-muted-foreground'">
      <component :is="icon" class="w-5 h-5" />
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-sm font-bold truncate" :class="active ? 'text-[var(--color-brand-700)] dark:text-[var(--color-brand-300)]' : 'text-foreground'">
        {{ title }}
      </div>
      <div v-if="subtitle" class="text-xs truncate" :class="active ? 'text-[var(--color-brand-600)]/70 dark:text-[var(--color-brand-400)]/70' : 'text-muted-foreground'">
        {{ subtitle }}
      </div>
    </div>
    <div v-if="badge || badgeStatus" class="flex-shrink-0">
      <Badge v-if="badgeStatus" :variant="getStatusConfig(badgeStatus).variant" :class="[getStatusConfig(badgeStatus).class, active ? 'bg-white/20 text-white border-white/30' : '']">
        {{ badge || getStatusConfig(badgeStatus).label }}
      </Badge>
      <span v-else class="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-bold" :class="active ? 'bg-[var(--color-brand-500)]/20 text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)]' : 'bg-secondary text-muted-foreground'">
        {{ badge }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Badge, getStatusConfig } from './badge';

const props = withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  icon?: any;
  active?: boolean;
  badge?: string;
  badgeStatus?: string;
}>(), {
  active: false,
});

defineEmits<{
  click: [];
}>();

const containerClass = computed(() => {
  const base = 'relative cursor-pointer transition-all duration-200 flex items-center gap-3 overflow-hidden';
  const radius = 'rounded-[var(--radius-sm-g2)]';
  const padding = 'p-3 md:p-3.5';

  if (props.active) {
    return `${base} ${radius} ${padding} bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-500)]/10 shadow-[var(--shadow-layer-1)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-[var(--color-brand-500)]`;
  }

  return `${base} ${radius} ${padding} bg-card border border-border hover:bg-accent md:hover:scale-[1.01] active:bg-accent`;
});
</script>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ScrollAreaCorner, ScrollAreaRoot, ScrollAreaViewport } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import ScrollBar from './ScrollBar.vue'

const props = defineProps<{
  class?: HTMLAttributes['class']
  orientation?: 'vertical' | 'horizontal'
}>()

const delegatedProps = computed(() => {
  const { class: _, orientation: _o, ...delegated } = props
  return delegated
})
</script>

<template>
  <ScrollAreaRoot
    v-bind="delegatedProps"
    :class="cn('relative overflow-hidden', props.class)"
  >
    <ScrollAreaViewport class="h-full w-full rounded-[inherit]">
      <slot />
    </ScrollAreaViewport>
    <ScrollBar :orientation="orientation" />
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>

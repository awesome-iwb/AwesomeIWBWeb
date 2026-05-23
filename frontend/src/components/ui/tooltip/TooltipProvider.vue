<script setup lang="ts">
import { TooltipProvider as TooltipProviderPrimitive } from 'reka-ui'

const props = withDefaults(
  defineProps<{
    delayDuration?: number
    skipDelayDuration?: number
    disableClosingTrigger?: boolean
    disableHoverableContent?: boolean
  }>(),
  {
    delayDuration: 200,
    skipDelayDuration: 300,
    disableClosingTrigger: false,
    disableHoverableContent: false,
  },
)
</script>

<template>
  <TooltipProviderPrimitive v-bind="props">
    <slot />
  </TooltipProviderPrimitive>
</template>

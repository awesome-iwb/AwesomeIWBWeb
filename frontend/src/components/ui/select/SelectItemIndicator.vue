<script setup lang="ts">
import type { SelectItemIndicatorProps } from 'reka-ui'
import { SelectItemIndicator } from 'reka-ui'

const props = defineProps<SelectItemIndicatorProps>()
</script>

<template>
  <SelectItemIndicator
    data-slot="select-item-indicator"
    v-bind="props"
  >
    <slot />
  </SelectItemIndicator>
</template>

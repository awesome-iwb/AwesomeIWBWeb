<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { PaginationList, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <PaginationList
    v-bind="forwardedProps"
    :class="cn('flex items-center gap-1', props.class)"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </PaginationList>
</template>

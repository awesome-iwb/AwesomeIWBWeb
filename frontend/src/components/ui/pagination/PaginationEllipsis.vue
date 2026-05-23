<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { PaginationEllipsis, useForwardProps } from 'reka-ui'
import { MoreHorizontal } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <PaginationEllipsis
    v-bind="forwardedProps"
    :class="cn('flex h-9 w-9 items-center justify-center', props.class)"
  >
    <MoreHorizontal class="h-4 w-4" />
  </PaginationEllipsis>
</template>

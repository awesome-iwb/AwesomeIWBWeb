<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { PaginationListItem, type PaginationListItemProps, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const props = defineProps<PaginationListItemProps & { class?: HTMLAttributes['class']; asChild?: boolean }>()

const delegatedProps = reactiveOmit(props, 'class', 'asChild')
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <PaginationListItem v-bind="forwardedProps" as-child>
    <Button variant="outline" size="icon" :class="cn('h-9 w-9', props.class)">
      <slot />
    </Button>
  </PaginationListItem>
</template>

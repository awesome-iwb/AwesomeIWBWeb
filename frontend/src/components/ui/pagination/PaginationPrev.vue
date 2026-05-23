<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { PaginationPrev, useForwardProps } from 'reka-ui'
import { ChevronLeft } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <PaginationPrev v-bind="forwardedProps" as-child>
    <Button variant="outline" size="icon" :class="cn('h-9 w-9', props.class)">
      <ChevronLeft />
    </Button>
  </PaginationPrev>
</template>

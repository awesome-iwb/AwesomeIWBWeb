<script setup lang="ts">
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
} from 'reka-ui'
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    class?: string
    sideOffset?: number
    side?: 'top' | 'right' | 'bottom' | 'left'
    align?: 'start' | 'center' | 'end'
    alignOffset?: number
    avoidCollisions?: boolean
    collisionBoundary?: Element | null | Array<Element | null>
    collisionPadding?: number | Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>
    arrowPadding?: number
    sticky?: 'partial' | 'always'
    hideWhenDetached?: boolean
  }>(),
  {
    sideOffset: 4,
    side: 'top',
    align: 'center',
    avoidCollisions: true,
    collisionPadding: 0,
    arrowPadding: 0,
    sticky: 'partial',
    hideWhenDetached: false,
  },
)

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      v-bind="delegatedProps"
      :class="
        cn(
          'z-50 overflow-hidden rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          props.class,
        )
      "
    >
      <slot />
      <TooltipArrow
        class="fill-popover"
        :width="8"
        :height="4"
      />
    </TooltipContent>
  </TooltipPortal>
</template>

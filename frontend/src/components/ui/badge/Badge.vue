<script lang="ts">
export type { BadgeProps } from './types'
export { badgeVariants } from './variants'
</script>

<script setup lang="ts">
import { cn } from '@/lib/utils'
import { badgeVariants } from './variants'
import type { BadgeProps } from './types'

const props = defineProps<BadgeProps>()
</script>

<template>
  <div :class="cn(badgeVariants({ variant: props.variant }), props.class)">
    <slot />
  </div>
</template>

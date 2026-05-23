<script lang="ts">
export { buttonVariants } from './variants'
export type { ButtonProps } from './types'
</script>

<script setup lang="ts">
import { cn } from '@/lib/utils'
import { buttonVariants } from './variants'
import type { ButtonProps } from './types'
import { Primitive } from 'reka-ui'

const props = withDefaults(defineProps<ButtonProps>(), {
  asChild: false,
})
</script>

<template>
  <Primitive
    :as-child="props.asChild"
    :class="cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)"
  >
    <slot />
  </Primitive>
</template>

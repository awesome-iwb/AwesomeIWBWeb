import type { HTMLAttributes } from 'vue'
import type { BadgeVariants } from './variants'

export interface BadgeProps {
  variant?: NonNullable<BadgeVariants['variant']>
  class?: HTMLAttributes['class']
}

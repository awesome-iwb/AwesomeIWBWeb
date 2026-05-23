import type { HTMLAttributes } from 'vue'
import type { ButtonVariants } from './variants'

export interface ButtonProps {
  variant?: NonNullable<ButtonVariants['variant']>
  size?: NonNullable<ButtonVariants['size']>
  class?: HTMLAttributes['class']
  asChild?: boolean
}

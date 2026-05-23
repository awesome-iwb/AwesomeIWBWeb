import type { BadgeVariants } from './variants'

type BadgeVariant = NonNullable<BadgeVariants['variant']>

const statusConfig: Record<string, { variant: BadgeVariant; class?: string; label: string }> = {
  pending: { variant: 'outline', class: 'border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400', label: '待审核' },
  approved: { variant: 'outline', class: 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400', label: '已通过' },
  rejected: { variant: 'outline', class: 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400', label: '已拒绝' },
  active: { variant: 'outline', class: 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400', label: '活跃' },
  inactive: { variant: 'secondary', label: '未激活' },
  open: { variant: 'outline', class: 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400', label: '待处理' },
  resolved: { variant: 'outline', class: 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400', label: '已解决' },
  closed: { variant: 'secondary', label: '已关闭' },
  draft: { variant: 'secondary', label: '草稿' },
  published: { variant: 'outline', class: 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400', label: '已发布' },
}

export function getStatusConfig(status: string) {
  return statusConfig[status] ?? { variant: 'secondary' as BadgeVariant, label: status }
}

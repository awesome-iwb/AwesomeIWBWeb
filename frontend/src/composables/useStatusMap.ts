type StatusConfig = {
  class: string;
  label: string;
};

const statusMap: Record<string, StatusConfig> = {
  pending: { class: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400', label: '待审核' },
  approved: { class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', label: '已通过' },
  rejected: { class: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400', label: '已拒绝' },
  active: { class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', label: '活跃' },
  inactive: { class: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', label: '未激活' },
  open: { class: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400', label: '待处理' },
  resolved: { class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', label: '已解决' },
  closed: { class: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', label: '已关闭' },
  doing: { class: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400', label: '处理中' },
  done: { class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', label: '已完成' },
  draft: { class: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', label: '草稿' },
  published: { class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', label: '已发布' },
  suspended: { class: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', label: '已暂停' },
};

export function getStatusConfig(status: string): StatusConfig {
  return statusMap[status] ?? { class: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', label: status };
}

export function getStatusClass(status: string): string {
  return getStatusConfig(status).class;
}

export function getStatusLabel(status: string): string {
  return getStatusConfig(status).label;
}

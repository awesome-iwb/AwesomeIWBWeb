<template>
  <div class="space-y-3">
    <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
      <label class="text-sm font-bold text-slate-700 dark:text-slate-300 shrink-0">角色模板</label>
      <select
        v-model="selectedTemplate"
        @change="applyTemplate"
        class="w-full sm:w-auto min-w-[11rem] max-w-full px-3 py-2.5 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base sm:text-sm touch-manipulation"
      >
        <option value="">自定义</option>
        <option v-for="key in templateKeys" :key="key" :value="key">{{ templates[key].name }}</option>
      </select>
      <div class="flex gap-2 sm:ml-auto">
        <button @click="selectAll" class="text-xs text-emerald-500 hover:underline">全选</button>
        <button @click="deselectAll" class="text-xs text-slate-400 hover:underline">清空</button>
      </div>
    </div>

    <div v-for="tier in tiers" :key="tier.key" class="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      <button
        @click="toggleTier(tier.key)"
        class="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors"
        :class="tierBgClass(tier.key)"
      >
        <span class="w-1 h-5 rounded-full" :class="tierDotClass(tier.key)"></span>
        <span>{{ tierLabels[tier.key] }}</span>
        <span class="text-xs font-normal opacity-70">({{ tierSelectedCount(tier) }}/{{ tierTotalCount(tier) }})</span>
        <component :is="expandedTiers.has(tier.key) ? ChevronUp : ChevronDown" class="w-4 h-4 ml-auto opacity-50" />
      </button>

      <div v-if="expandedTiers.has(tier.key)" class="space-y-0">
        <div v-for="group in tierGroups(tier.key)" :key="group.category" class="border-t border-slate-100 dark:border-slate-700/50">
          <button
            @click="toggleGroup(group.category)"
            class="w-full flex items-center justify-between px-6 py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
          >
            <div class="flex items-center gap-2">
              <span :class="groupHasAny(group) ? 'text-emerald-500' : 'text-slate-300'">
                {{ groupHasAny(group) ? '✅' : '☐' }}
              </span>
              <span class="text-slate-700 dark:text-slate-300">{{ groupLabels[group.category] || group.category }}</span>
              <span class="text-xs text-slate-400">({{ group.items.filter(c => modelValue.includes(c.id)).length }}/{{ group.items.length }})</span>
            </div>
            <component :is="expandedGroups.has(group.category) ? ChevronUp : ChevronDown" class="w-3.5 h-3.5 text-slate-400" />
          </button>
          <div v-if="expandedGroups.has(group.category)" class="px-8 pb-3 space-y-1.5">
            <label v-for="cap in group.items" :key="cap.id" class="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" :checked="modelValue.includes(cap.id)" @change="toggleCap(cap.id)" :disabled="disabled" class="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500" />
              <span class="text-slate-700 dark:text-slate-300">{{ cap.name }}</span>
              <span class="text-xs text-slate-400">{{ cap.description }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronUp, ChevronDown } from 'lucide-vue-next';

type Capability = { id: string; name: string; category: string; description: string };
type RoleTemplate = { name: string; capabilityIds: string[] };

const props = defineProps<{
  modelValue: string[];
  allCapabilities: Capability[];
  templates: Record<string, RoleTemplate>;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();

const expandedTiers = ref(new Set<string>(['user', 'dev', 'ops']));
const expandedGroups = ref(new Set<string>());
const selectedTemplate = ref('');

const templateKeys = computed(() => {
  const preferred = ['user', 'developer', 'editor', 'ops'];
  const keys = preferred.filter((key) => key in props.templates);
  for (const key of Object.keys(props.templates)) {
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
});

const tierLabels: Record<string, string> = {
  user: '用户层',
  dev: '开发者层',
  ops: '运维层',
};

const tierOrder = ['user', 'dev', 'ops'];

const groupLabels: Record<string, string> = {
  'user.social': '社交',
  'user.personal': '个人',
  'user.contribute': '贡献',
  'dev.access': '访问',
  'dev.project': '项目',
  'dev.project_admin': '项目管理',
  'dev.org': '组织',
  'dev.interact': '互动',
  'dev.data': '数据',
  'ops.access': '访问',
  'ops.project': '项目',
  'ops.review': '审核',
  'ops.content': '内容',
  'ops.system': '系统',
};

const tierBgClass = (tier: string) => {
  switch (tier) {
    case 'user': return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300';
    case 'dev': return 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300';
    case 'ops': return 'bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300';
    default: return 'bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300';
  }
};

const tierDotClass = (tier: string) => {
  switch (tier) {
    case 'user': return 'bg-emerald-500';
    case 'dev': return 'bg-blue-500';
    case 'ops': return 'bg-purple-500';
    default: return 'bg-slate-400';
  }
};

const getTier = (category: string): string => category.split('.')[0];

const groups = computed(() => {
  const map = new Map<string, Capability[]>();
  for (const cap of props.allCapabilities) {
    const list = map.get(cap.category) || [];
    list.push(cap);
    map.set(cap.category, list);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
});

const tiers = computed(() => {
  return tierOrder.map(key => ({ key }));
});

const tierGroups = (tierKey: string) => {
  return groups.value.filter(g => getTier(g.category) === tierKey);
};

const tierSelectedCount = (tier: { key: string }) => {
  return groups.value
    .filter(g => getTier(g.category) === tier.key)
    .reduce((sum, g) => sum + g.items.filter(c => props.modelValue.includes(c.id)).length, 0);
};

const tierTotalCount = (tier: { key: string }) => {
  return groups.value
    .filter(g => getTier(g.category) === tier.key)
    .reduce((sum, g) => sum + g.items.length, 0);
};

const groupHasAny = (group: { category: string; items: Capability[] }) => {
  return group.items.some(c => props.modelValue.includes(c.id));
};

const toggleTier = (tier: string) => {
  const next = new Set(expandedTiers.value);
  if (next.has(tier)) next.delete(tier);
  else next.add(tier);
  expandedTiers.value = next;
};

const toggleGroup = (category: string) => {
  const next = new Set(expandedGroups.value);
  if (next.has(category)) next.delete(category);
  else next.add(category);
  expandedGroups.value = next;
};

const toggleCap = (capId: string) => {
  const next = props.modelValue.includes(capId)
    ? props.modelValue.filter(id => id !== capId)
    : [...props.modelValue, capId];
  emit('update:modelValue', next);
};

const applyTemplate = () => {
  if (!selectedTemplate.value) return;
  const tpl = props.templates[selectedTemplate.value];
  if (tpl) emit('update:modelValue', [...tpl.capabilityIds]);
};

const selectAll = () => emit('update:modelValue', props.allCapabilities.map(c => c.id));
const deselectAll = () => emit('update:modelValue', []);
</script>

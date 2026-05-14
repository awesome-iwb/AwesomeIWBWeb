<template>
  <div class="space-y-2">
    <div class="flex items-center gap-3 mb-3">
      <label class="text-sm font-bold text-slate-700 dark:text-slate-300">角色模板</label>
      <select v-model="selectedTemplate" @change="applyTemplate" class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <option value="">自定义</option>
        <option v-for="(tpl, key) in templates" :key="key" :value="key">{{ tpl.name }}</option>
      </select>
      <div class="flex gap-2 ml-auto">
        <button @click="selectAll" class="text-xs text-emerald-500 hover:underline">全选</button>
        <button @click="deselectAll" class="text-xs text-slate-400 hover:underline">清空</button>
      </div>
    </div>

    <div v-for="group in groups" :key="group.category" class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        @click="toggleGroup(group.category)"
        class="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div class="flex items-center gap-2">
          <span :class="groupHasAny(group) ? 'text-emerald-500' : 'text-slate-300'">
            {{ groupHasAny(group) ? '✅' : '☐' }}
          </span>
          <span>{{ groupLabels[group.category] || group.category }}</span>
          <span class="text-xs text-slate-400">({{ group.items.filter(c => modelValue.includes(c.id)).length }}/{{ group.items.length }})</span>
        </div>
        <component :is="expandedGroups.has(group.category) ? ChevronUp : ChevronDown" class="w-4 h-4 text-slate-400" />
      </button>
      <div v-if="expandedGroups.has(group.category)" class="px-4 pb-3 space-y-2">
        <label v-for="cap in group.items" :key="cap.id" class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" :checked="modelValue.includes(cap.id)" @change="toggleCap(cap.id)" class="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500" />
          <span class="text-slate-700 dark:text-slate-300">{{ cap.name }}</span>
          <span class="text-xs text-slate-400">{{ cap.description }}</span>
        </label>
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

const expandedGroups = ref(new Set<string>());
const selectedTemplate = ref('');

const groupLabels: Record<string, string> = {
  panel: '面板访问',
  project: '项目管理',
  category: '分类管理',
  submission: '提交审核',
  moderation: '内容审核',
  user: '用户管理',
  audit: '审计日志',
  story: '故事管理',
  feedback: '反馈管理',
  comment: '评论管理',
  media: '媒体管理',
};

const groups = computed(() => {
  const map = new Map<string, Capability[]>();
  for (const cap of props.allCapabilities) {
    const list = map.get(cap.category) || [];
    list.push(cap);
    map.set(cap.category, list);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
});

const groupHasAny = (group: { category: string; items: Capability[] }) => {
  return group.items.some(c => props.modelValue.includes(c.id));
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

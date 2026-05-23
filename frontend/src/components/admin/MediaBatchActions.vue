<template>
  <div v-if="selectedIds.length > 0" class="flex items-center gap-3 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
    <span class="text-sm font-medium text-emerald-700 dark:text-emerald-300">已选 {{ selectedIds.length }} 项</span>
    <button @click="$emit('batchTag')" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
      批量打标签
    </button>
    <button @click="$emit('batchDelete')" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-500 text-white hover:bg-rose-600 transition-colors">
      批量删除
    </button>
    <button @click="$emit('clearSelection')" class="text-sm text-muted-foreground hover:text-foreground">
      取消选择
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ selectedIds: string[] }>();
defineEmits<{ batchTag: []; batchDelete: []; clearSelection: [] }>();
</script>

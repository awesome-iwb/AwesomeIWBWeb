<template>
  <div class="flex flex-wrap gap-1.5 items-center">
    <span
      v-for="tag in modelValue"
      :key="tag"
      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
    >
      {{ tag }}
      <button v-if="!disabled" @click="removeTag(tag)" class="hover:text-rose-500">&times;</button>
    </span>
    <input
      v-if="!disabled"
      v-model="newTag"
      @keydown.enter.prevent="addTag"
      class="px-2 py-0.5 rounded text-xs border border-border bg-transparent outline-none focus:border-emerald-500 w-20"
      placeholder="+ 标签"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  modelValue: string[];
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();

const newTag = ref('');

const addTag = () => {
  const tag = newTag.value.trim();
  if (!tag || props.modelValue.includes(tag)) return;
  emit('update:modelValue', [...props.modelValue, tag]);
  newTag.value = '';
};

const removeTag = (tag: string) => {
  emit('update:modelValue', props.modelValue.filter(t => t !== tag));
};
</script>

<template>
  <div>
    <label v-if="label" class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{{ label }}</label>
    <div class="relative">
      <input
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        class="w-full px-4 py-3 rounded-xl border outline-none transition-colors text-base"
        :class="[
          error
            ? 'border-rose-500 focus:border-rose-500'
            : 'border-slate-200 dark:border-slate-700 focus:border-[var(--color-brand-500)]',
          disabled ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900',
          'placeholder:text-slate-400',
        ]"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <p v-if="error" class="text-xs text-rose-500 mt-1">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-slate-400 mt-1">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: string;
  label?: string;
  placeholder?: string;
  type?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
}>(), {
  type: 'text',
});

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

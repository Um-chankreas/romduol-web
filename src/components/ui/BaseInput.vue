<template>
  <div class="flex flex-col gap-1.5 w-full text-left">
    <div v-if="label || $slots.action" class="flex justify-between items-center">
      <label v-if="label" class="text-sm font-medium text-slate-700 dark:text-slate-300">
        {{ label }}
      </label>
      <slot name="action" />
    </div>

    <div class="relative flex items-center w-full">
      <div v-if="$slots.icon" class="absolute left-3.5 text-slate-400 pointer-events-none flex items-center justify-center">
        <slot name="icon" />
      </div>
      <input
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', $event.target.value)"
        :class="[
          'w-full rounded-xl border border-emerald-100 bg-emerald-50/50 dark:bg-slate-800/80 dark:border-slate-700 dark:text-white px-4 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600',
          $slots.icon ? 'pl-11' : ''
        ]"
      />
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: String,
  label: String,
  placeholder: String,
  type: { type: String, default: 'text' }
});
defineEmits(['update:modelValue']);
</script>
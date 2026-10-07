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
        :type="isPassword && show ? 'text' : type"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', $event.target.value)"
        :class="[
          'w-full rounded-xl border border-emerald-100 bg-emerald-50/50 dark:bg-slate-800/80 dark:border-slate-700 dark:text-white px-4 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-600',
          $slots.icon ? 'pl-11' : '',
          isPassword ? 'pr-11' : ''
        ]"
      />
      <button v-if="isPassword" type="button" @click="show = !show" :aria-label="show ? 'Hide password' : 'Show password'"
        class="absolute right-3 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer">
        <EyeOff v-if="show" class="w-4 h-4" />
        <Eye v-else class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Eye, EyeOff } from 'lucide-vue-next';

const show = ref(false);
const props = defineProps({
  modelValue: String,
  label: String,
  placeholder: String,
  type: { type: String, default: 'text' }
});
const isPassword = computed(() => props.type === 'password');
defineEmits(['update:modelValue']);
</script>
<template>
  <button
    :type="type"
    :class="[
      'w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-bold text-sm transition-all duration-200 shadow-md active:scale-[0.98] cursor-pointer',
      variant === 'primary' 
        ? 'bg-emerald-900 hover:bg-emerald-950 text-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-emerald-950' 
        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-emerald-900 dark:text-slate-100'
    ]"
  >
    <slot />
  </button>
</template>

<script setup>
defineProps({
  type: { type: String, default: 'button' },
  variant: { type: String, default: 'primary' }
});
</script>
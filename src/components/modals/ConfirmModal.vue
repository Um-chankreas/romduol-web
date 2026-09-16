<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    @click.self="!loading && $emit('close')"
  >
    <div class="w-full max-w-sm rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 shadow-2xl transition-all text-left">
      <div class="w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center text-lg mb-4">
        ⚠️
      </div>

      <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-2">
        {{ title }}
      </h2>
      <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {{ message }}
      </p>

      <p v-if="error" class="text-xs text-red-600 mt-4">{{ error }}</p>

      <div class="flex items-center justify-end gap-3 mt-6">
        <button
          @click="$emit('close')"
          :disabled="loading"
          class="px-5 py-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          @click="$emit('confirm')"
          :disabled="loading"
          class="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition cursor-pointer disabled:opacity-50"
        >
          {{ loading ? 'Deleting...' : confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: 'Are you sure?' },
  message: { type: String, default: 'This action cannot be undone.' },
  confirmLabel: { type: String, default: 'Delete' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }
})

defineEmits(['close', 'confirm'])
</script>

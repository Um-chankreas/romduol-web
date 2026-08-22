<script setup>
defineProps({
  title: String,
  studentCount: Number,
  tags: Array,
  isLive: Boolean
});

const emit = defineEmits(['start-live']);
</script>

<template>
  <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
    <div>
      <h3 class="text-base font-bold text-slate-900 dark:text-white leading-snug mb-2">{{ title }}</h3>
      <p class="text-xs text-slate-500 mb-3">👥 {{ studentCount }} Students enrolled</p>
      <div class="flex gap-2">
        <span v-for="tag in tags" :key="tag" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
          {{ tag }}
        </span>
      </div>
    </div>

    <!-- Action Button -->
    <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
      <button 
        v-if="isLive"
        @click="emit('start-live', title)" 
        class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
      >
        📹 Start Live Class
      </button>
      <button 
        v-else 
        class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-300 transition"
      >
        View Details
      </button>
    </div>
  </div>
</template>
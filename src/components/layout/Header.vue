<script setup>
import { useTheme } from '../../composables/useTheme';

const { isDark, toggleTheme } = useTheme();
</script>

<template>
  <header class="w-full px-6 sm:px-8 py-4 flex items-center justify-end border-b border-emerald-900/10 dark:border-slate-800 bg-[#F1FCF0] dark:bg-slate-900">
    <!-- User Actions & Profile -->
    <div class="flex items-center gap-3.5">
      <!-- Theme Switcher Icon Button -->
      <button 
        @click="toggleTheme" 
        type="button"
        title="Toggle Theme"
        class="p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition shadow-sm cursor-pointer"
      >
        <span v-if="isDark" class="text-base leading-none block">☀️</span>
        <span v-else class="text-base leading-none block">🌙</span>
      </button>

      <!-- Notifications Icon Button -->
      <button 
        type="button"
        class="relative p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition shadow-sm cursor-pointer"
      >
        <span class="text-base leading-none block">🔔</span>
        <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
      </button>

      <!-- User Info -->
      <div class="flex items-center gap-3 ml-1">
        <div class="text-right">
          <p class="text-sm font-bold text-slate-900 dark:text-white leading-tight">Dr. Sarah Jenkins</p>
          <p class="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">Mathematics Lead</p>
        </div>
        <div class="w-10 h-10 rounded-full bg-[#034d31] text-white flex items-center justify-center font-bold text-sm ring-2 ring-emerald-600/30 shadow-sm shrink-0">
          SJ
        </div>
      </div>
    </div>
  </header>
</template>
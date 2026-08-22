<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  studentCount: {
    type: Number,
    default: 0
  },
  tags: {
    type: Array,
    default: () => []
  },
  isLive: {
    type: Boolean,
    default: false
  },
  avatars: {
    type: Array,
    default: () => [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100'
    ]
  }
});

const emit = defineEmits(['start-live', 'view-details', 'more-options']);

const remainingStudents = computed(() => {
  const visibleCount = Math.min(props.avatars.length, 2);
  return Math.max(0, props.studentCount - visibleCount);
});
</script>

<template>
  <div class="relative bg-white dark:bg-[#111827] rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between min-h-[220px] h-full overflow-hidden text-left select-none">
    
    <!-- Curved Top-Right Background Accent -->
    <div class="absolute top-0 right-0 w-24 sm:w-28 h-24 sm:h-28 bg-[#e8f3ec] dark:bg-slate-800/50 rounded-bl-full pointer-events-none"></div>

    <!-- More Options Button -->
    <button 
      @click="emit('more-options')" 
      class="absolute top-4 right-4 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition p-1.5 rounded-full z-10"
      aria-label="More options"
    >
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
      </svg>
    </button>

    <!-- CONTENT -->
    <div class="space-y-3 z-10">
      <!-- Title -->
      <h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug pr-7 tracking-tight">
        {{ title }}
      </h3>

      <!-- Student Count -->
      <div class="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium text-xs">
        <svg class="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <span>{{ studentCount }} Students</span>
      </div>

      <!-- Tags Grid -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span 
          v-for="(tag, index) in tags" 
          :key="index" 
          class="px-2.5 py-1 rounded-md bg-[#e2ede5] dark:bg-slate-800/90 text-[#3d5a45] dark:text-emerald-300 text-[11px] font-semibold tracking-wide whitespace-nowrap"
        >
          {{ tag }}
        </span>
      </div>
    </div>

    <!-- BOTTOM ACTION BAR -->
    <div class="flex items-center justify-between gap-2 pt-4 z-10">
      <!-- Stacked Avatars -->
      <div class="flex items-center -space-x-2 shrink-0">
        <img 
          v-for="(avatar, i) in avatars.slice(0, 2)" 
          :key="i" 
          :src="avatar" 
          class="inline-block h-7 w-7 sm:h-8 sm:w-8 rounded-full ring-2 ring-white dark:ring-[#111827] object-cover" 
          alt="Student avatar" 
        />
        <div 
          v-if="remainingStudents > 0" 
          class="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-[#dbe8dd] dark:bg-slate-800 ring-2 ring-white dark:ring-[#111827] text-[10px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-300"
        >
          +{{ remainingStudents }}
        </div>
      </div>

      <!-- Live Action Button -->
      <button 
        v-if="isLive" 
        @click="emit('start-live', title)" 
        class="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition active:scale-95 shrink-0 whitespace-nowrap cursor-pointer"
      >
        <svg class="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        </svg>
        <span>Start Live Class</span>
      </button>

      <!-- View Details Button -->
      <button 
        v-else 
        @click="emit('view-details', title)" 
        class="px-3 sm:px-4 py-2 rounded-xl bg-[#e2ede5] dark:bg-slate-800 hover:bg-[#d4e3d7] dark:hover:bg-slate-700 text-[#2c4032] dark:text-slate-200 font-bold text-xs transition active:scale-95 shrink-0 whitespace-nowrap cursor-pointer"
      >
        View Details
      </button>
    </div>

  </div>
</template>
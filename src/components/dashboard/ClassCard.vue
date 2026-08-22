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

// Remaining student count indicator badge (e.g., +25)
const remainingStudents = computed(() => {
  const visibleCount = Math.min(props.avatars.length, 2);
  return Math.max(0, props.studentCount - visibleCount);
});
</script>

<template>
  <div class="relative bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between overflow-hidden h-[240px] select-none text-left">
    
    <!-- Curved Top-Right Light/Dark Background Accent -->
    <div class="absolute top-0 right-0 w-28 h-28 bg-[#e8f3ec] dark:bg-slate-800/60 rounded-bl-full pointer-events-none"></div>

    <!-- More Options (Three Dots) Button -->
    <button 
      @click="emit('more-options')" 
      class="absolute top-5 right-5 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition p-1 rounded-full z-10"
      aria-label="More options"
    >
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
      </svg>
    </button>

    <!-- MAIN CONTENT -->
    <div class="space-y-2 z-10 text-left">
      <!-- Title -->
      <h3 class="text-xl font-bold text-slate-900 dark:text-white leading-tight pr-8 tracking-tight text-left">
        {{ title }}
      </h3>

      <!-- Student Count -->
      <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-xs justify-start">
        <svg class="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <span>{{ studentCount }} Students</span>
      </div>

      <!-- Tags Grid -->
      <div class="flex items-center gap-2 pt-1 flex-wrap justify-start">
        <span 
          v-for="(tag, index) in tags" 
          :key="index" 
          class="px-3 py-1 rounded-lg bg-[#e2ede5] dark:bg-slate-800 text-[#3d5a45] dark:text-emerald-300 text-xs font-semibold tracking-wide"
        >
          {{ tag }}
        </span>
      </div>
    </div>

    <!-- BOTTOM ACTION BAR -->
    <div class="flex items-center justify-between pt-2 z-10">
      <!-- Stacked Avatars with Counter -->
      <div class="flex items-center -space-x-2.5 overflow-hidden">
        <img 
          v-for="(avatar, i) in avatars.slice(0, 2)" 
          :key="i" 
          :src="avatar" 
          class="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover" 
          alt="Student avatar" 
        />
        <div 
          v-if="remainingStudents > 0" 
          class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#dbe8dd] dark:bg-slate-800 ring-2 ring-white dark:ring-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-300"
        >
          +{{ remainingStudents }}
        </div>
      </div>

      <!-- Live Action Button (Red) -->
      <button 
        v-if="isLive" 
        @click="emit('start-live', title)" 
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
      >
        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        </svg>
        <span>Start Live Class</span>
      </button>

      <!-- View Details Button -->
      <button 
        v-else 
        @click="emit('view-details', title)" 
        class="px-4 py-2.5 rounded-xl bg-[#e2ede5] dark:bg-slate-800 hover:bg-[#d4e3d7] dark:hover:bg-slate-700 text-[#2c4032] dark:text-slate-200 font-bold text-xs transition active:scale-95 cursor-pointer"
      >
        View Details
      </button>
    </div>

  </div>
</template>
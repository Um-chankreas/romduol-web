<script setup>
import Sidebar from '../../components/layout/Sidebar.vue';
import Header from '../../components/layout/Header.vue';
import ClassCard from '../../components/dashboard/ClassCard.vue';

// Define the re-emit event to pass to App.vue
const emit = defineEmits(['start-live']);

const handleStartLive = (title) => {
  emit('start-live', title);
};
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-[#F1FCF0] dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header />

      <main class="p-6 sm:p-8 flex-1 flex flex-col lg:flex-row justify-between items-start gap-8 w-full">
        <div class="flex-1 w-full max-w-3xl">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <ClassCard 
              title="Grade 12 Advanced Calculus"
              :studentCount="28"
              :tags="['Block A', 'Room 402']"
              :isLive="true"
              @start-live="handleStartLive"
            />
            <ClassCard 
              title="AP Physics C: Mechanics"
              :studentCount="15"
              :tags="['Block C', 'Lab 2']"
              :isLive="false"
              @start-live="handleStartLive"
            />
            <ClassCard 
              title="Intro to Computer Science"
              :studentCount="32"
              :tags="['Online']"
              :isLive="true"
              @start-live="handleStartLive"
            />
          </div>
        </div>

        <!-- Right section widgets stay unchanged -->
        <div class="w-full lg:w-80 shrink-0 space-y-6">
          <div class="flex items-center justify-end gap-3">
            <button class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-100/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-emerald-200/80 transition border border-emerald-200/60 dark:border-slate-700">
              <span>🔗</span> Join Class
            </button>
            <button class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#034d31] text-white font-bold text-xs shadow-md hover:bg-[#023824] transition">
              <span>+</span> Create Class
            </button>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
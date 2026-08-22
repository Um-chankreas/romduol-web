<script setup>
import { useRouter } from 'vue-router';
import Sidebar from '../../components/layout/Sidebar.vue';
import Header from '../../components/layout/Header.vue';
import ClassCard from '../../components/dashboard/ClassCard.vue';

const router = useRouter();

const handleStartLive = (title) => {
  // Option A: Use fixed channel name as requested
  const channel = 'rodoul-live-class-dev';
  
  // Resolve route path and open in new tab
  const routeData = router.resolve({ 
    name: 'LiveStream', 
    params: { channelName: channel },
    query: { title: title } // Pass classroom title as query param
  });

  window.open(routeData.href, '_blank');
};
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-[#F1FCF0] dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header />

      <main class="p-6 sm:p-8 flex-1 flex flex-col lg:flex-row justify-between items-start gap-8 w-full">
        <!-- LEFT SECTION: Class Cards Grid -->
        <div class="flex-1 w-full">
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
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

        <!-- RIGHT SECTION: Widgets -->
        <div class="w-full lg:w-80 shrink-0 space-y-6">
          <div class="flex items-center justify-end gap-3">
            <button class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-100/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-emerald-200/80 transition shadow-sm border border-emerald-200/60 dark:border-slate-700">
              <span class="text-sm">🔗</span> Join Class
            </button>
            <button class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#034d31] text-white font-bold text-xs shadow-md hover:bg-[#023824] transition">
              <span class="text-sm font-normal">+</span> Create Class
            </button>
          </div>

          <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              📅 Upcoming Live Sessions
            </h2>
            <div class="space-y-3">
              <div class="p-3.5 rounded-2xl bg-emerald-50 dark:bg-slate-800/60 flex items-center gap-3 border border-emerald-100 dark:border-transparent">
                <div class="bg-[#034d31] text-white px-2.5 py-1.5 rounded-xl text-center shrink-0">
                  <span class="block text-[10px] font-bold uppercase text-emerald-200">OCT</span>
                  <span class="block text-sm font-extrabold leading-none">12</span>
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-900 dark:text-white">Midterm Review: Calculus</p>
                  <p class="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">10:00 AM - 11:30 AM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
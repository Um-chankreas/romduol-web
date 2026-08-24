<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCourseStore } from '../../stores/course';
import { liveClassService } from '../../api/liveClass.service'; // Added backend API service
import Sidebar from '../../components/layout/Sidebar.vue';
import Header from '../../components/layout/Header.vue';
import ClassCard from '../../components/dashboard/ClassCard.vue';

const router = useRouter();
const courseStore = useCourseStore();

onMounted(() => {
  courseStore.fetchCourses();
});

const handleStartLive = async (courseId, title) => {
  try {
    // 1. Call backend to create live session and generate Agora token/channel
    const res = await liveClassService.createLiveClass({
      course_id: courseId,
      title: `${title} - Live Session`
    });

    if (res.success) {
      const liveClassId = res.data.liveClass.id;

      // 2. Open LiveStream view passing dynamic liveClassId as route param
      const routeData = router.resolve({ 
        name: 'LiveStream', 
        params: { id: liveClassId }
      });

      window.open(routeData.href, '_blank');
    }
  } catch (err) {
    console.error('Failed to start live class session:', err);
  }
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
          <!-- Loading State -->
          <div v-if="courseStore.loading" class="text-center py-10 text-slate-500 font-medium">
            Loading classes...
          </div>

          <!-- Error State -->
          <div v-else-if="courseStore.error" class="p-4 rounded-xl bg-red-500/10 text-red-500 text-sm">
            {{ courseStore.error }}
          </div>

          <!-- Empty State -->
          <div v-else-if="courseStore.courses.length === 0" class="text-center py-10 text-slate-500">
            No classes available yet.
          </div>

          <!-- Courses Grid -->
          <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-5">
            <ClassCard 
              v-for="course in courseStore.courses"
              :key="course.id"
              :courseId="course.id"
              :title="course.title"
              :studentCount="0"
              :tags="[course.category, course.code ? `Code: ${course.code}` : 'No Code']"
              :isLive="true"
              @start-live="handleStartLive"
            />
          </div>
        </div>

        <!-- RIGHT SECTION: Widgets -->
        <div class="w-full lg:w-80 shrink-0 space-y-6">
          <div class="flex items-center justify-end gap-3">
            <button class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-100/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-emerald-200/80 transition shadow-sm border border-emerald-200/60 dark:border-slate-700 cursor-pointer">
              <span class="text-sm">🔗</span> Join Class
            </button>
            <button class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#034d31] text-white font-bold text-xs shadow-md hover:bg-[#023824] transition cursor-pointer">
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
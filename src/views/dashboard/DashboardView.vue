<script setup>
import { computed, onActivated, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { authService } from '../../services/authService.js';
import { courseService } from '../../services/courseService.js';
import { lessonService } from '../../services/lessonService.js';

import Sidebar from '../../components/layout/Sidebar.vue';
import Header from '../../components/layout/Header.vue';
import CreateClassModal from '../../components/modals/CreateClassModal.vue';

defineOptions({ name: 'DashboardView' });

const router = useRouter();

const currentUser = authService.getCurrentUser();

const courses = ref([]);
const loading = ref(false);
const loadError = ref('');

// Pass silent:true to refresh in the background (e.g. when returning to this
// cached view) without flashing the loading state.
const fetchCourses = async ({ silent = false } = {}) => {
  if (!silent) loading.value = true;
  loadError.value = '';
  try {
    const response = await courseService.getCourses();
    courses.value = response.data?.courses || response.data || [];
  } catch (err) {
    if (!silent) {
      loadError.value = err.response?.data?.message || err.message || 'Failed to load your classes.';
    }
  } finally {
    if (!silent) loading.value = false;
  }
};

// This view is kept alive (see App.vue) so navigating back to it doesn't
// remount/reload it. Re-fetch quietly on re-activation to keep data fresh.
let isFirstActivation = true;
onActivated(() => {
  if (isFirstActivation) {
    isFirstActivation = false;
    return;
  }
  fetchCourses({ silent: true });
});

onMounted(() => {
  fetchCourses();
});

const totalClasses = computed(() => courses.value.length);

const totalStudents = computed(() =>
  courses.value.reduce((sum, c) => sum + (c.student_count || 0), 0)
);

const recentClasses = computed(() =>
  [...courses.value]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5)
);

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
});

const today = computed(() =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
);

const navigateToDetails = (courseId) => {
  router.push(`/courses/${courseId}`);
};

/**
 * Create Class Handlers
 */
const showCreateModal = ref(false);
const creatingCourse = ref(false);
const createError = ref('');

const openCreateModal = () => {
  createError.value = '';
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  if (creatingCourse.value) return;
  showCreateModal.value = false;
};

const handleCreateCourse = async ({ title, description, category, color, icon, is_free, chapters = [], openAfter = false }) => {
  try {
    creatingCourse.value = true;
    createError.value = '';

    const response = await courseService.createCourse(title, description, category, color, icon, null, is_free);
    const newCourse = response.data?.course || response.course || response.data || response;

    if (newCourse?.id && chapters.length) {
      for (let i = 0; i < chapters.length; i++) {
        await lessonService.createLesson(newCourse.id, chapters[i], '', null, i + 1);
      }
    }

    if (newCourse) {
      courses.value.unshift(newCourse);
    }

    showCreateModal.value = false;

    if (openAfter && newCourse?.id) {
      router.push(`/courses/${newCourse.id}`);
    }
  } catch (err) {
    createError.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create class.';
  } finally {
    creatingCourse.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-[#f8fafd] dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header />

      <main class="p-6 sm:p-8 flex-1 w-full space-y-6">
        <!-- Welcome Banner -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {{ greeting }}{{ currentUser?.name ? `, ${currentUser.name}` : '' }} 👋
            </h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{{ today }}</p>
          </div>

          <button
            @click="openCreateModal"
            class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#034d31] text-white font-bold text-xs shadow-md hover:bg-[#023824] transition cursor-pointer active:scale-95 shrink-0"
          >
            <span class="text-sm font-normal">+</span>
            Create Class
          </button>
        </div>

        <!-- Error -->
        <div v-if="loadError" class="p-4 rounded-xl bg-red-500/10 text-red-500 text-sm">
          {{ loadError }}
        </div>

        <!-- Stat Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Classes</span>
              <span class="w-9 h-9 rounded-full bg-emerald-100 dark:bg-slate-800 flex items-center justify-center text-base">👥</span>
            </div>
            <p class="text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
              {{ loading ? '—' : totalClasses }}
            </p>
          </div>

          <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Students</span>
              <span class="w-9 h-9 rounded-full bg-emerald-100 dark:bg-slate-800 flex items-center justify-center text-base">🎓</span>
            </div>
            <p class="text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
              {{ loading ? '—' : totalStudents }}
            </p>
          </div>

          <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Latest Class</span>
              <span class="w-9 h-9 rounded-full bg-emerald-100 dark:bg-slate-800 flex items-center justify-center text-base">🆕</span>
            </div>
            <p class="text-lg font-extrabold text-slate-900 dark:text-white mt-3 truncate">
              {{ loading ? '—' : (recentClasses[0]?.title || 'No classes yet') }}
            </p>
          </div>
        </div>

        <!-- Recent Classes -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">Recent Classes</h2>
            <router-link
              to="/"
              class="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              View All →
            </router-link>
          </div>

          <div v-if="loading" class="text-center py-8 text-slate-500 text-sm">
            Loading classes...
          </div>

          <div v-else-if="recentClasses.length === 0" class="text-center py-8 text-slate-500 text-sm">
            No classes yet. Create your first class to get started.
          </div>

          <div v-else class="divide-y divide-slate-100 dark:divide-slate-800">
            <button
              v-for="course in recentClasses"
              :key="course.id"
              @click="navigateToDetails(course.id)"
              class="w-full flex items-center justify-between gap-3 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition rounded-xl px-2 -mx-2 cursor-pointer"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0"
                  :style="{ backgroundColor: course.color || '#034d31' }"
                >
                  <span>{{ course.icon || '📚' }}</span>
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ course.title }}</p>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">{{ course.category || 'General' }}</p>
                </div>
              </div>
              <span class="text-xs text-slate-400 shrink-0">{{ course.student_count || 0 }} students</span>
            </button>
          </div>
        </div>
      </main>
    </div>

    <!-- CREATE CLASS MODAL -->
    <CreateClassModal
      v-if="showCreateModal"
      :creating="creatingCourse"
      :error="createError"
      @close="closeCreateModal"
      @create="handleCreateCourse"
    />
  </div>
</template>

<script setup>
import { onActivated, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

defineOptions({ name: 'ClassesView' });

import { courseService } from '../../services/courseService.js';
import { liveClassService } from '../../services/liveClassService.js';

import Sidebar from '../../components/layout/Sidebar.vue';
import Header from '../../components/layout/Header.vue';
import ClassCard from '../../components/classes/ClassCard.vue';
import ConfirmModal from '../../components/modals/ConfirmModal.vue';
import CreateClassModal from '../../components/modals/CreateClassModal.vue';
const router = useRouter();

const navigateToDetails = (courseId) => {
  router.push(`/courses/${courseId}`);
};

// Classes Reactive State
const courses = ref([]);
const loading = ref(false);
const storeError = ref('');

const startingCourseId = ref(null);
const classesError = ref('');

// Student Join Modal State
const showJoinModal = ref(false);
const joinClassId = ref('');
const joinError = ref('');
const joiningClass = ref(false);

// Fetch all courses. Pass silent:true to refresh in the background
// (e.g. when returning to this cached view) without flashing the loading state.
const fetchCourses = async ({ silent = false } = {}) => {
  if (!silent) loading.value = true;
  storeError.value = '';
  try {
    const response = await courseService.getCourses();
    courses.value = response.data?.courses || response.data || [];
  } catch (err) {
    if (!silent) {
      storeError.value = err.response?.data?.message || err.message || 'Failed to load courses.';
    }
  } finally {
    if (!silent) loading.value = false;
  }
};

onMounted(() => {
  fetchCourses();
});

// This view is kept alive (see App.vue) so navigating back to it doesn't
// remount/reload it. Re-fetch quietly on re-activation to keep data fresh
// without re-triggering the loading spinner on every visit.
let isFirstActivation = true;
onActivated(() => {
  if (isFirstActivation) {
    isFirstActivation = false;
    return;
  }
  fetchCourses({ silent: true });
});

/**
 * Delete Class Handlers
 */
const courseToDelete = ref(null);
const showDeleteModal = ref(false);
const deletingCourse = ref(false);
const deleteError = ref('');

const confirmDeleteCourse = (courseId, title) => {
  courseToDelete.value = { id: courseId, title };
  deleteError.value = '';
  showDeleteModal.value = true;
};

const closeDeleteModal = () => {
  if (deletingCourse.value) return;
  showDeleteModal.value = false;
  courseToDelete.value = null;
};

const handleDeleteCourse = async () => {
  if (!courseToDelete.value) return;

  try {
    deletingCourse.value = true;
    deleteError.value = '';

    await courseService.deleteCourse(courseToDelete.value.id);

    courses.value = courses.value.filter((c) => c.id !== courseToDelete.value.id);
    showDeleteModal.value = false;
    courseToDelete.value = null;
  } catch (err) {
    deleteError.value = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to delete class.';
  } finally {
    deletingCourse.value = false;
  }
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

const handleCreateCourse = async ({ title, description, category, color, icon, is_free }) => {
  try {
    creatingCourse.value = true;
    createError.value = '';

    const response = await courseService.createCourse(title, description, category, color, icon, null, is_free);
    const newCourse = response.data?.course || response.course || response.data || response;

    if (newCourse) {
      courses.value.unshift(newCourse);
    }

    showCreateModal.value = false;
  } catch (err) {
    createError.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create class.';
  } finally {
    creatingCourse.value = false;
  }
};

/**
 * Edit Class Handlers — reuses CreateClassModal in edit mode.
 */
const showEditModal = ref(false);
const courseToEdit = ref(null);
const savingCourse = ref(false);
const editError = ref('');

const openEditModal = (courseId) => {
  courseToEdit.value = courses.value.find((c) => c.id === courseId) || null;
  if (!courseToEdit.value) return;
  editError.value = '';
  showEditModal.value = true;
};

const closeEditModal = () => {
  if (savingCourse.value) return;
  showEditModal.value = false;
  courseToEdit.value = null;
};

const handleUpdateCourse = async ({ id, ...data }) => {
  try {
    savingCourse.value = true;
    editError.value = '';

    const response = await courseService.updateCourse(id, data);
    const updated = response.data?.course || response.course || response.data || null;

    const idx = courses.value.findIndex((c) => c.id === id);
    if (idx !== -1) {
      courses.value[idx] = updated || { ...courses.value[idx], ...data };
    }

    showEditModal.value = false;
    courseToEdit.value = null;
  } catch (err) {
    editError.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update class.';
  } finally {
    savingCourse.value = false;
  }
};

/**
 * Teacher: Direct Live Stream Start
 * Triggered directly by @start-live on ClassCard
 */
const handleStartLive = async (courseId, title) => {
  startingCourseId.value = courseId;
  classesError.value = '';

  try {
    // 1. Create live class using positional arguments: (courseId, title, description, scheduledAt)
    const createRes = await liveClassService.createLiveClass(
      courseId,
      `${title} - Live Session`,
      '', // description optional
      new Date().toISOString()
    );

    // Safely extract liveClass object from API response
    const liveClassData = createRes.data?.liveClass || createRes.data || createRes.liveClass;
    const liveClassId = liveClassData?.id || createRes.id;

    if (!liveClassId) {
      throw new Error('Could not retrieve live class ID from backend response.');
    }

    // 2. Start the live class
    await liveClassService.startLiveClass(liveClassId);

    // 3. Resolve path and open in a new tab
    const routeData = router.resolve({
      name: 'LiveStream',
      params: { id: liveClassId }
    });

    window.open(routeData.href, '_blank');

  } catch (err) {
    console.error('Failed to start live class:', err);
    classesError.value = err.response?.data?.message || err.message || 'Failed to start live session';
  } finally {
    startingCourseId.value = null;
  }
};

/**
 * Student Join Modal Handlers
 */
const openJoinModal = () => {
  joinClassId.value = '';
  joinError.value = '';
  showJoinModal.value = true;
};

const closeJoinModal = () => {
  if (joiningClass.value) return;
  showJoinModal.value = false;
  joinClassId.value = '';
  joinError.value = '';
};

const handleJoinClass = async () => {
  const classId = joinClassId.value.trim();

  if (!classId) {
    joinError.value = 'Please enter the live class ID.';
    return;
  }

  try {
    joiningClass.value = true;
    joinError.value = '';

    const response = await liveClassService.getLiveClassDetails(classId);
    const liveClass = response.data?.liveClass || response.data || response;

    if (liveClass.status !== 'active') {
      joinError.value =
        liveClass.status === 'scheduled'
          ? 'This class has not started yet.'
          : 'This class is no longer active.';
      return;
    }

    const routeData = router.resolve({
      name: 'LiveStream',
      params: { id: liveClass.id }
    });

    window.open(routeData.href, '_blank');
    closeJoinModal();

  } catch (error) {
    console.error('Join class error:', error);
    joinError.value =
      error.response?.data?.message ||
      error.message ||
      'Failed to join live class';
  } finally {
    joiningClass.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-[#f8fafd] dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header />

      <main class="p-6 sm:p-8 flex-1 flex flex-col lg:flex-row justify-between items-start gap-8 w-full">
        <!-- LEFT -->
        <div class="flex-1 w-full">

          <!-- Error -->
          <div v-if="classesError" class="mb-5 p-4 rounded-xl bg-red-500/10 text-red-500 text-sm">
            {{ classesError }}
          </div>

          <!-- Loading -->
          <div v-if="loading" class="text-center py-10 text-slate-500 font-medium">
            Loading classes...
          </div>

          <!-- Store/API Error -->
          <div v-else-if="storeError" class="p-4 rounded-xl bg-red-500/10 text-red-500 text-sm">
            {{ storeError }}
          </div>

          <!-- Empty -->
          <div v-else-if="courses.length === 0" class="text-center py-10 text-slate-500">
            No classes available yet.
          </div>

          <!-- Courses -->
          <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-5">
            <ClassCard
              v-for="course in courses"
              :key="course.id"
              :courseId="course.id"
              :title="course.title"
              :studentCount="course.student_count || 0"
              :tags="[
                course.category,
                course.code ? `Code: ${course.code}` : 'No Code'
              ]"
              :isLive="true"
              :isFree="!!course.is_free"
              :loading="startingCourseId === course.id"
              @start-live="handleStartLive"
              @view-details="navigateToDetails"
              @edit-course="openEditModal"
              @delete-course="confirmDeleteCourse"
              @click="navigateToDetails(course.id)"
              class="cursor-pointer"
              :students="course.students || []"
            />
          </div>
        </div>

        <!-- RIGHT -->
        <div class="w-full lg:w-80 shrink-0 space-y-6">

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3">
            <!-- Join -->
            <button
              @click="openJoinModal"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-100/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-emerald-200/80 transition shadow-sm border border-emerald-200/60 dark:border-slate-700 cursor-pointer"
            >
              <span class="text-sm">🔗</span>
              Join Class
            </button>

            <!-- Create -->
            <button
              @click="openCreateModal"
              class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#034d31] text-white font-bold text-xs shadow-md hover:bg-[#023824] transition cursor-pointer"
            >
              <span class="text-sm font-normal">+</span>
              Create Class
            </button>
          </div>

          <!-- Upcoming -->
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
                  <p class="text-xs font-bold text-slate-900 dark:text-white">
                    Midterm Review: Calculus
                  </p>
                  <p class="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    10:00 AM - 11:30 AM
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- JOIN MODAL -->
    <div
      v-if="showJoinModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      @click.self="closeJoinModal"
    >
      <div class="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
        <!-- Header -->
        <div class="flex items-start justify-between mb-5">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">
              Join Live Class
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Enter the live class ID shared by your teacher.
            </p>
          </div>

          <button
            @click="closeJoinModal"
            class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        <!-- Input -->
        <input
          v-model="joinClassId"
          type="text"
          placeholder="Enter Live Class ID"
          :disabled="joiningClass"
          class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          @keyup.enter="handleJoinClass"
        />

        <!-- Error -->
        <p v-if="joinError" class="mt-3 text-sm text-red-500">
          {{ joinError }}
        </p>

        <!-- Buttons -->
        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="closeJoinModal"
            :disabled="joiningClass"
            class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            @click="handleJoinClass"
            :disabled="joiningClass"
            class="px-5 py-2.5 rounded-xl bg-[#034d31] text-white font-semibold text-sm hover:bg-[#023824] disabled:opacity-50"
          >
            {{ joiningClass ? 'Joining...' : 'Join Class' }}
          </button>
        </div>
      </div>
    </div>

    <!-- DELETE CLASS MODAL -->
    <ConfirmModal
      v-if="showDeleteModal"
      title="Delete this class?"
      :message="`This will permanently delete '${courseToDelete?.title}' and all of its lessons, quizzes, and student data. This action cannot be undone.`"
      confirm-label="Delete Class"
      :loading="deletingCourse"
      :error="deleteError"
      @close="closeDeleteModal"
      @confirm="handleDeleteCourse"
    />

    <!-- CREATE CLASS MODAL -->
    <CreateClassModal
      v-if="showCreateModal"
      :creating="creatingCourse"
      :error="createError"
      @close="closeCreateModal"
      @create="handleCreateCourse"
    />

    <!-- EDIT CLASS MODAL -->
    <CreateClassModal
      v-if="showEditModal"
      :course="courseToEdit"
      :creating="savingCourse"
      :error="editError"
      @close="closeEditModal"
      @save="handleUpdateCourse"
    />
  </div>
</template>
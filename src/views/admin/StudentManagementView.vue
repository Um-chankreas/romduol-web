<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';

defineOptions({ name: 'StudentManagementView' });

import { studentService } from '../../services/studentService.js';
import { teacherService } from '../../services/teacherService.js';

import Sidebar from '../../components/layout/Sidebar.vue';
import Header from '../../components/layout/Header.vue';
import ConfirmModal from '../../components/modals/ConfirmModal.vue';
import StudentFormModal from '../../components/modals/StudentFormModal.vue';
import TeacherFormModal from '../../components/modals/TeacherFormModal.vue';
import StudentSubscriptionModal from '../../components/modals/StudentSubscriptionModal.vue';

const tab = ref('students');   // 'students' | 'teachers' | 'courses'

// ================= STUDENTS =================
const search = ref('');
const paidFilter = ref('all');       // 'all' | 'paid' | 'unpaid'
const includeInactive = ref(false);

const students = ref([]);
const loading = ref(false);
const listError = ref('');
const page = ref(1);
const limit = ref(20);
const pagination = ref({ page: 1, limit: 20, total: 0, total_pages: 1 });

const fetchStudents = async ({ silent = false } = {}) => {
  if (!silent) loading.value = true;
  listError.value = '';
  try {
    const res = await studentService.listStudents({
      search: search.value.trim() || undefined,
      paid: paidFilter.value === 'all' ? undefined : paidFilter.value === 'paid',
      include_inactive: includeInactive.value ? true : undefined,
      page: page.value,
      limit: limit.value,
    });
    students.value = res.students;
    pagination.value = res.pagination;
  } catch (err) {
    listError.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to load students.';
  } finally {
    if (!silent) loading.value = false;
  }
};

let searchTimer = null;
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { page.value = 1; fetchStudents(); }, 350);
});
watch([paidFilter, includeInactive], () => { page.value = 1; fetchStudents(); });

const goToPage = (n) => {
  if (n < 1 || n > (pagination.value.total_pages || 1)) return;
  page.value = n;
  fetchStudents();
};

// ================= TEACHERS =================
const tSearch = ref('');
const tIncludeInactive = ref(false);

const teachers = ref([]);
const tLoading = ref(false);
const tListError = ref('');
const tPage = ref(1);
const tLimit = ref(20);
const tPagination = ref({ page: 1, limit: 20, total: 0, total_pages: 1 });
const tRowBusy = reactive(new Set());

const fetchTeachers = async ({ silent = false } = {}) => {
  if (!silent) tLoading.value = true;
  tListError.value = '';
  try {
    const res = await teacherService.listTeachers({
      search: tSearch.value.trim() || undefined,
      include_inactive: tIncludeInactive.value ? true : undefined,
      page: tPage.value,
      limit: tLimit.value,
    });
    teachers.value = res.teachers;
    tPagination.value = res.pagination;
  } catch (err) {
    tListError.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to load teachers.';
  } finally {
    if (!silent) tLoading.value = false;
  }
};

let tSearchTimer = null;
watch(tSearch, () => {
  clearTimeout(tSearchTimer);
  tSearchTimer = setTimeout(() => { tPage.value = 1; fetchTeachers(); }, 350);
});
watch(tIncludeInactive, () => { tPage.value = 1; fetchTeachers(); });

const tGoToPage = (n) => {
  if (n < 1 || n > (tPagination.value.total_pages || 1)) return;
  tPage.value = n;
  fetchTeachers();
};

// ---- teacher create / edit ----
const showTeacherModal = ref(false);
const editingTeacher = ref(null);
const savingTeacher = ref(false);
const teacherFormError = ref('');

const openAddTeacher = () => { editingTeacher.value = null; teacherFormError.value = ''; showTeacherModal.value = true; };
const openEditTeacher = (t) => { editingTeacher.value = t; teacherFormError.value = ''; showTeacherModal.value = true; };
const closeTeacherForm = () => { if (!savingTeacher.value) { showTeacherModal.value = false; editingTeacher.value = null; } };

const handleTeacherSubmit = async (payload) => {
  savingTeacher.value = true;
  teacherFormError.value = '';
  try {
    if (payload.id) {
      const { id, ...data } = payload;
      const updated = await teacherService.updateTeacher(id, data);
      const idx = teachers.value.findIndex((t) => t.id === id);
      if (idx !== -1) teachers.value[idx] = { ...teachers.value[idx], ...(updated || data) };
    } else {
      await teacherService.createTeacher(payload);
      tPage.value = 1;
      await fetchTeachers({ silent: true });
    }
    showTeacherModal.value = false;
    editingTeacher.value = null;
  } catch (err) {
    teacherFormError.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save teacher.';
  } finally {
    savingTeacher.value = false;
  }
};

// ---- teacher deactivate / restore ----
const showTeacherDeactivateModal = ref(false);
const teacherToDeactivate = ref(null);
const deactivatingTeacher = ref(false);
const teacherDeactivateError = ref('');

const confirmDeactivateTeacher = (t) => { teacherToDeactivate.value = t; teacherDeactivateError.value = ''; showTeacherDeactivateModal.value = true; };
const closeTeacherDeactivate = () => { if (!deactivatingTeacher.value) { showTeacherDeactivateModal.value = false; teacherToDeactivate.value = null; } };

const handleDeactivateTeacher = async () => {
  if (!teacherToDeactivate.value) return;
  deactivatingTeacher.value = true;
  teacherDeactivateError.value = '';
  try {
    await teacherService.deactivateTeacher(teacherToDeactivate.value.id);
    if (tIncludeInactive.value) {
      const idx = teachers.value.findIndex((t) => t.id === teacherToDeactivate.value.id);
      if (idx !== -1) teachers.value[idx].is_active = false;
    } else {
      teachers.value = teachers.value.filter((t) => t.id !== teacherToDeactivate.value.id);
      if (tPagination.value.total) tPagination.value.total -= 1;
    }
    showTeacherDeactivateModal.value = false;
    teacherToDeactivate.value = null;
  } catch (err) {
    teacherDeactivateError.value = err.response?.data?.error || err.message || 'Failed to deactivate teacher.';
  } finally {
    deactivatingTeacher.value = false;
  }
};

const restoreTeacher = async (t) => {
  tRowBusy.add(t.id);
  try {
    await teacherService.restoreTeacher(t.id);
    t.is_active = true;
  } catch (err) {
    tListError.value = err.response?.data?.error || err.message || 'Failed to restore teacher.';
  } finally {
    tRowBusy.delete(t.id);
  }
};

// ================= COURSES (live access) =================
const courses = ref([]);
const coursesLoading = ref(false);
const coursesError = ref('');
const courseBusy = reactive(new Set());

const fetchCourses = async () => {
  coursesLoading.value = true;
  coursesError.value = '';
  try {
    courses.value = await studentService.listCourses();
  } catch (err) {
    coursesError.value = err.response?.data?.error || err.message || 'Failed to load courses.';
  } finally {
    coursesLoading.value = false;
  }
};

const toggleCourseLive = async (course) => {
  const next = !(course.live_enabled !== false);
  courseBusy.add(course.id);
  try {
    const updated = await studentService.setCourseLiveEnabled(course.id, next);
    course.live_enabled = updated?.live_enabled ?? next;
  } catch (err) {
    coursesError.value = err.response?.data?.error || err.message || 'Could not update course.';
  } finally {
    courseBusy.delete(course.id);
  }
};

onMounted(() => {
  fetchStudents();
  fetchTeachers();
  fetchCourses();
});

// ================= helpers =================
const initialOf = (name) => (name || '?').trim().charAt(0).toUpperCase();
const brokenAvatars = reactive(new Set());
const formatDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
};
// Subscriptions are per course: "2/3 courses" = active / courses they're in.
const subSummary = (s) => s.subscription_summary || { enrolled: 0, active: 0, active_courses: [] };
const subBadge = (s) => {
  const { active, enrolled } = subSummary(s);
  return enrolled === 0 ? 'No courses' : `${active}/${enrolled} course${enrolled === 1 ? '' : 's'}`;
};
const subCourseNames = (s) => {
  const list = subSummary(s).active_courses;
  if (list.length === 0) return '';
  return list.length <= 2
    ? list.map((c) => c.title).join(', ')
    : `${list.slice(0, 2).map((c) => c.title).join(', ')} +${list.length - 2}`;
};
const subTooltip = (s) => {
  const list = subSummary(s).active_courses;
  return list.length
    ? list.map((c) => `${c.title} — until ${formatDate(c.expiry_date)}`).join('\n')
    : 'No active course subscriptions — click to manage';
};

// ---- create / edit ----
const showFormModal = ref(false);
const editingStudent = ref(null);
const savingStudent = ref(false);
const formError = ref('');

const openAdd = () => { editingStudent.value = null; formError.value = ''; showFormModal.value = true; };
const openEdit = (s) => { editingStudent.value = s; formError.value = ''; showFormModal.value = true; };
const closeForm = () => { if (!savingStudent.value) { showFormModal.value = false; editingStudent.value = null; } };

const handleFormSubmit = async (payload) => {
  savingStudent.value = true;
  formError.value = '';
  try {
    if (payload.id) {
      const { id, ...data } = payload;
      const updated = await studentService.updateStudent(id, data);
      const idx = students.value.findIndex((s) => s.id === id);
      if (idx !== -1) students.value[idx] = { ...students.value[idx], ...(updated || data) };
    } else {
      await studentService.createStudent(payload);
      page.value = 1;
      await fetchStudents({ silent: true });
    }
    showFormModal.value = false;
    editingStudent.value = null;
  } catch (err) {
    formError.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save student.';
  } finally {
    savingStudent.value = false;
  }
};

// ---- subscription modal ----
const subStudent = ref(null);
const openSubscription = (s) => { subStudent.value = s; };
const closeSubscription = () => { subStudent.value = null; };
// `summary` = { enrolled, active, active_courses } straight from the modal.
const onSubscriptionChanged = (summary) => {
  if (!subStudent.value) return;
  const idx = students.value.findIndex((s) => s.id === subStudent.value.id);
  if (idx !== -1) {
    const isPaid = (summary?.active || 0) > 0;
    students.value[idx] = {
      ...students.value[idx],
      subscription_summary: summary,
      is_paid: isPaid,
    };
    if (paidFilter.value === 'paid' && !isPaid) removeRow(subStudent.value.id);
    if (paidFilter.value === 'unpaid' && isPaid) removeRow(subStudent.value.id);
  }
};
const removeRow = (id) => { students.value = students.value.filter((s) => s.id !== id); };

// ---- deactivate / restore ----
const showDeactivateModal = ref(false);
const studentToDeactivate = ref(null);
const deactivating = ref(false);
const deactivateError = ref('');
const rowBusy = reactive(new Set());

const confirmDeactivate = (s) => { studentToDeactivate.value = s; deactivateError.value = ''; showDeactivateModal.value = true; };
const closeDeactivate = () => { if (!deactivating.value) { showDeactivateModal.value = false; studentToDeactivate.value = null; } };

const handleDeactivate = async () => {
  if (!studentToDeactivate.value) return;
  deactivating.value = true;
  deactivateError.value = '';
  try {
    await studentService.deactivateStudent(studentToDeactivate.value.id);
    if (includeInactive.value) {
      const idx = students.value.findIndex((s) => s.id === studentToDeactivate.value.id);
      if (idx !== -1) students.value[idx].is_active = false;
    } else {
      removeRow(studentToDeactivate.value.id);
      if (pagination.value.total) pagination.value.total -= 1;
    }
    showDeactivateModal.value = false;
    studentToDeactivate.value = null;
  } catch (err) {
    deactivateError.value = err.response?.data?.error || err.message || 'Failed to deactivate student.';
  } finally {
    deactivating.value = false;
  }
};

const restore = async (s) => {
  rowBusy.add(s.id);
  try {
    await studentService.restoreStudent(s.id);
    s.is_active = true;
  } catch (err) {
    listError.value = err.response?.data?.error || err.message || 'Failed to restore student.';
  } finally {
    rowBusy.delete(s.id);
  }
};
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header />

      <main class="p-6 sm:p-8 flex-1 w-full space-y-5">
        <!-- Header row -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="text-left">
            <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Student Management
            </h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              $5 / week subscription unlocks every course's live classes. Turn live classes off per course below.
            </p>
          </div>

          <button
            v-if="tab === 'students'"
            @click="openAdd"
            class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#006A3A] text-white font-bold text-xs shadow-md hover:bg-[#005A31] transition cursor-pointer active:scale-95 shrink-0"
          >
            <span class="text-sm font-normal">+</span>
            Add Student
          </button>
          <button
            v-else-if="tab === 'teachers'"
            @click="openAddTeacher"
            class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#006A3A] text-white font-bold text-xs shadow-md hover:bg-[#005A31] transition cursor-pointer active:scale-95 shrink-0"
          >
            <span class="text-sm font-normal">+</span>
            Add Teacher
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
          <button
            v-for="t in [{ id: 'students', label: 'Students' }, { id: 'teachers', label: 'Teachers' }, { id: 'courses', label: 'Course Live Access' }]"
            :key="t.id"
            @click="tab = t.id"
            :class="[
              'px-4 py-2.5 text-sm font-bold transition cursor-pointer -mb-px border-b-2',
              tab === t.id
                ? 'border-[#006A3A] text-[#006A3A] dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            ]"
          >
            {{ t.label }}
          </button>
        </div>

        <!-- ===================== STUDENTS TAB ===================== -->
        <template v-if="tab === 'students'">
          <!-- Filters -->
          <div class="flex flex-col md:flex-row md:items-center gap-3">
            <div class="relative flex-1">
              <input
                v-model="search"
                type="text"
                placeholder="Search name, email or phone…"
                class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            </div>

            <div class="flex items-center gap-1.5 text-xs">
              <span class="font-semibold text-slate-500 dark:text-slate-400">Subscription:</span>
              <button
                v-for="opt in ['all', 'paid', 'unpaid']"
                :key="opt"
                @click="paidFilter = opt"
                :class="[
                  'px-2.5 py-1 rounded-lg font-bold capitalize transition cursor-pointer',
                  paidFilter === opt
                    ? 'bg-[#006A3A] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                ]"
              >
                {{ opt === 'paid' ? 'Any course active' : opt === 'unpaid' ? 'None active' : 'All' }}
              </button>
            </div>

            <label class="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" v-model="includeInactive" class="rounded accent-emerald-600" />
              Show deactivated
            </label>
          </div>

          <div v-if="listError" class="p-4 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-sm flex justify-between items-center">
            <span>{{ listError }}</span>
            <button @click="listError = ''" class="text-xs font-bold px-2">✕</button>
          </div>

          <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div v-if="loading" class="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading students…</div>
            <div v-else-if="students.length === 0" class="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {{ search || paidFilter !== 'all' ? 'No students match these filters.' : 'No students yet. Add your first student.' }}
            </div>

            <div v-else class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th class="px-4 py-3 font-bold">Student</th>
                    <th class="px-4 py-3 font-bold">Phone</th>
                    <th class="px-4 py-3 font-bold">Subscription</th>
                    <th class="px-4 py-3 font-bold">Joined</th>
                    <th class="px-4 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr
                    v-for="student in students"
                    :key="student.id"
                    :class="['transition', student.is_active === false ? 'opacity-50' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30']"
                  >
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-3">
                        <img
                          v-if="student.avatar_url && !brokenAvatars.has(student.avatar_url)"
                          :src="student.avatar_url"
                          @error="brokenAvatars.add(student.avatar_url)"
                          class="h-9 w-9 rounded-full object-cover shrink-0"
                          alt=""
                        />
                        <div v-else class="h-9 w-9 rounded-full bg-[#016a36] text-white flex items-center justify-center text-xs font-bold shrink-0 select-none">
                          {{ initialOf(student.name) }}
                        </div>
                        <div class="min-w-0">
                          <p class="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            {{ student.name }}
                            <span v-if="student.is_active === false" class="text-[10px] font-bold text-red-500 uppercase">deactivated</span>
                          </p>
                          <p class="text-xs text-slate-500 dark:text-slate-400 truncate">{{ student.email || student.phone || 'No contact' }}</p>
                        </div>
                      </div>
                    </td>

                    <td class="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {{ student.phone || '—' }}
                    </td>

                    <td class="px-4 py-3">
                      <button
                        @click="openSubscription(student)"
                        class="inline-flex items-center gap-2 group cursor-pointer"
                        title="Manage subscription"
                      >
                        <span
                          :class="[
                            'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide whitespace-nowrap',
                            student.is_paid
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          ]"
                          :title="subTooltip(student)"
                        >
                          {{ subBadge(student) }}
                        </span>
                        <span
                          v-if="subCourseNames(student)"
                          class="text-[11px] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 max-w-[180px] truncate"
                          :title="subTooltip(student)"
                        >
                          {{ subCourseNames(student) }}
                        </span>
                      </button>
                    </td>

                    <td class="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {{ formatDate(student.created_at) }}
                    </td>

                    <td class="px-4 py-3">
                      <div class="flex items-center justify-end gap-1">
                        <button
                          @click="openSubscription(student)"
                          class="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Manage subscription"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        <button
                          @click="openEdit(student)"
                          class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Edit student"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                          v-if="student.is_active === false"
                          @click="restore(student)"
                          :disabled="rowBusy.has(student.id)"
                          class="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-40"
                          title="Restore account"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                        <button
                          v-else
                          @click="confirmDeactivate(student)"
                          class="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
                          title="Deactivate account"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="students.length > 0"
              class="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400"
            >
              <span>{{ pagination.total }} student{{ pagination.total === 1 ? '' : 's' }}</span>
              <div class="flex items-center gap-2">
                <button @click="goToPage(page - 1)" :disabled="page <= 1" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">Prev</button>
                <span>{{ pagination.page }} / {{ pagination.total_pages || 1 }}</span>
                <button @click="goToPage(page + 1)" :disabled="page >= (pagination.total_pages || 1)" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">Next</button>
              </div>
            </div>
          </div>
        </template>

        <!-- ===================== TEACHERS TAB ===================== -->
        <template v-else-if="tab === 'teachers'">
          <!-- Filters -->
          <div class="flex flex-col md:flex-row md:items-center gap-3">
            <div class="relative flex-1">
              <input
                v-model="tSearch"
                type="text"
                placeholder="Search name, email or phone…"
                class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            </div>

            <label class="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" v-model="tIncludeInactive" class="rounded accent-emerald-600" />
              Show deactivated
            </label>
          </div>

          <div v-if="tListError" class="p-4 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-sm flex justify-between items-center">
            <span>{{ tListError }}</span>
            <button @click="tListError = ''" class="text-xs font-bold px-2">✕</button>
          </div>

          <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div v-if="tLoading" class="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading teachers…</div>
            <div v-else-if="teachers.length === 0" class="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {{ tSearch ? 'No teachers match this search.' : 'No teachers yet. Add your first teacher.' }}
            </div>

            <div v-else class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th class="px-4 py-3 font-bold">Teacher</th>
                    <th class="px-4 py-3 font-bold">Phone</th>
                    <th class="px-4 py-3 font-bold">Courses</th>
                    <th class="px-4 py-3 font-bold">Joined</th>
                    <th class="px-4 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr
                    v-for="teacher in teachers"
                    :key="teacher.id"
                    :class="['transition', teacher.is_active === false ? 'opacity-50' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30']"
                  >
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-3">
                        <img
                          v-if="teacher.avatar_url && !brokenAvatars.has(teacher.avatar_url)"
                          :src="teacher.avatar_url"
                          @error="brokenAvatars.add(teacher.avatar_url)"
                          class="h-9 w-9 rounded-full object-cover shrink-0"
                          alt=""
                        />
                        <div v-else class="h-9 w-9 rounded-full bg-[#016a36] text-white flex items-center justify-center text-xs font-bold shrink-0 select-none">
                          {{ initialOf(teacher.name) }}
                        </div>
                        <div class="min-w-0">
                          <p class="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            {{ teacher.name }}
                            <span v-if="teacher.is_active === false" class="text-[10px] font-bold text-red-500 uppercase">deactivated</span>
                          </p>
                          <p class="text-xs text-slate-500 dark:text-slate-400 truncate">{{ teacher.email || teacher.phone || 'No contact' }}</p>
                        </div>
                      </div>
                    </td>

                    <td class="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {{ teacher.phone || '—' }}
                    </td>

                    <td class="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {{ teacher.course_count ?? 0 }}
                    </td>

                    <td class="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {{ formatDate(teacher.created_at) }}
                    </td>

                    <td class="px-4 py-3">
                      <div class="flex items-center justify-end gap-1">
                        <button
                          @click="openEditTeacher(teacher)"
                          class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Edit teacher"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                          v-if="teacher.is_active === false"
                          @click="restoreTeacher(teacher)"
                          :disabled="tRowBusy.has(teacher.id)"
                          class="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-40"
                          title="Restore account"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                        <button
                          v-else
                          @click="confirmDeactivateTeacher(teacher)"
                          class="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
                          title="Deactivate account"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="teachers.length > 0"
              class="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400"
            >
              <span>{{ tPagination.total }} teacher{{ tPagination.total === 1 ? '' : 's' }}</span>
              <div class="flex items-center gap-2">
                <button @click="tGoToPage(tPage - 1)" :disabled="tPage <= 1" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">Prev</button>
                <span>{{ tPagination.page }} / {{ tPagination.total_pages || 1 }}</span>
                <button @click="tGoToPage(tPage + 1)" :disabled="tPage >= (tPagination.total_pages || 1)" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">Next</button>
              </div>
            </div>
          </div>
        </template>

        <!-- ===================== COURSES TAB ===================== -->
        <template v-else-if="tab === 'courses'">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            When live classes are <strong>off</strong> for a course, no student can join its live sessions — even with an active subscription for that course. When it's <strong>on</strong>, only students subscribed to that specific course can join (manage those from each student's subscription).
          </p>

          <div v-if="coursesError" class="p-4 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-sm flex justify-between items-center">
            <span>{{ coursesError }}</span>
            <button @click="coursesError = ''" class="text-xs font-bold px-2">✕</button>
          </div>

          <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div v-if="coursesLoading" class="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading courses…</div>
            <div v-else-if="courses.length === 0" class="p-10 text-center text-sm text-slate-500 dark:text-slate-400">No courses yet.</div>

            <ul v-else class="divide-y divide-slate-100 dark:divide-slate-800">
              <li v-for="course in courses" :key="course.id" class="flex items-center justify-between gap-4 px-4 py-3.5">
                <div class="min-w-0">
                  <p class="font-semibold text-slate-900 dark:text-white truncate">
                    {{ course.title }}
                    <span v-if="course.is_free" class="ml-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">FREE</span>
                  </p>
                  <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {{ course.teacher?.name || 'Unknown teacher' }}<template v-if="course.code"> · {{ course.code }}</template>
                  </p>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span
                    :class="[
                      'text-[11px] font-bold uppercase tracking-wide',
                      course.live_enabled !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    ]"
                  >
                    {{ course.live_enabled !== false ? 'Live on' : 'Live off' }}
                  </span>
                  <button
                    @click="toggleCourseLive(course)"
                    :disabled="courseBusy.has(course.id)"
                    :class="[
                      'relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-40',
                      course.live_enabled !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                    ]"
                    role="switch"
                    :aria-checked="course.live_enabled !== false"
                  >
                    <span
                      :class="[
                        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                        course.live_enabled !== false ? 'translate-x-5' : 'translate-x-0'
                      ]"
                    ></span>
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </template>
      </main>
    </div>

    <!-- Add / Edit -->
    <StudentFormModal
      v-if="showFormModal"
      :student="editingStudent"
      :busy="savingStudent"
      :error="formError"
      @close="closeForm"
      @submit="handleFormSubmit"
    />

    <!-- Subscription -->
    <StudentSubscriptionModal
      v-if="subStudent"
      :student="subStudent"
      @close="closeSubscription"
      @changed="onSubscriptionChanged"
    />

    <!-- Deactivate -->
    <ConfirmModal
      v-if="showDeactivateModal"
      title="Deactivate this account?"
      :message="`'${studentToDeactivate?.name}' will no longer be able to log in. Their history stays intact and you can restore the account later.`"
      confirm-label="Deactivate"
      :loading="deactivating"
      :error="deactivateError"
      @close="closeDeactivate"
      @confirm="handleDeactivate"
    />

    <!-- Add / Edit teacher -->
    <TeacherFormModal
      v-if="showTeacherModal"
      :teacher="editingTeacher"
      :busy="savingTeacher"
      :error="teacherFormError"
      @close="closeTeacherForm"
      @submit="handleTeacherSubmit"
    />

    <!-- Deactivate teacher -->
    <ConfirmModal
      v-if="showTeacherDeactivateModal"
      title="Deactivate this teacher?"
      :message="`'${teacherToDeactivate?.name}' will no longer be able to log in. Their courses and content stay intact and you can restore the account later.`"
      confirm-label="Deactivate"
      :loading="deactivatingTeacher"
      :error="teacherDeactivateError"
      @close="closeTeacherDeactivate"
      @confirm="handleDeactivateTeacher"
    />
  </div>
</template>

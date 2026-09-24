<script setup>
import { ref, computed, onMounted } from 'vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'
import Breadcrumb from '@/components/layout/Breadcrumb.vue'
import ClassScheduleCard from '@/components/classes/ClassScheduleCard.vue'
import { courseService } from '@/services/courseService'
import { classScheduleService } from '@/services/classScheduleService'

defineOptions({ name: 'ScheduleView' })

const courses = ref([])
const loading = ref(true)
const loadError = ref('')
const selectedCourseId = ref(null)

// course_id -> "Mon, Wed · 3:00 PM - 4:30 PM" (first active slot), same
// summary shown on the ClassCard badge — lets the subject picker on the
// left show at a glance which subjects already have a schedule set.
const scheduleLabelByCourse = ref({})
const DAY_LABEL = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' }
const formatTime = (hhmm) => {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}
const scheduleSummary = (schedule) => {
  const rank = (d) => (d === 0 ? 7 : d)
  const days = (schedule.days_of_week || []).slice().sort((a, b) => rank(a) - rank(b)).map((d) => DAY_LABEL[d])
  return `${days.join(', ')} · ${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`
}

const fetchSchedules = async () => {
  try {
    const res = await classScheduleService.getMySchedules()
    const byCourse = {}
    for (const schedule of res.data?.schedules || []) {
      if (!byCourse[schedule.course_id]) byCourse[schedule.course_id] = scheduleSummary(schedule)
    }
    scheduleLabelByCourse.value = byCourse
  } catch {
    /* non-fatal — picker just shows no badge */
  }
}

const fetchCourses = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const response = await courseService.getCourses()
    courses.value = response.data?.courses || response.data || []
    if (courses.value.length > 0) selectedCourseId.value = courses.value[0].id
  } catch (err) {
    loadError.value = err.response?.data?.message || err.message || 'Failed to load subjects.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchCourses()
  fetchSchedules()
})

const selectedCourse = computed(() => courses.value.find(c => c.id === selectedCourseId.value) || null)

// The ClassScheduleCard manages its own list internally; bump this key to
// make it re-fetch from scratch whenever the selected subject changes.
const selectCourse = (courseId) => {
  selectedCourseId.value = courseId
}

// Re-poll the badge summary after the ClassScheduleCard saves/deletes a slot
// so switching subjects (or coming back later) shows the up-to-date label.
const onScheduleChanged = () => {
  fetchSchedules()
}
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header>
        <template #left>
          <Breadcrumb :items="[{ label: 'Schedule' }]" />
        </template>
      </Header>

      <main class="p-6 sm:p-8 flex-1 w-full">
        <div class="mb-6">
          <h1 class="text-xl font-extrabold text-slate-900 dark:text-white">Class Schedule</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pick a subject, then set the recurring day/time it meets. Students get a reminder shortly before each session.
          </p>
        </div>

        <div v-if="loading" class="text-center py-10 text-slate-500 font-medium">Loading subjects...</div>
        <div v-else-if="loadError" class="p-4 rounded-xl bg-red-500/10 text-red-500 text-sm">{{ loadError }}</div>
        <div v-else-if="courses.length === 0" class="text-center py-10 text-slate-500">
          No subjects yet — create a class first.
        </div>

        <div v-else class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <!-- SUBJECT PICKER -->
          <div class="lg:col-span-1 bg-white dark:bg-slate-900/50 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 space-y-1.5 shadow-xs">
            <button
              v-for="course in courses"
              :key="course.id"
              @click="selectCourse(course.id)"
              :class="[
                'w-full text-left px-3.5 py-3 rounded-xl transition cursor-pointer',
                selectedCourseId === course.id
                  ? 'bg-[#006A3A] text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              ]"
            >
              <p class="text-xs font-bold truncate">{{ course.title }}</p>
              <p
                :class="[
                  'text-[10px] mt-0.5 truncate',
                  selectedCourseId === course.id ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'
                ]"
              >
                {{ scheduleLabelByCourse[course.id] || 'No schedule set' }}
              </p>
            </button>
          </div>

          <!-- SELECTED SUBJECT'S SCHEDULE -->
          <div class="lg:col-span-3 bg-white dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div v-if="selectedCourse" class="mb-4">
              <h2 class="text-base font-extrabold text-slate-900 dark:text-white">{{ selectedCourse.title }}</h2>
            </div>
            <ClassScheduleCard
              v-if="selectedCourseId"
              :key="selectedCourseId"
              :course-id="selectedCourseId"
              @changed="onScheduleChanged"
            />
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

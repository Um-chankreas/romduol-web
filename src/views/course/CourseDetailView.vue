<script setup>
import { ref, computed, onActivated, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import UploadLessonModal from '@/components/modals/UploadLessonModal.vue'
import EditLessonModal from '@/components/modals/EditLessonModal.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import Header from '@/components/layout/Header.vue'
import Breadcrumb from '@/components/layout/Breadcrumb.vue'
import QuizListView from '@/views/course/QuizListView.vue'
import AssignmentRosterView from '@/components/modals/AssignmentRosterView.vue'
import ClassScheduleCard from '@/components/classes/ClassScheduleCard.vue'
import CourseStudentsProgress from '@/components/insights/CourseStudentsProgress.vue'
import { authService } from '@/services/authService'
import { courseService } from '@/services/courseService'
import { lessonService } from '@/services/lessonService'
import { unitService } from '@/services/unitService'
import { assignmentService } from '@/services/assignmentService'
import { insightsService } from '@/services/insightsService'

defineOptions({ name: 'CourseDetailView' })

const route = useRoute()
const router = useRouter()

const course = ref(null)
// GET /api/courses/:id now returns lessons (each with its own nested
// quizzes) in a single response, so we no longer fetch lessons/quizzes
// separately — lessons is just derived local state we can still mutate
// for optimistic upload/edit/delete.
const lessons = ref([])
const allQuizzes = computed(() =>
  lessons.value.flatMap((lesson) =>
    (lesson.quizzes || []).map((quiz) => ({
      ...quiz,
      lesson_id: lesson.id,
      lesson_title: lesson.title
    }))
  )
)
const loading = ref(true)
const error = ref(null)
// ?tab=students (from the dashboard overview) opens straight on that tab.
const TAB_IDS = ['lessons', 'quizzes', 'assignments', 'students', 'schedule']
const activeTab = ref(TAB_IDS.includes(route.query.tab) ? route.query.tab : 'lessons')

// Upload Modal States
const showUploadModal = ref(false)
const uploadForm = ref({
  title: '',
  description: '',
  orderNumber: 0
})
const uploadFile = ref(null)
const uploading = ref(false)
const uploadError = ref(null)
const videoProgress = ref(null)
const isDragging = ref(false)
const fileInputRef = ref(null)

// Delete Class Modal States
const showDeleteModal = ref(false)
const deletingCourse = ref(false)
const deleteError = ref(null)

// Edit Lesson Modal States
const showEditLessonModal = ref(false)
const lessonToEdit = ref(null)
const editingLesson = ref(false)
const editLessonError = ref(null)

// Delete Lesson Modal States
const showDeleteLessonModal = ref(false)
const lessonToDelete = ref(null)
const deletingLesson = ref(false)
const deleteLessonError = ref(null)

// Customize Modal States
const showCustomizeModal = ref(false)
const formColor = ref('#006A3A')
const formCoverImage = ref(null)
const formIsFree = ref(false)
const saving = ref(false)
const saveError = ref(null)
const coverImageInputRef = ref(null)

const themeColors = [
  { hex: '#006A3A', bgHex: '#CFEBDD' },
  { hex: '#80B3FF', bgHex: '#D0E3FF' },
  { hex: '#4CAF50', bgHex: '#C8E6C9' },
  { hex: '#E91E63', bgHex: '#F8BBD0' },
  { hex: '#FF9800', bgHex: '#FFE0B2' },
  { hex: '#00BCD4', bgHex: '#B2EBF2' },
  { hex: '#9C27B0', bgHex: '#E1BEE7' },
  { hex: '#2196F3', bgHex: '#BBDEFB' },
  { hex: '#9E9E9E', bgHex: '#E0E0E0' }
]

const tabs = computed(() => [
  { id: 'lessons', name: 'Lessons', icon: '📖', tint: 'bg-blue-100 dark:bg-blue-950/50', count: lessons.value.length },
  { id: 'quizzes', name: 'Quizzes', icon: '❓', tint: 'bg-rose-100 dark:bg-rose-950/50', count: allQuizzes.value.length },
  { id: 'assignments', name: 'Assignments', icon: '📋', tint: 'bg-violet-100 dark:bg-violet-950/50', count: assignments.value.length },
  { id: 'students', name: 'Students', icon: '👥', tint: 'bg-emerald-100 dark:bg-emerald-950/50', count: rosterCount.value },
  { id: 'schedule', name: 'Schedule', icon: '📅', tint: 'bg-amber-100 dark:bg-amber-950/50' }
])

// ── Assignments ───────────────────────────────────────────────────────────
// Authoring (create/edit, draft/publish) happens on its own page — see
// AssignmentEditorView.vue — not in a dialog here.
const assignments = ref([])

// View-submissions roster stays a dialog; it's a read/grade surface, not
// part of the authoring flow that got merged into the editor page.
const rosterAssignmentId = ref(null)
const openRoster = (assignmentId) => { rosterAssignmentId.value = assignmentId }
const closeRoster = () => { rosterAssignmentId.value = null }

const fetchAssignments = async () => {
  try {
    assignments.value = await assignmentService.getCourseAssignments(route.params.id)
  } catch {
    /* non-fatal — the tab just shows empty */
  }
}

// Enrolled students + paid/unpaid (live-class subscription) status for the
// Students tab.
const fetchRoster = async () => {
  try {
    const res = await courseService.getCourseRoster(route.params.id)
    enrolledStudents.value = res.data?.roster || []
  } catch {
    /* non-fatal — the tab just shows empty */
  }
}

// courseTitle rides along as a query param purely so the assignment editor's
// breadcrumb can show "My Classes / <class> / …" without an extra fetch.
const goToCreateAssignment = () => {
  router.push({ name: 'CreateAssignment', params: { courseId: route.params.id }, query: { courseTitle: course.value?.title } })
}
const goToEditAssignment = (assignmentId) => {
  router.push({ name: 'EditAssignment', params: { courseId: route.params.id, id: assignmentId }, query: { courseTitle: course.value?.title } })
}

const formatDue = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const isOverdue = (iso) => iso && new Date(iso) < new Date()

// ── Students roster ───────────────────────────────────────────────────────
// Where every enrolled student is in this course (progress, XP, quizzes,
// activity). Staff-only on the API, so students never request it.
const roster = ref(null)
const rosterLoading = ref(false)
const rosterError = ref(null)
// undefined until the roster has loaded, so the tab badge stays hidden.
const rosterCount = computed(() => roster.value?.students?.length)

const fetchRoster = async ({ silent = false } = {}) => {
  if (!['teacher', 'admin'].includes(authService.getCurrentUser()?.role)) return
  try {
    if (!silent) {
      rosterLoading.value = true
      rosterError.value = null
    }
    roster.value = await insightsService.getCourseStudents(route.params.id)
    rosterError.value = null
  } catch (err) {
    if (!silent) {
      rosterError.value = err.response?.data?.error || err.message || 'Failed to load students.'
    }
  } finally {
    if (!silent) rosterLoading.value = false
  }
}


// Modal Handlers in parent component
const handleUpload = async ({ title, description, orderNumber, videoFile, markdown }) => {
  uploading.value = true
  uploadError.value = null
  videoProgress.value = null
  try {
    // Step 1: create the chapter (text-only — units and any video are added next).
    const res = await lessonService.createLesson(route.params.id, title, description, null, orderNumber)
    let newLesson = res.data?.lesson || res

    // Step 2: split the pasted Markdown into units on each `## ` heading.
    if (markdown) {
      await unitService.bulkImport(newLesson.id, markdown)
    }

    // Step 3: if a video was picked, upload it straight to storage against
    // the chapter we just created, then merge the returned video_url.
    if (videoFile) {
      videoProgress.value = 0
      const videoRes = await lessonService.uploadLessonVideo(newLesson.id, videoFile, {
        onProgress: (pct) => { videoProgress.value = pct }
      })
      newLesson = { ...newLesson, ...(videoRes.data?.lesson || videoRes) }
    }

    lessons.value.push({ ...newLesson, quizzes: newLesson.quizzes || [] })
    showUploadModal.value = false
  } catch (err) {
    uploadError.value = err.response?.data?.error || err.message || 'Upload failed'
  } finally {
    uploading.value = false
    videoProgress.value = null
  }
}
// Upload Handlers
const openUploadModal = () => {
 showUploadModal.value = true
  uploadForm.value = { title: '', description: '', orderNumber: 0 }
  uploadFile.value = null
  uploadError.value = null
}

const closeUploadModal = () => {
  if (uploading.value) return
  showUploadModal.value = false
  uploadFile.value = null
  uploadError.value = null
}

const isDirty = computed(() => {
  if (!course.value) return false
  return formColor.value !== course.value.color
    || formCoverImage.value !== course.value.cover_image
    || formIsFree.value !== !!course.value.is_free
})

const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

// Delete Class Handlers
const openDeleteModal = () => {
  deleteError.value = null
  showDeleteModal.value = true
}

const closeDeleteModal = () => {
  if (deletingCourse.value) return
  showDeleteModal.value = false
}

const handleDeleteCourse = async () => {
  try {
    deletingCourse.value = true
    deleteError.value = null

    await courseService.deleteCourse(route.params.id)

    router.push('/')
  } catch (err) {
    deleteError.value = err.response?.data?.message || err.response?.data?.error || 'Failed to delete class.'
  } finally {
    deletingCourse.value = false
  }
}

// Video Handlers
const watchVideo = (lesson) => {
  if (lesson?.video_url) {
    window.open(lesson.video_url, '_blank')
  }
}

const removingVideoId = ref(null)
const removeLessonVideo = async (lesson) => {
  if (!lesson?.video_url || removingVideoId.value) return
  try {
    removingVideoId.value = lesson.id
    await lessonService.deleteLessonVideo(lesson.id)
    const index = lessons.value.findIndex((l) => l.id === lesson.id)
    if (index !== -1) {
      lessons.value[index] = { ...lessons.value[index], video_url: null, duration_seconds: null }
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to remove video.'
  } finally {
    removingVideoId.value = null
  }
}

// Edit Lesson Handlers
const openEditLessonModal = (lesson) => {
  lessonToEdit.value = lesson
  editLessonError.value = null
  showEditLessonModal.value = true
}

const closeEditLessonModal = () => {
  if (editingLesson.value) return
  showEditLessonModal.value = false
  lessonToEdit.value = null
}

const handleEditLesson = async ({ title, description, orderNumber, videoFile, removeVideo }) => {
  if (!lessonToEdit.value) return
  const lessonId = lessonToEdit.value.id

  try {
    editingLesson.value = true
    editLessonError.value = null
    videoProgress.value = null

    await lessonService.updateLesson(lessonId, {
      title,
      description,
      order_number: orderNumber
    })
    // The PUT response returns a storage path (not a public URL) for
    // video_url, so only take the plain text fields from it and let the video
    // endpoints below supply the correct URL.
    let merged = { title, description, order_number: orderNumber }

    if (removeVideo) {
      await lessonService.deleteLessonVideo(lessonId)
      merged = { ...merged, video_url: null, duration_seconds: null }
    } else if (videoFile) {
      videoProgress.value = 0
      const r = await lessonService.uploadLessonVideo(lessonId, videoFile, {
        onProgress: (pct) => { videoProgress.value = pct }
      })
      const l = r.data?.lesson || {}
      merged = { ...merged, video_url: l.video_url, duration_seconds: l.duration_seconds }
    }

    const index = lessons.value.findIndex((l) => l.id === lessonId)
    if (index !== -1) {
      lessons.value[index] = { ...lessons.value[index], ...merged }
    }

    showEditLessonModal.value = false
    lessonToEdit.value = null
  } catch (err) {
    editLessonError.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update lesson.'
  } finally {
    editingLesson.value = false
    videoProgress.value = null
  }
}

// Delete Lesson Handlers
const openDeleteLessonModal = (lesson) => {
  lessonToDelete.value = lesson
  deleteLessonError.value = null
  showDeleteLessonModal.value = true
}

const closeDeleteLessonModal = () => {
  if (deletingLesson.value) return
  showDeleteLessonModal.value = false
  lessonToDelete.value = null
}

const deleteLesson = async () => {
  if (!lessonToDelete.value) return

  try {
    deletingLesson.value = true
    deleteLessonError.value = null

    await lessonService.deleteLesson(lessonToDelete.value.id)

    lessons.value = lessons.value.filter((l) => l.id !== lessonToDelete.value.id)
    showDeleteLessonModal.value = false
    lessonToDelete.value = null
  } catch (err) {
    deleteLessonError.value = err.response?.data?.error || err.response?.data?.message || 'Failed to delete lesson.'
  } finally {
    deletingLesson.value = false
  }
}

// Pass silent:true to refresh in the background (e.g. when returning to this
// cached view) without flashing the loading state or resetting the active tab.
const fetchCourseDetails = async ({ silent = false } = {}) => {
  try {
    if (!silent) {
      loading.value = true
      error.value = null
    }
    const response = await courseService.getCourseDetails(route.params.id)
    const fetchedCourse = response.data?.course || response.data || response

    course.value = fetchedCourse
    lessons.value = fetchedCourse?.lessons || []
    fetchAssignments()
    fetchRoster()
  } catch (err) {
    if (!silent) {
      error.value = err.response?.data?.message || err.response?.data?.error || 'Failed to load course details.'
    }
  } finally {
    if (!silent) loading.value = false
  }
}

// This view is kept alive per course id (see App.vue) so navigating away to
// create a quiz/lesson and back doesn't remount/reload it. Re-fetch quietly
// on re-activation so newly created lessons/quizzes still show up.
let isFirstActivation = true
onActivated(() => {
  if (isFirstActivation) {
    isFirstActivation = false
    return
  }
  if (TAB_IDS.includes(route.query.tab)) activeTab.value = route.query.tab
  fetchCourseDetails({ silent: true })
  fetchRoster({ silent: true })
})

// Customize Modal Handlers
const openCustomizeModal = () => {
  if (!course.value) return
  formColor.value = course.value.color || '#006A3A'
  formCoverImage.value = course.value.cover_image || null
  formIsFree.value = !!course.value.is_free
  saveError.value = null
  showCustomizeModal.value = true
}

const closeCustomizeModal = () => {
  showCustomizeModal.value = false
}

const triggerCoverImageSelect = () => {
  coverImageInputRef.value?.click()
}

const handleCoverImagePicked = (e) => {
  const file = e.target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (event) => {
      formCoverImage.value = event.target.result
    }
    reader.readAsDataURL(file)
  }
}

const handleSaveCustomization = async () => {
  if (!course.value) return

  try {
    saving.value = true
    saveError.value = null

    const updatePayload = {
      title: course.value.title,
      description: course.value.description,
      category: course.value.category,
      icon: course.value.icon,
      color: formColor.value,
      cover_image: formCoverImage.value,
      code: course.value.code,
      is_free: formIsFree.value
    }

    const response = await courseService.updateCourse(route.params.id, updatePayload)

    if (response.data?.course) {
      course.value = response.data.course
    } else {
      course.value.color = formColor.value
      course.value.cover_image = formCoverImage.value
      course.value.is_free = formIsFree.value
    }

    closeCustomizeModal()
  } catch (err) {
    saveError.value = err.response?.data?.error || err.response?.data?.message || 'Failed to update course.'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (route.params.id) {
    fetchCourseDetails()
    fetchRoster()
  }
})
</script>

<template>
  <div class="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors">
    <!-- Sidebar (Fixed Height, Non-Scrolling) -->
    <Sidebar class="hidden md:flex shrink-0 h-full" />

    <!-- Right Side Container -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Header (Fixed at top) -->
      <Header class="shrink-0">
        <template #left>
          <Breadcrumb :items="[{ label: 'My Classes', to: '/' }, { label: course?.title || 'Class' }]" />
        </template>
      </Header>

      <!-- Scrollable Content Area -->
      <main class="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 flex flex-col gap-6">
        <div class="w-full max-w-7xl mx-auto flex flex-col gap-6">
          <!-- BACK BUTTON -->
          <div class="flex items-center">
            <button 
              @click="goBack" 
              class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 text-xs font-bold border border-slate-200/80 dark:border-slate-800 shadow-xs transition active:scale-95 cursor-pointer group"
            >
              <svg class="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to Classes</span>
            </button>
          </div>

          <!-- LOADING STATE -->
          <div v-if="loading" class="text-center py-20 text-slate-600 dark:text-slate-400 font-medium">
            Loading course details...
          </div>

          <!-- ERROR STATE -->
          <div v-else-if="error" class="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm">
            {{ error }}
          </div>

          <template v-else-if="course">
            <!-- TOP BANNER -->
            <div
              class="relative w-full rounded-3xl p-6 sm:p-8 shadow-md overflow-hidden text-white transition-all bg-cover bg-center shrink-0"
              :style="{
                backgroundColor: course.color || '#006A3A',
                backgroundImage: course.cover_image ? `url(${course.cover_image})` : 'none'
              }"
            >
              <div class="relative z-10 flex justify-between items-start gap-4">
                <div class="space-y-3 max-w-2xl min-w-0">
                  <!-- Tags & Code -->
                  <div class="flex items-center flex-wrap gap-2.5">
                    <span class="px-2.5 py-1 rounded-lg bg-white/15 text-white text-[11px] font-bold uppercase tracking-wide border border-white/20 backdrop-blur-sm">
                      {{ course.category || course.code || 'COURSE' }}
                    </span>
                    <span
                      :class="[
                        'px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide shadow-sm',
                        course.is_free ? 'bg-amber-400 text-amber-950' : 'bg-white/90 text-slate-800'
                      ]"
                    >
                      {{ course.is_free ? '🎁 Free' : '💳 Paid' }}
                    </span>
                    <span v-if="rosterCount !== undefined" class="flex items-center gap-1.5 text-xs font-medium text-white/85">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                      </svg>
                      {{ rosterCount }} Student{{ rosterCount === 1 ? '' : 's' }} Enrolled
                    </span>
                  </div>

                  <!-- Title & Description -->
                  <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-white">
                    {{ course.title }}
                  </h1>
                  <p class="text-sm text-white/85 leading-relaxed max-w-xl">
                    {{ course.description || 'No description provided for this course.' }}
                  </p>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    @click="openCustomizeModal"
                    title="Customize"
                    aria-label="Customize class"
                    class="w-9 h-9 grid place-items-center rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-sm border border-white/20 transition cursor-pointer active:scale-95"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>

                  <!-- Delete Class Button -->
                  <button
                    @click="openDeleteModal"
                    class="w-9 h-9 grid place-items-center rounded-xl bg-white/15 hover:bg-red-600/80 text-white backdrop-blur-sm border border-white/20 transition cursor-pointer active:scale-95"
                    aria-label="Delete class"
                    title="Delete class"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Only dim for legibility when there's a photo behind the text. -->
              <div v-if="course.cover_image" class="absolute inset-0 bg-black/25 z-0 pointer-events-none"></div>
            </div>

            <!-- CURRICULUM & TASKS HEADER -->
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <h2 class="text-lg font-extrabold text-slate-900 dark:text-white">Curriculum &amp; Tasks</h2>
                <span class="px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                  Active Term
                </span>
              </div>
              <div class="flex items-center gap-2.5">
                <button
                  @click="openUploadModal"
                  class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer active:scale-95"
                >
                  <span class="text-sm font-normal leading-none">+</span> Upload Lesson
                </button>
                <button
                  @click="goToCreateAssignment"
                  class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#006A3A] hover:bg-[#005A31] text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-95"
                >
                  <span class="text-sm font-normal leading-none">+</span> Create Assignment
                </button>
              </div>
            </div>

            <!-- MAIN CONTENT LAYOUT -->
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start pb-12">
              <!-- TAB SIDEBAR CARD -->
              <div class="lg:col-span-1 bg-[#ffffff] dark:bg-slate-900/50 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 space-y-1.5 shadow-xs">
                <button
                  v-for="tab in tabs"
                  :key="tab.id"
                  @click="activeTab = tab.id"
                  :class="[
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer',
                    activeTab === tab.id
                      ? 'bg-[#006A3A] text-white shadow-sm'
                      : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  ]"
                >
                  <div class="flex items-center gap-2.5">
                    <span
                      :class="[
                        'w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0',
                        activeTab === tab.id ? 'bg-white/15' : tab.tint
                      ]"
                    >{{ tab.icon }}</span>
                    <span>{{ tab.name }}</span>
                  </div>
                  <span
                    v-if="tab.count !== undefined"
                    :class="[
                      'px-2 py-0.5 rounded-md text-[10px] font-semibold',
                      activeTab === tab.id ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                    ]"
                  >
                    {{ tab.count }}
                  </span>
                </button>
              </div>

              <!-- TAB CONTENT -->
              <div class="lg:col-span-3 space-y-6 min-w-0">
                <!-- LESSONS TAB -->
                <div v-if="activeTab === 'lessons'">
                  <div v-if="lessons.length === 0" class="w-full border-2 border-dashed border-slate-200/80 dark:border-slate-800 rounded-3xl bg-[#ffffff] dark:bg-slate-900/30 p-8 flex flex-col items-center justify-center text-center shadow-xs">
                    <div class="w-12 h-12 rounded-full bg-emerald-100 dark:bg-slate-800 text-[#006A3A] dark:text-emerald-400 flex items-center justify-center text-xl mb-3">
                      ☁️
                    </div>
                    <h3 class="text-base font-bold text-slate-900 dark:text-white">
                      No lessons yet
                    </h3>
                    <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 mb-4">
                      Upload your first lesson to get started
                    </p>
                    <button 
                      @click="openUploadModal"
                      class="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 transition shadow-sm cursor-pointer active:scale-95"
                    >
                      Upload Lesson
                    </button>
                  </div>

                  <!-- LESSON CARDS -->
                  <div v-else class="space-y-4">
                    <div
                      v-for="lesson in lessons"
                      :key="lesson.id"
                      class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition hover:shadow-md text-left"
                    >
                      <!-- Header -->
                      <div class="flex items-start justify-between mb-3">
                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                            <img
                              v-if="course?.teacher?.avatar_url"
                              :src="course?.teacher?.avatar_url"
                              alt="Author"
                              class="w-full h-full object-cover"
                            />
                            <span v-else>{{ (course?.teacher?.name || 'U').charAt(0).toUpperCase() }}</span>
                          </div>
                          <div class="text-left">
                            <h4 class="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                              {{ course?.teacher?.name || 'Teacher' }}
                            </h4>
                            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {{ formatDate(lesson.created_at) }}
                            </p>
                          </div>
                        </div>

                        <div class="flex items-center gap-1">
                          <button
                            @click="openEditLessonModal(lesson)"
                            class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition cursor-pointer"
                            title="Edit"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            @click="openDeleteLessonModal(lesson)"
                            class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-red-600 transition cursor-pointer"
                            title="Delete"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <p class="text-sm text-slate-800 dark:text-slate-200 mb-3 font-normal text-left">
                        {{ lesson.title }}
                      </p>

                      <!-- CHAPTER CONTENT (text units — Markdown / LaTeX) -->
                      <router-link
                        :to="{ name: 'Lesson', params: { lessonId: lesson.id } }"
                        class="inline-flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 text-[#006A3A] dark:text-emerald-400 border border-emerald-200 dark:border-slate-700 text-xs font-bold transition active:scale-95"
                      >
                        📖 Open chapter &amp; units
                      </router-link>

                      <!-- ATTACHED MATERIALS & QUIZ SECTION -->
                      <div class="flex flex-wrap items-center gap-3">
                        <!-- Video Preview Card -->
                        <div
                          v-if="lesson.video_url"
                          class="flex items-start max-w-md w-full border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group"
                          @click="watchVideo(lesson)"
                        >
                          <div class="flex-1 p-4 bg-white dark:bg-slate-900 min-w-0 text-left">
                            <h5 class="text-sm font-semibold text-slate-900 dark:text-white underline decoration-slate-400 group-hover:decoration-emerald-600 truncate">
                              {{ lesson.title }} — Video
                            </h5>
                            <span class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase mt-1 flex items-center gap-1">
                              <svg class="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              Click to Watch
                              <template v-if="lesson.duration_seconds">
                                · {{ Math.floor(lesson.duration_seconds / 60) }}:{{ String(lesson.duration_seconds % 60).padStart(2, '0') }}
                              </template>
                            </span>
                            <button
                              type="button"
                              class="mt-2 text-xs text-red-600 hover:underline disabled:opacity-50"
                              :disabled="removingVideoId === lesson.id"
                              @click.stop="removeLessonVideo(lesson)"
                            >
                              {{ removingVideoId === lesson.id ? 'Removing…' : 'Remove video' }}
                            </button>
                          </div>
                          <div class="w-32 h-20 bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
                            <span class="text-2xl">🎬</span>
                          </div>
                        </div>

                        <!-- QUIZ ACTION/STATUS INSIDE LESSON CARD -->
                        <div class="w-full pt-4 mt-2 border-t border-slate-100 dark:border-slate-800/60">
                          <QuizListView
                            :course-id="route.params.id"
                            :lesson-id="lesson.id"
                            :initial-quizzes="lesson.quizzes || []"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- QUIZZES TAB -->
                <div v-else-if="activeTab === 'quizzes'" class="space-y-4">
                  <div v-if="allQuizzes.length === 0" class="text-center py-10 text-slate-500">
                    <p class="text-sm">No quizzes created yet for this course.</p>
                  </div>
                  <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      v-for="quiz in allQuizzes"
                      :key="quiz.id"
                      class="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs text-left space-y-2"
                    >
                      <div class="flex justify-between items-start">
                        <h4 class="font-bold text-slate-900 dark:text-white text-base">{{ quiz.title }}</h4>
                        <span
                          :class="[
                            'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                            quiz.status === 'published'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          ]"
                        >
                          {{ quiz.status || 'draft' }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-500 dark:text-slate-400">
                        Lesson: {{ quiz.lesson_title || 'Untitled Lesson' }}
                      </p>
                      <div class="text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span>❓ {{ quiz.total_questions ?? 0 }} questions</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- ASSIGNMENTS TAB -->
                <div v-else-if="activeTab === 'assignments'" class="space-y-3">
                  <div
                    v-if="assignments.length === 0"
                    class="w-full border-2 border-dashed border-slate-200/80 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900/30 p-8 text-center shadow-xs"
                  >
                    <div class="w-12 h-12 rounded-full bg-emerald-100 dark:bg-slate-800 text-[#006A3A] dark:text-emerald-400 flex items-center justify-center text-xl mb-3 mx-auto">📋</div>
                    <h3 class="text-base font-bold text-slate-900 dark:text-white">No assignments yet</h3>
                    <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">Create one for students to submit work.</p>
                  </div>

                  <div
                    v-for="a in assignments"
                    :key="a.id"
                    class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition text-left"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-center gap-2 flex-wrap min-w-0">
                        <h4 class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ a.title }}</h4>
                        <span
                          :class="[
                            'shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase',
                            a.type === 'quiz'
                              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                              : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                          ]"
                        >
                          {{ a.type === 'quiz' ? 'Quiz' : 'Homework' }}
                        </span>
                      </div>
                      <span
                        v-if="formatDue(a.due_date)"
                        :class="[
                          'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold',
                          isOverdue(a.due_date)
                            ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                        ]"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        {{ isOverdue(a.due_date) ? 'Was due' : 'Due' }} {{ formatDue(a.due_date) }}
                      </span>
                      <span v-else class="shrink-0 text-[11px] font-medium text-slate-400">No due date</span>
                    </div>

                    <p v-if="a.description" class="mt-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{{ a.description }}</p>

                    <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span class="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span
                          class="w-2 h-2 rounded-full shrink-0"
                          :class="a.status === 'published' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'"
                        ></span>
                        {{ a.status === 'published' ? 'Published' : 'Draft' }}
                      </span>
                      <div class="flex items-center gap-3 text-xs font-bold">
                        <button
                          type="button"
                          class="text-[#006A3A] dark:text-emerald-400 hover:underline"
                          @click="goToEditAssignment(a.id)"
                        >
                          Edit
                        </button>
                        <button
                          v-if="a.type === 'quiz'"
                          type="button"
                          class="text-[#006A3A] dark:text-emerald-400 hover:underline"
                          @click="openRoster(a.id)"
                        >
                          View submissions
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- STUDENTS TAB -->
<<<<<<< HEAD
                <div v-else-if="activeTab === 'students'" class="space-y-3">
                  <div v-if="enrolledStudents.length === 0" class="text-center py-10 text-slate-500">
                    <p class="text-sm">No students enrolled yet</p>
                  </div>
                  <div v-else>
                    <div
                      v-for="student in enrolledStudents"
                      :key="student.id"
                      class="p-4 rounded-2xl bg-[#ffffff] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-slate-800 text-[#006A3A] dark:text-emerald-400 flex items-center justify-center text-sm font-bold">
                          {{ student.name?.charAt(0).toUpperCase() }}
                        </div>
                        <div class="text-left">
                          <p class="text-xs font-bold text-slate-900 dark:text-white">{{ student.name }}</p>
                          <p class="text-[11px] text-slate-600 dark:text-slate-400">{{ student.email }}</p>
                        </div>
                      </div>
                      <span
                        :class="[
                          'px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0',
                          student.paid
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        ]"
                      >
                        {{ student.paid ? 'Paid' : 'Unpaid' }}
                      </span>
                    </div>
                  </div>
                </div>
=======
                <CourseStudentsProgress
                  v-else-if="activeTab === 'students'"
                  :data="roster"
                  :loading="rosterLoading"
                  :error="rosterError"
                  @retry="fetchRoster()"
                />
>>>>>>> 88a824ea844814741f9bdeefcd286dc56158ce33

                <!-- SCHEDULE TAB -->
                <ClassScheduleCard
                  v-else-if="activeTab === 'schedule'"
                  :course-id="route.params.id"
                />
              </div>
            </div>
          </template>
        </div>
      </main>
    </div>
      <UploadLessonModal
        v-if="showUploadModal"
        :uploading="uploading"
        :error="uploadError"
        :video-progress="videoProgress"
        @close="closeUploadModal"
        @upload="handleUpload"
      />
      <!-- ASSIGNMENT SUBMISSIONS / SCORES ROSTER (quiz-type only) -->
      <AssignmentRosterView
        v-if="rosterAssignmentId"
        :assignment-id="rosterAssignmentId"
        @close="closeRoster"
      />
      <!-- EDIT LESSON MODAL -->
      <EditLessonModal
        v-if="showEditLessonModal"
        :lesson="lessonToEdit"
        :saving="editingLesson"
        :error="editLessonError"
        :video-progress="videoProgress"
        @close="closeEditLessonModal"
        @save="handleEditLesson"
      />
      <!-- DELETE LESSON MODAL -->
      <ConfirmModal
        v-if="showDeleteLessonModal"
        title="Delete this lesson?"
        :message="`This will permanently delete '${lessonToDelete?.title}', its units, and any video. This action cannot be undone.`"
        confirm-label="Delete Lesson"
        :loading="deletingLesson"
        :error="deleteLessonError"
        @close="closeDeleteLessonModal"
        @confirm="deleteLesson"
      />
      <!-- DELETE CLASS MODAL -->
      <ConfirmModal
        v-if="showDeleteModal"
        title="Delete this class?"
        :message="`This will permanently delete '${course?.title}' and all of its lessons, quizzes, and student data. This action cannot be undone.`"
        confirm-label="Delete Class"
        :loading="deletingCourse"
        :error="deleteError"
        @close="closeDeleteModal"
        @confirm="handleDeleteCourse"
      />
    <!-- CUSTOMIZE APPEARANCE MODAL -->
    <div 
      v-if="showCustomizeModal" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      @click.self="closeCustomizeModal"
    >
      <div class="w-full max-w-xl rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-2xl transition-all">
        <h2 class="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white mb-5 text-left">
          Customize appearance
        </h2>

        <div 
          class="relative w-full h-36 rounded-2xl overflow-hidden mb-6 shadow-sm transition-all border border-slate-200 dark:border-slate-800"
          :style="{ backgroundColor: formColor }"
        >
          <img 
            v-if="formCoverImage" 
            :src="formCoverImage" 
            class="w-full h-full object-cover" 
            alt="Header preview" 
          />
        </div>

        <div class="flex items-center justify-between mb-8">
          <span class="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-300">
            Select stream header image
          </span>

          <div class="flex items-center gap-2">
            <button 
              @click="triggerCoverImageSelect" 
              class="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-200/60 hover:bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              Select photo
            </button>
            <input 
              type="file" 
              ref="coverImageInputRef" 
              class="hidden" 
              accept="image/*" 
              @change="handleCoverImagePicked" 
            />
          </div>
        </div>

        <div class="space-y-3 mb-8 text-left">
          <label class="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-300">
            Select theme color
          </label>

          <div class="flex items-center justify-between gap-2 overflow-x-auto py-1">
            <button
              v-for="color in themeColors"
              :key="color.hex"
              @click="formColor = color.hex"
              :class="[
                'w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 transition-all flex items-center justify-center shrink-0 cursor-pointer',
                formColor === color.hex ? 'border-amber-600 scale-105 shadow-sm' : 'border-slate-300 dark:border-slate-700 hover:scale-105'
              ]"
              :style="{ backgroundColor: color.bgHex || color.hex }"
            >
              <svg 
                v-if="formColor === color.hex" 
                class="w-5 h-5 text-amber-800 dark:text-amber-900 stroke-[3]" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Access: Free / Paid -->
        <div class="flex items-center justify-between mb-8 text-left">
          <div>
            <span class="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-300">
              Free class
            </span>
            <span class="block text-[11px] text-slate-500 dark:text-slate-400">
              Students can enrol without payment
            </span>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="formIsFree"
            @click="formIsFree = !formIsFree"
            :class="[
              'relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer',
              formIsFree ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
            ]"
          >
            <span
              :class="[
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                formIsFree ? 'translate-x-5' : 'translate-x-0'
              ]"
            ></span>
          </button>
        </div>

        <p v-if="saveError" class="text-xs text-red-600 mb-4 text-left">
          {{ saveError }}
        </p>

        <div class="flex items-center justify-end gap-3">
          <button 
            @click="closeCustomizeModal" 
            :disabled="saving"
            class="px-5 py-2 rounded-full text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            @click="handleSaveCustomization" 
            :disabled="saving"
            class="px-5 py-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
            :class="{ '!text-emerald-700 dark:!text-emerald-400 font-bold': isDirty }"
          >
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
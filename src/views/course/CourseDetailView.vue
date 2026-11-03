<script setup>
import { ref, computed, onActivated, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import UploadLessonModal from '@/components/modals/UploadLessonModal.vue'
import EditLessonModal from '@/components/modals/EditLessonModal.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import AddStudentsModal from '@/components/modals/AddStudentsModal.vue'
import Header from '@/components/layout/Header.vue'
import Footer from '@/components/layout/Footer.vue'
import Breadcrumb from '@/components/layout/Breadcrumb.vue'
import AssignmentsPanel from '@/components/assignments/AssignmentsPanel.vue'
import ClassScheduleCard from '@/components/classes/ClassScheduleCard.vue'
import CourseStudentsProgress from '@/components/insights/CourseStudentsProgress.vue'
import BrandIcon from '@/components/ui/BrandIcon.vue'
import { useTheme } from '@/composables/useTheme.js'
import { formatDate, formatDateTime } from '@/utils/dateFormat'
import { authService } from '@/services/authService'

// Students read the course; authoring controls are for teachers/admins.
const canManage = authService.getCurrentUser()?.role !== 'student'
import { courseService } from '@/services/courseService'
import { lessonService } from '@/services/lessonService'
import { unitService } from '@/services/unitService'
import { assignmentService } from '@/services/assignmentService'
import { insightsService } from '@/services/insightsService'

defineOptions({ name: 'CourseDetailView' })

const route = useRoute()
const { isDark } = useTheme()
const lightSet = computed(() => (isDark.value ? 'darkmode-line' : 'line-light'))
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
const TAB_IDS = ['lessons', 'assignments', 'students', 'schedule']
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
  { id: 'lessons', name: 'Lessons', icon: 'lesson', tint: 'bg-emerald-50 dark:bg-slate-800', count: lessons.value.length },
  { id: 'assignments', name: 'Assignments', icon: 'assignment', tint: 'bg-emerald-50 dark:bg-slate-800', count: assignments.value.length },
  { id: 'students', name: 'Students', icon: 'class', tint: 'bg-emerald-50 dark:bg-slate-800', count: rosterCount.value },
  { id: 'schedule', name: 'Schedule', icon: 'study-time', tint: 'bg-emerald-50 dark:bg-slate-800' }
])

// ── Assignments ───────────────────────────────────────────────────────────
// Authoring (create/edit, draft/publish) happens on its own page — see
// AssignmentEditorView.vue — not in a dialog here.
const assignments = ref([])

// Results (who submitted, scores, per-question breakdown) are a full page.
const assignmentsLoading = ref(true)
const openResults = (assignmentId) => {
  router.push({ name: 'AssignmentResults', params: { courseId: route.params.id, id: assignmentId }, query: { courseTitle: course.value?.title } })
}

const fetchAssignments = async () => {
  try {
    assignments.value = await assignmentService.getCourseAssignments(route.params.id)
  } catch {
    /* non-fatal — the tab just shows empty */
  } finally {
    assignmentsLoading.value = false
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

const formatDue = (iso) => formatDateTime(iso) || null
const isOverdue = (iso) => iso && new Date(iso) < new Date()

// ── Students roster ───────────────────────────────────────────────────────
// Where every enrolled student is in this course (progress, XP, quizzes,
// activity). Staff-only on the API, so students never request it.
const roster = ref(null)
const rosterLoading = ref(false)
const rosterError = ref(null)
// undefined until the roster has loaded, so the tab badge stays hidden.
const rosterCount = computed(() => roster.value?.students?.length)

const showAddStudents = ref(false)
const onStudentsAdded = () => {
  showAddStudents.value = false
  fetchRoster({ silent: true })
}

const fetchRoster = async ({ silent = false } = {}) => {
  if (!['teacher', 'admin', 'super_admin'].includes(authService.getCurrentUser()?.role)) return
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

// ── Class header & lesson list helpers ──────────────────────────────────
const courseMenuOpen = ref(false)
const lessonMenuId = ref(null)
const closeMenus = () => { courseMenuOpen.value = false; lessonMenuId.value = null }
onMounted(() => document.addEventListener('click', closeMenus))
onBeforeUnmount(() => document.removeEventListener('click', closeMenus))

const editingDescription = ref(false)
const descriptionDraft = ref('')
const savingDescription = ref(false)
const startDescription = () => { descriptionDraft.value = course.value?.description || ''; editingDescription.value = true }
const saveDescription = async () => {
  savingDescription.value = true
  try {
    await courseService.updateCourse(route.params.id, { description: descriptionDraft.value.trim() })
    course.value = { ...course.value, description: descriptionDraft.value.trim() }
    editingDescription.value = false
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to save the description.'
  } finally {
    savingDescription.value = false
  }
}

const addQuizTo = (lesson) => {
  router.push({ name: 'CreateQuiz', params: { courseId: route.params.id }, query: { lessonId: lesson.id } })
}
// "4 units · 1 video · 1 h 12 min · updated 10/09"
const lessonMeta = (lesson) => {
  const parts = []
  const units = lesson.stats?.unit_count
  if (units !== undefined) parts.push(`${units} unit${units === 1 ? '' : 's'}`)
  if (lesson.has_video) parts.push('video')
  const sec = Number(lesson.duration_seconds) || 0
  if (sec > 0) parts.push(sec >= 3600 ? `${Math.floor(sec / 3600)} h ${Math.round((sec % 3600) / 60)} min` : `${Math.max(1, Math.round(sec / 60))} min`)
  const updated = formatDate(lesson.updated_at || lesson.created_at)
  if (updated) parts.push(`updated ${updated.slice(0, 5)}`)
  return parts.join(' · ')
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
      <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col">
      <main class="flex-1 p-6 sm:p-8 flex flex-col gap-6">
        <div class="w-full max-w-7xl mx-auto flex flex-col gap-6">
          <!-- BACK BUTTON -->
          <!-- LOADING STATE -->
          <div v-if="loading" class="text-center py-20 text-slate-600 dark:text-slate-400 font-medium">
            Loading course details...
          </div>

          <!-- ERROR STATE -->
          <div v-else-if="error" class="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm">
            {{ error }}
          </div>

          <template v-else-if="course">
            <!-- CLASS HEADER -->
            <header class="flex flex-wrap items-start justify-between gap-4">
              <div class="flex items-start gap-5 min-w-0">
                <div
                  class="w-[60px] h-[60px] shrink-0 rounded-2xl flex items-center justify-center shadow-[0_4px_0_rgba(0,0,0,0.25)]"
                  :style="{ backgroundColor: course.color || '#12804A' }"
                >
                  <BrandIcon name="lesson" set="line-dark" :size="34" />
                </div>
                <div class="min-w-0 space-y-2">
                  <h1 class="text-3xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-white">{{ course.title }}</h1>
                  <div class="flex items-center flex-wrap gap-x-3 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                    <span class="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300 text-[11px] font-bold uppercase tracking-wide">
                      {{ course.category || 'Class' }}
                    </span>
                    <span :class="['px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide', course.is_free ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300']">
                      {{ course.is_free ? 'Free' : 'Paid' }}
                    </span>
                    <span v-if="rosterCount !== undefined">{{ rosterCount }} student{{ rosterCount === 1 ? '' : 's' }}</span>
                    <span v-if="canManage && course.code">Join code <strong class="text-slate-900 dark:text-white tracking-wide">{{ course.code }}</strong></span>
                    <button
                      v-if="canManage && !course.description && !editingDescription"
                      type="button"
                      class="px-3 py-1 rounded-xl border border-dashed border-slate-300 dark:border-[#3A4A66] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      @click="startDescription"
                    >+ Add description</button>
                  </div>
                  <p v-if="course.description && !editingDescription" class="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
                    {{ course.description }}
                    <button v-if="canManage" type="button" class="ml-2 text-xs font-bold text-emerald-600 dark:text-emerald-300 hover:underline cursor-pointer" @click="startDescription">Edit</button>
                  </p>
                  <div v-if="editingDescription" class="flex flex-col gap-2 max-w-xl">
                    <textarea v-model="descriptionDraft" rows="3" class="px-3.5 py-2.5 rounded-xl text-sm bg-transparent border border-slate-300 dark:border-[#2E3D58]" placeholder="What is this class about?"></textarea>
                    <div class="flex gap-2">
                      <button type="button" class="px-4 py-1.5 rounded-xl bg-[#12804A] text-white text-xs font-bold cursor-pointer disabled:opacity-50" :disabled="savingDescription" @click="saveDescription">{{ savingDescription ? 'Saving…' : 'Save' }}</button>
                      <button type="button" class="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer" @click="editingDescription = false">Cancel</button>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="canManage" class="relative">
                <button
                  type="button"
                  aria-label="More class actions"
                  class="w-11 h-11 rounded-xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#172234] text-slate-600 dark:text-slate-200 text-lg leading-none hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  @click.stop="courseMenuOpen = !courseMenuOpen"
                >⋮</button>
                <div v-if="courseMenuOpen" class="absolute right-0 top-12 z-20 w-52 rounded-xl py-1 bg-white dark:bg-[#172234] border border-slate-200 dark:border-[#2E3D58] shadow-xl text-sm font-semibold">
                  <button class="row-menu-item" @click="courseMenuOpen = false; openCustomizeModal()">Customize class</button>
                  <button class="row-menu-item row-menu-danger" @click="courseMenuOpen = false; openDeleteModal()">Delete class…</button>
                </div>
              </div>
            </header>

            <!-- TABS -->
            <div role="tablist" aria-label="Class sections" class="flex flex-wrap gap-1 border-b border-slate-200 dark:border-[#1C2840]">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                type="button"
                role="tab"
                :aria-selected="activeTab === tab.id"
                @click="activeTab = tab.id"
                :class="[
                  'min-h-[44px] px-4 border-b-2 text-sm whitespace-nowrap transition cursor-pointer -mb-px',
                  activeTab === tab.id
                    ? 'border-emerald-500 text-slate-900 dark:text-white font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold'
                ]"
              >
                {{ tab.name }}
                <span
                  v-if="tab.count !== undefined"
                  :class="['ml-1', activeTab === tab.id ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-400']"
                >{{ tab.count }}</span>
              </button>
            </div>

            <!-- MAIN CONTENT LAYOUT -->
            <div class="pb-12">
              <!-- TAB CONTENT -->
              <div class="space-y-6 min-w-0">
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
                      {{ canManage ? 'Upload your first lesson to get started' : 'Lessons will appear here once your teacher adds them' }}
                    </p>
                    <button 
                      v-if="canManage"
                      @click="openUploadModal"
                      class="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 transition shadow-sm cursor-pointer active:scale-95"
                    >
                      Upload Lesson
                    </button>
                  </div>

                  <!-- LESSON LIST -->
                  <div v-else class="space-y-4">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <p class="text-sm text-slate-500 dark:text-slate-400">
                        {{ lessons.length }} lesson{{ lessons.length === 1 ? '' : 's' }} · shown to students in this order
                      </p>
                      <button
                        v-if="canManage"
                        @click="openUploadModal"
                        class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#12804A] hover:bg-[#0f7a45] text-white font-bold text-sm transition cursor-pointer shadow-[0_3px_0_#0A5C34]"
                      >
                        <span class="text-base font-normal leading-none">+</span> Upload lesson
                      </button>
                    </div>

                    <div class="rounded-2xl border border-slate-200/80 dark:border-[#22304A] bg-white dark:bg-[#111A28] divide-y divide-slate-100 dark:divide-[#1C2840]">
                      <div
                        v-for="(lesson, i) in lessons"
                        :key="lesson.id"
                        class="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 text-left"
                      >
                        <div class="flex items-center gap-4 flex-[999_1_340px] min-w-0">
                          <span class="w-10 h-10 shrink-0 rounded-full border-2 border-emerald-500 text-emerald-600 dark:text-emerald-300 font-bold flex items-center justify-center">{{ i + 1 }}</span>
                          <div class="min-w-0 space-y-1">
                            <div class="flex items-center flex-wrap gap-2.5">
                              <h4 class="text-lg font-bold text-slate-900 dark:text-white leading-snug">{{ lesson.title }}</h4>
                              <span v-if="lesson.completed" class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">Done</span>
                              <span v-else-if="canManage" class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">Published</span>
                            </div>
                            <p class="text-xs text-slate-500 dark:text-slate-400">{{ lessonMeta(lesson) }}</p>
                          </div>
                        </div>

                        <div v-if="canManage && lesson.stats" class="w-44 shrink-0">
                          <p class="text-xs text-slate-500 dark:text-slate-400"><strong class="text-slate-900 dark:text-white">{{ lesson.stats.finished_percent }}%</strong> of students finished</p>
                          <div class="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-[#1F2C42] overflow-hidden">
                            <div class="h-full rounded-full bg-emerald-500" :style="{ width: lesson.stats.finished_percent + '%' }"></div>
                          </div>
                        </div>

                        <div class="flex items-center gap-2 shrink-0">
                          <router-link
                            :to="{ name: 'Lesson', params: { lessonId: lesson.id } }"
                            class="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E3D58] text-sm font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                          >Open units</router-link>
                          <div v-if="canManage" class="relative">
                            <button
                              type="button"
                              aria-label="More lesson actions"
                              class="w-11 h-11 rounded-xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#172234] text-slate-600 dark:text-slate-200 text-lg leading-none hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                              @click.stop="lessonMenuId = lessonMenuId === lesson.id ? null : lesson.id"
                            >⋮</button>
                            <div v-if="lessonMenuId === lesson.id" class="absolute right-0 top-12 z-20 w-52 rounded-xl py-1 bg-white dark:bg-[#172234] border border-slate-200 dark:border-[#2E3D58] shadow-xl text-sm font-semibold">
                              <button class="row-menu-item" @click="lessonMenuId = null; openEditLessonModal(lesson)">Edit lesson</button>
                              <button class="row-menu-item" @click="lessonMenuId = null; addQuizTo(lesson)">Add quiz</button>
                              <button v-if="lesson.video_url" class="row-menu-item" @click="lessonMenuId = null; watchVideo(lesson)">Watch video</button>
                              <button v-if="lesson.video_url" class="row-menu-item" @click="lessonMenuId = null; removeLessonVideo(lesson)">Remove video</button>
                              <div class="my-1 border-t border-slate-100 dark:border-[#2E3D58]"></div>
                              <button class="row-menu-item row-menu-danger" @click="lessonMenuId = null; openDeleteLessonModal(lesson)">Delete…</button>
                            </div>
                          </div>
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
                        <span class="inline-flex items-center gap-1"><BrandIcon name="quiz" :set="lightSet" :size="14" /> {{ quiz.total_questions ?? 0 }} questions</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- ASSIGNMENTS TAB -->
                <AssignmentsPanel
                  v-else-if="activeTab === 'assignments'"
                  :assignments="assignments"
                  :loading="assignmentsLoading"
                  :course-id="String(route.params.id)"
                  :can-manage="canManage"
                  @create="goToCreateAssignment"
                  @edit="goToEditAssignment"
                  @results="openResults"
                  @changed="fetchAssignments"
                />

                <!-- STUDENTS TAB -->
                <div v-else-if="activeTab === 'students'" class="space-y-4">
                  <div class="flex items-center justify-between gap-3">
                    <p class="text-sm text-slate-500 dark:text-slate-400">
                      Only students in this class get its live-class notifications.
                    </p>
                    <button
                      type="button"
                      @click="showAddStudents = true"
                      class="shrink-0 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition cursor-pointer"
                    >+ Add students</button>
                  </div>
                  <CourseStudentsProgress
                    :data="roster"
                    :loading="rosterLoading"
                    :error="rosterError"
                    @retry="fetchRoster()"
                  />
                </div>

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
      <Footer />
      </div>
    </div>
      <UploadLessonModal
        v-if="showUploadModal"
        :uploading="uploading"
        :error="uploadError"
        :video-progress="videoProgress"
        @close="closeUploadModal"
        @upload="handleUpload"
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
      <AddStudentsModal
        v-if="showAddStudents"
        :course-id="route.params.id"
        @close="showAddStudents = false"
        @added="onStudentsAdded"
      />

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

<style scoped>
.row-menu-item { display: block; width: 100%; text-align: left; padding: 0.55rem 0.9rem; cursor: pointer; color: rgb(51 65 85); }
.row-menu-item:hover { background: rgb(241 245 249); }
.row-menu-danger { color: rgb(185 28 28); }
:global(.dark) .row-menu-item { color: rgb(226 232 240); }
:global(.dark) .row-menu-item:hover { background: rgb(30 41 59); }
:global(.dark) .row-menu-danger { color: #FCA5A5; }
</style>

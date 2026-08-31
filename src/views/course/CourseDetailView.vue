<script setup>
import { ref, computed, onActivated, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import PdfViewerModal from '@/components/modals/PdfViewerModal.vue'
import UploadLessonModal from '@/components/modals/UploadLessonModal.vue'
import EditLessonModal from '@/components/modals/EditLessonModal.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import Header from '@/components/layout/Header.vue'
import QuizListView from '@/views/course/QuizListView.vue'
import { courseService } from '@/services/courseService'
import { lessonService } from '@/services/lessonService'

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
const enrolledStudents = ref([])
const loading = ref(true)
const error = ref(null)
const activeTab = ref('lessons')

// PDF Viewer Modal States
const showPdfModal = ref(false)
const selectedPdf = ref(null)

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
const formColor = ref('#033B26')
const formCoverImage = ref(null)
const formIsFree = ref(false)
const saving = ref(false)
const saveError = ref(null)
const coverImageInputRef = ref(null)

const themeColors = [
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
  { id: 'lessons', name: 'Lessons', icon: '📖', count: lessons.value.length },
  { id: 'quizzes', name: 'Quizzes', icon: '❓', count: allQuizzes.value.length },
  { id: 'assignments', name: 'Assignments', icon: '📋', count: 0 },
  { id: 'students', name: 'Students', icon: '👥', count: enrolledStudents.value.length }
])




// Modal Handlers in parent component
const handleUpload = async ({ title, description, orderNumber, file, videoFile }) => {
  uploading.value = true
  uploadError.value = null
  videoProgress.value = null
  try {
    // Step 1: create the lesson (with the inline doc/PDF if one was picked).
    const res = await lessonService.createLesson(route.params.id, title, description, file, orderNumber)
    let newLesson = res.data?.lesson || res

    // Step 2: if a video was picked, upload it straight to storage against
    // the lesson we just created, then merge the returned video_url.
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

// PDF View Handlers
const viewPdf = (lesson) => {
  if (lesson.file_url) {
    selectedPdf.value = lesson
    showPdfModal.value = true
  }
}

const closePdfModal = () => {
  showPdfModal.value = false
  selectedPdf.value = null
}

const downloadLesson = (lesson) => {
  if (lesson?.file_url) {
    window.open(lesson.file_url, '_blank')
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

const handleEditLesson = async ({ title, description, orderNumber, docFile, removeDoc, videoFile, removeVideo }) => {
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
    // The PUT response returns storage paths (not public URLs) for file_url /
    // video_url, so only take the plain text fields from it and let the media
    // endpoints below supply the correct URLs.
    let merged = { title, description, order_number: orderNumber }

    if (removeDoc) {
      await lessonService.deleteLessonFile(lessonId)
      merged = { ...merged, file_url: null, file_type: null, total_pages: 0 }
    } else if (docFile) {
      const r = await lessonService.replaceLessonFile(lessonId, docFile)
      const l = r.data?.lesson || {}
      merged = { ...merged, file_url: l.file_url, file_type: l.file_type, total_pages: l.total_pages }
    }

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
  fetchCourseDetails({ silent: true })
})

// Customize Modal Handlers
const openCustomizeModal = () => {
  if (!course.value) return
  formColor.value = course.value.color || '#033B26'
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
  }
})
</script>

<template>
  <div class="flex h-screen bg-[#f8fafd] dark:bg-slate-950 overflow-hidden transition-colors">
    <!-- Sidebar (Fixed Height, Non-Scrolling) -->
    <Sidebar class="hidden md:flex shrink-0 h-full" />

    <!-- Right Side Container -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Header (Fixed at top) -->
      <Header class="shrink-0" />

      <!-- Scrollable Content Area -->
      <main class="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 flex flex-col gap-6">
        <div class="w-full max-w-7xl mx-auto flex flex-col gap-6">
          <!-- BACK BUTTON -->
          <div class="flex items-center">
            <button 
              @click="goBack" 
              class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#f8fafd] dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 text-xs font-bold border border-slate-200/80 dark:border-slate-800 shadow-xs transition active:scale-95 cursor-pointer group"
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
                backgroundColor: course.color || '#033B26',
                backgroundImage: course.cover_image ? `url(${course.cover_image})` : 'none'
              }"
            >
              <div class="relative z-10 flex justify-between items-start">
                <div class="space-y-3 max-w-2xl">
                  <!-- Tags & Code -->
                  <div class="flex items-center gap-3">
                    <span class="px-3 py-1 rounded-lg bg-black/30 text-white text-xs font-bold uppercase tracking-wide border border-white/20 backdrop-blur-sm">
                      {{ course.category || course.code || 'COURSE' }}
                    </span>
                    <span class="px-3 py-1 rounded-lg bg-black/30 text-white text-xs font-bold uppercase tracking-wide border border-white/20 backdrop-blur-sm">
                      {{ course.is_free ? '🎁 Free' : '💳 Paid' }}
                    </span>
                    <span class="flex items-center gap-1.5 text-xs font-medium text-white/90 drop-shadow">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                      </svg>
                      {{ enrolledStudents.length }} Students
                    </span>
                  </div>

                  <!-- Title & Description -->
                  <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight drop-shadow-md text-white">
                    {{ course.title }}
                  </h1>
                  <p class="text-sm text-white/90 leading-relaxed max-w-xl drop-shadow">
                    {{ course.description || 'No description provided for this course.' }}
                  </p>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    @click="openCustomizeModal"
                    class="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-md border border-white/30 transition cursor-pointer shadow-sm active:scale-95"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Customize
                  </button>

                  <!-- Delete Class Button -->
                  <button
                    @click="openDeleteModal"
                    class="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 hover:bg-red-600/80 text-white text-xs font-semibold backdrop-blur-md border border-white/30 transition cursor-pointer shadow-sm active:scale-95"
                    aria-label="Delete class"
                    title="Delete class"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div class="absolute inset-0 bg-black/20 z-0 pointer-events-none"></div>
            </div>

            <!-- ACTION BUTTON -->
            <div class="flex justify-end">
              <button 
                @click="openUploadModal"
                class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#033B26] hover:bg-[#022819] text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-95"
              >
                <span class="text-base font-normal">+</span>
                Upload Lesson
              </button>
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
                    'w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer',
                    activeTab === tab.id
                      ? 'bg-[#033B26] text-white shadow-sm'
                      : 'text-slate-700 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-slate-800'
                  ]"
                >
                  <div class="flex items-center gap-3">
                    <span class="text-base">{{ tab.icon }}</span>
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
              <div class="lg:col-span-3 space-y-6">
                <!-- LESSONS TAB -->
                <div v-if="activeTab === 'lessons'">
                  <div v-if="lessons.length === 0" class="w-full border-2 border-dashed border-slate-200/80 dark:border-slate-800 rounded-3xl bg-[#ffffff] dark:bg-slate-900/30 p-8 flex flex-col items-center justify-center text-center shadow-xs">
                    <div class="w-12 h-12 rounded-full bg-emerald-100 dark:bg-slate-800 text-[#033B26] dark:text-emerald-400 flex items-center justify-center text-xl mb-3">
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
                            v-if="lesson.file_url"
                            @click="downloadLesson(lesson)"
                            class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
                            title="Download File"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                            </svg>
                          </button>
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

                      <p class="text-sm text-slate-800 dark:text-slate-200 mb-4 font-normal text-left">
                        {{ lesson.title }}
                      </p>

                      <!-- ATTACHED MATERIALS & QUIZ SECTION -->
                      <div class="flex flex-wrap items-center gap-3">
                        <!-- PDF Preview Card -->
                        <div 
                          v-if="lesson.file_url"
                          @click="viewPdf(lesson)"
                          class="flex items-start max-w-md w-full border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group"
                        >
                          <div class="flex-1 p-4 bg-white dark:bg-slate-900 min-w-0 text-left">
                            <h5 class="text-sm font-semibold text-slate-900 dark:text-white underline decoration-slate-400 group-hover:decoration-emerald-600 truncate">
                              {{ lesson.file_name || `${lesson.title}.pdf` }}
                            </h5>
                            <span class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase mt-1 flex items-center gap-1">
                              <svg class="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                              </svg>
                              Click to View PDF
                            </span>
                          </div>
                          <div class="w-32 h-20 bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                            <img 
                              v-if="lesson.thumbnail_url" 
                              :src="lesson.thumbnail_url" 
                              alt="Preview" 
                              class="w-full h-full object-cover" 
                            />
                            <div v-else class="text-center p-2">
                              <span class="text-2xl">📄</span>
                            </div>
                          </div>
                        </div>

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
                <div v-else-if="activeTab === 'assignments'" class="text-center py-10 text-slate-500">
                  <p class="text-sm">Assignments coming soon...</p>
                </div>

                <!-- STUDENTS TAB -->
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
                        <div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-slate-800 text-[#033B26] dark:text-emerald-400 flex items-center justify-center text-sm font-bold">
                          {{ student.name?.charAt(0).toUpperCase() }}
                        </div>
                        <div class="text-left">
                          <p class="text-xs font-bold text-slate-900 dark:text-white">{{ student.name }}</p>
                          <p class="text-[11px] text-slate-600 dark:text-slate-400">{{ student.email }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </main>
    </div>
      <PdfViewerModal 
          v-if="showPdfModal" 
          :pdf="selectedPdf" 
          @close="closePdfModal" 
          @download="downloadLesson"
        />
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
      <ConfirmModal
        v-if="showDeleteLessonModal"
        title="Delete this lesson?"
        :message="`This will permanently delete '${lessonToDelete?.title}' and its attached file. This action cannot be undone.`"
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
      <div class="w-full max-w-xl rounded-[32px] bg-[#f8fafd] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-2xl transition-all">
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
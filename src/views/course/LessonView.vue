<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'
import Footer from '@/components/layout/Footer.vue'
import MarkdownContent from '@/components/ui/MarkdownContent.vue'
import UnitEditForm from '@/components/units/UnitEditForm.vue'
import UnitPractice from '@/components/units/UnitPractice.vue'
import UnitQuizEditor from '@/components/units/UnitQuizEditor.vue'
import CurriculumSidebar from '@/components/units/CurriculumSidebar.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import { unitService } from '@/services/unitService'
import { lessonService } from '@/services/lessonService'
import { authService } from '@/services/authService'
import { quizService } from '@/services/quizService'
import MathText from '@/components/ui/MathText.vue'
import { formatDate } from '@/utils/dateFormat'

defineOptions({ name: 'LessonView' })

const route = useRoute()
const router = useRouter()

const lessonId = computed(() => route.params.lessonId)
const currentUser = authService.getCurrentUser()
// Teachers, admins and super admins all get the edit controls (the API lets
// admins edit any course; teachers only their own).
const isStaff = ['teacher', 'admin', 'super_admin'].includes(currentUser?.role)
// "Preview as student" hides the edit controls so a teacher sees the reader as
// a student does (the page content is the same; only the controls change).
const previewAsStudent = ref(false)
const isTeacher = computed(() => isStaff && !previewAsStudent.value)

const chapter = ref(null)
const courseAccess = ref(false)
const units = ref([])
const loading = ref(true)
const error = ref(null)

const selectedId = ref(null)
const selected = computed(() => units.value.find((u) => u.id === selectedId.value) || null)

// A unit can have a lesson video, a practice video, both or neither. When there are two,
// the reader gets a switcher; with one it just plays; with none nothing shows.
const unitVideos = computed(() => {
  const u = selected.value
  if (!u) return []
  return [
    { kind: 'lesson', label: 'Lesson video', url: u.video_url },
    { kind: 'practice', label: 'Practice video', url: u.practice_video_url }
  ].filter((v) => v.url)
})
const activeVideoKind = ref('lesson')
const activeVideo = computed(() => unitVideos.value.find((v) => v.kind === activeVideoKind.value) || unitVideos.value[0] || null)
watch(selectedId, () => { activeVideoKind.value = 'lesson' })

const unitIndex = computed(() => units.value.findIndex((u) => u.id === selectedId.value))
const durationLabel = (sec) => {
  const n = Number(sec) || 0
  return n > 0 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : ''
}
const unitMeta = computed(() => {
  const u = selected.value
  if (!u) return ''
  const parts = [`Unit ${unitIndex.value + 1} of ${units.value.length}`]
  if (u.video_url) parts.push(`video ${durationLabel(u.duration_seconds)}`.trim())
  if (isStaff && u.question_count) parts.push(`${u.question_count} practice questions`)
  const edited = formatDate(u.updated_at)
  if (edited) parts.push(`edited ${edited.slice(0, 5)}`)
  return parts.join(' · ')
})

const menuOpen = ref(false)
const closeMenu = () => { menuOpen.value = false }
onMounted(() => document.addEventListener('click', closeMenu))
onBeforeUnmount(() => document.removeEventListener('click', closeMenu))

// Student results tab: loaded when opened, again when the unit changes.
const stats = ref(null)
const statsLoading = ref(false)
const statsError = ref('')
const loadStats = async () => {
  if (!selectedId.value) return
  statsLoading.value = true
  statsError.value = ''
  try {
    stats.value = await quizService.getUnitQuizStats(selectedId.value)
  } catch (err) {
    stats.value = null
    statsError.value = err.response?.data?.error || err.message || 'Could not load the results.'
  } finally {
    statsLoading.value = false
  }
}

// Ref onto the curriculum sidebar so an inline edit/delete here (below) can
// tell it its own cached list for this chapter is stale — otherwise the
// sidebar keeps showing the old title / the deleted unit until a full reload.
const curriculumSidebarRef = ref(null)

// Teacher-only tabs for the selected unit. A student never sees these — they
// just read the unit and, below it, take the practice quiz (see UnitPractice).
const tabs = computed(() => [
  { id: 'theory', label: 'Content' },
  { id: 'quiz', label: 'Practice quiz', count: selected.value?.question_count ?? undefined },
  { id: 'results', label: 'Student results' },
])
const activeTab = ref('theory')
watch([activeTab, selectedId], ([tab]) => { if (tab === 'results') loadStats() })
// Inline "Edit" for the currently selected unit's theory content — lets a
// teacher fix a typo or rewrite a unit right from the reader, without going
// into Manage units. Uses the same UnitEditForm as that screen.
const editingContent = ref(false)

const markingComplete = ref(false)
const completed = ref(false)

const load = async ({ silent = false } = {}) => {
  if (!silent) {
    loading.value = true
    error.value = null
  }
  try {
    const res = await unitService.listUnits(lessonId.value)
    chapter.value = res.data?.chapter || null
    courseAccess.value = !!res.data?.course_access
    units.value = res.data?.units || []
    // A cross-chapter jump from the curriculum sidebar carries ?unit=<id> so
    // landing here selects that specific unit instead of defaulting to the first.
    const requested = typeof route.query.unit === 'string' ? route.query.unit : null
    if (requested && units.value.some((u) => u.id === requested)) {
      selectedId.value = requested
    } else if (!selectedId.value || !units.value.some((u) => u.id === selectedId.value)) {
      selectedId.value = units.value[0]?.id || null
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to load chapter'
  } finally {
    loading.value = false
  }
}

const selectUnit = async (u) => {
  selectedId.value = u.id
  activeTab.value = 'theory'
  editingContent.value = false
  // The list response already carries `content` for unlocked units; only
  // fetch the single unit if we somehow don't have it yet.
  if (u.content == null && !u.locked) {
    try {
      const res = await unitService.getUnit(u.id)
      const full = res.data?.unit
      if (full) {
        const i = units.value.findIndex((x) => x.id === u.id)
        if (i !== -1) units.value[i] = { ...units.value[i], content: full.content }
      }
    } catch { /* leave the preview showing */ }
  }
}

// The inline theory-content editor saved — patch the unit in place (no full
// reload needed) and drop back to reading it.
const onContentSaved = (updatedUnit) => {
  if (updatedUnit) {
    const i = units.value.findIndex((x) => x.id === updatedUnit.id)
    if (i !== -1) units.value[i] = { ...units.value[i], ...updatedUnit }
  }
  editingContent.value = false
  curriculumSidebarRef.value?.refreshChapter(lessonId.value)
}

// Delete right from the page — no detour through a separate "manage" mode.
const deletingUnit = ref(false)
const showDeleteUnitModal = ref(false)
const deleteUnitError = ref('')
const askDeleteUnit = () => {
  if (!selected.value) return
  deleteUnitError.value = ''
  showDeleteUnitModal.value = true
}
const closeDeleteUnitModal = () => {
  if (deletingUnit.value) return
  showDeleteUnitModal.value = false
}
const confirmDeleteUnit = async () => {
  deletingUnit.value = true
  deleteUnitError.value = ''
  try {
    await unitService.deleteUnit(selected.value.id)
    selectedId.value = null
    showDeleteUnitModal.value = false
    await load({ silent: true })
    curriculumSidebarRef.value?.refreshChapter(lessonId.value)
  } catch (err) {
    deleteUnitError.value = err.response?.data?.error || err.message || 'Failed to delete unit'
  } finally {
    deletingUnit.value = false
  }
}

// A unit picked in the curriculum sidebar that belongs to a DIFFERENT
// chapter than the one open here — navigate there and pass which unit to
// land on (see the `requested` handling in load()).
const goToChapter = ({ chapterId, unitId }) => {
  router.push({ path: `/lessons/${chapterId}`, query: unitId ? { unit: unitId } : {} })
}

// A unit added inline from the curriculum sidebar (see CurriculumSidebar's
// "+ Add Unit") — if it landed in the chapter open here, refresh this
// page's own unit list and jump straight to the new unit.
const onUnitAdded = ({ chapterId, unit }) => {
  if (chapterId !== lessonId.value) return
  if (unit) selectedId.value = unit.id
  load({ silent: true })
}

// The sidebar's units changed structurally (reorder, bulk import) — refresh
// this page's own list if it's the chapter currently open, without
// disturbing which unit is selected.
const onCurriculumChange = ({ chapterId }) => {
  if (chapterId !== lessonId.value) return
  load({ silent: true })
}

// A whole new chapter was created from the "+ Add Chapter" button in the
// sidebar — jump straight there instead of leaving it buried in the list.
const onChapterAdded = ({ chapter }) => {
  if (chapter?.id) router.push({ path: `/lessons/${chapter.id}` })
}

const markComplete = async () => {
  markingComplete.value = true
  try {
    await lessonService.markLessonComplete(lessonId.value)
    completed.value = true
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to mark complete'
  } finally {
    markingComplete.value = false
  }
}

const goBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/')
}

// "Last edited: 5 mins ago" for the selected unit — the closest real
// timestamp we have to a per-unit edit history.
const lastEditedLabel = computed(() => {
  const ts = selected.value?.updated_at
  if (!ts) return null
  const minutes = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
})

watch(lessonId, () => {
  selectedId.value = null
  load()
})
onMounted(load)
</script>

<template>
  <div class="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors">
    <Sidebar class="hidden md:flex shrink-0 h-full" />

    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <Header class="shrink-0">
        <template #left>
          <nav class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
            <button type="button" @click="goBack" class="font-bold hover:underline">My Classes</button>
            <span>/</span>
            <span class="font-semibold text-slate-600 dark:text-slate-300">{{ chapter?.course?.title || 'Course' }}</span>
            <span>/</span>
            <span class="font-semibold text-slate-800 dark:text-slate-100">{{ chapter?.title || 'Chapter' }}</span>
          </nav>
        </template>
      </Header>

      <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col">
      <main class="flex-1 p-6 sm:p-8">
        <div class="w-full max-w-[1400px] mx-auto flex flex-col gap-6">
          <div v-if="loading" class="text-center py-20 text-slate-500 dark:text-slate-400 font-medium">
            Loading chapter…
          </div>
          <div v-else-if="error" class="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm">{{ error }}</div>

          <template v-else>
            <div class="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
              <CurriculumSidebar
                ref="curriculumSidebarRef"
                :course-id="chapter?.course?.id"
                :active-chapter-id="lessonId"
                :active-unit-id="selectedId"
                :is-teacher="isTeacher"
                @select-unit="selectUnit"
                @navigate-chapter="goToChapter"
                @unit-added="onUnitAdded"
                @change="onCurriculumChange"
                @chapter-added="onChapterAdded"
              />

              <section class="min-w-0 flex flex-col gap-5">
                <template v-if="selected">
                  <!-- Unit header -->
                  <header class="flex flex-wrap items-start justify-between gap-4">
                    <div class="min-w-0 space-y-1.5">
                      <div class="flex items-center flex-wrap gap-3">
                        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-snug">{{ selected.title }}</h1>
                        <span v-if="isStaff" class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">Published</span>
                      </div>
                      <p class="text-sm text-slate-500 dark:text-slate-400">{{ unitMeta }}</p>
                    </div>
                    <div v-if="isStaff" class="flex items-center gap-2">
                      <button
                        type="button"
                        class="min-h-[44px] px-5 rounded-xl border border-slate-200 dark:border-[#2E3D58] bg-white dark:bg-transparent text-sm font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                        @click="previewAsStudent = !previewAsStudent"
                      >{{ previewAsStudent ? 'Back to editing' : 'Preview as student' }}</button>
                      <div v-if="courseAccess && isTeacher" class="relative">
                        <button
                          type="button"
                          aria-label="More unit actions"
                          class="w-11 h-11 rounded-xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#172234] text-slate-600 dark:text-slate-200 text-lg leading-none hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                          @click.stop="menuOpen = !menuOpen"
                        >⋮</button>
                        <div v-if="menuOpen" class="absolute right-0 top-12 z-20 w-48 rounded-xl py-1 bg-white dark:bg-[#172234] border border-slate-200 dark:border-[#2E3D58] shadow-xl text-sm font-semibold">
                          <button class="unit-menu-item" @click="menuOpen = false; activeTab = 'theory'; editingContent = true">Edit text</button>
                          <button class="unit-menu-item unit-menu-danger" @click="menuOpen = false; askDeleteUnit()">Delete unit…</button>
                        </div>
                      </div>
                    </div>
                  </header>

                  <!-- Tabs (teacher only) -->
                  <div v-if="isTeacher && courseAccess" role="tablist" aria-label="Unit sections" class="flex flex-wrap gap-1 border-b border-slate-200 dark:border-[#1C2840]">
                    <button
                      v-for="t in tabs"
                      :key="t.id"
                      type="button"
                      role="tab"
                      :aria-selected="activeTab === t.id"
                      :class="[
                        'min-h-[44px] px-4 border-b-2 text-sm whitespace-nowrap transition cursor-pointer -mb-px',
                        activeTab === t.id
                          ? 'border-emerald-500 text-slate-900 dark:text-white font-bold'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold'
                      ]"
                      @click="activeTab = t.id"
                    >
                      {{ t.label }}
                      <span v-if="t.count !== undefined" :class="['ml-1', activeTab === t.id ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-400']">{{ t.count }}</span>
                    </button>
                  </div>

                  <!-- CONTENT -->
                  <template v-if="isTeacher && courseAccess && activeTab === 'theory' && editingContent">
                    <div class="rounded-2xl border border-slate-200/80 dark:border-[#22304A] bg-white dark:bg-[#111A28] p-6">
                      <UnitEditForm
                        :lesson-id="lessonId"
                        :unit="selected"
                        @saved="onContentSaved"
                        @cancel="editingContent = false"
                      />
                    </div>
                  </template>

                  <template v-else-if="!isTeacher || !courseAccess || activeTab === 'theory'">
                    <div v-if="activeVideo" class="rounded-2xl border border-slate-200/80 dark:border-[#22304A] bg-white dark:bg-[#111A28] overflow-hidden">
                      <div class="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2 text-sm text-slate-500 dark:text-slate-400">
                        <span>{{ activeVideo.label }}<template v-if="durationLabel(activeVideo.kind === 'practice' ? selected.practice_duration_seconds : selected.duration_seconds)"> · {{ durationLabel(activeVideo.kind === 'practice' ? selected.practice_duration_seconds : selected.duration_seconds) }}</template></span>
                        <div v-if="unitVideos.length > 1" class="inline-flex rounded-lg bg-slate-100 dark:bg-[#172234] p-1">
                          <button
                            v-for="v in unitVideos"
                            :key="v.kind"
                            type="button"
                            :class="[
                              'px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer',
                              activeVideo.kind === v.kind
                                ? 'bg-white dark:bg-[#2E3D58] text-emerald-700 dark:text-emerald-300 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                            ]"
                            @click="activeVideoKind = v.kind"
                          >{{ v.label }}</button>
                        </div>
                      </div>
                      <video :key="activeVideo.url" :src="activeVideo.url" controls class="w-full max-h-[60vh] bg-black"></video>
                      <div v-if="isTeacher && courseAccess" class="flex justify-end px-4 py-3 border-t border-slate-100 dark:border-[#1C2840]">
                        <button type="button" class="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-[#2E3D58] text-sm font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer" @click="editingContent = true">Replace video</button>
                      </div>
                    </div>
                    <div v-else-if="isTeacher && courseAccess" class="rounded-2xl border border-dashed border-slate-300 dark:border-[#2E3D58] p-8 text-center">
                      <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">No video for this unit yet.</p>
                      <button type="button" class="min-h-[40px] px-4 rounded-xl border border-emerald-600/60 text-sm font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 transition cursor-pointer" @click="editingContent = true">Add video</button>
                    </div>

                    <div class="rounded-2xl border border-slate-200/80 dark:border-[#22304A] bg-white dark:bg-[#111A28] p-6">
                      <div v-if="isTeacher && courseAccess" class="flex items-center justify-between gap-3 mb-4">
                        <h2 class="text-base font-bold text-slate-900 dark:text-white">Lesson text</h2>
                        <button type="button" class="min-h-[40px] px-4 rounded-xl border border-emerald-600/60 text-sm font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 transition cursor-pointer" @click="editingContent = true">✎ Edit text</button>
                      </div>

                      <MarkdownContent v-if="selected.content != null" :source="selected.content" />

                      <div v-if="selected.content == null" class="space-y-4">
                        <p class="text-sm text-slate-600 dark:text-slate-400">{{ selected.preview }}…</p>
                        <div class="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                          🔒 Enrol in this course to read the full unit.
                        </div>
                      </div>

                      <!-- Unit practice quiz — students take it here -->
                      <div
                        v-if="!isTeacher && selected.content != null && courseAccess"
                        class="mt-8 pt-6 border-t border-slate-100 dark:border-[#1C2840]"
                      >
                        <UnitPractice :key="selected.id" :unit-id="selected.id" />
                      </div>

                      <div
                        v-if="courseAccess && !isStaff && units.length > 0"
                        class="mt-8 pt-5 border-t border-slate-100 dark:border-[#1C2840]"
                      >
                        <button
                          :disabled="markingComplete || completed"
                          @click="markComplete"
                          class="px-5 py-2.5 rounded-xl bg-[#12804A] hover:bg-[#0f7a45] text-white text-sm font-bold disabled:opacity-50 transition active:scale-95 cursor-pointer"
                        >
                          {{ completed ? '✓ Chapter completed' : markingComplete ? 'Saving…' : 'Mark chapter complete' }}
                        </button>
                      </div>
                    </div>
                  </template>

                  <!-- PRACTICE QUIZ -->
                  <template v-else-if="activeTab === 'quiz'">
                    <div class="rounded-2xl border border-slate-200/80 dark:border-[#22304A] bg-white dark:bg-[#111A28] p-6">
                      <UnitQuizEditor
                        :key="'m-' + selected.id"
                        :unit-id="selected.id"
                        :unit-title="selected.title"
                        :course-id="chapter?.course?.id"
                        :lesson-id="lessonId"
                      />
                    </div>
                  </template>

                  <!-- STUDENT RESULTS -->
                  <template v-else-if="activeTab === 'results'">
                    <p v-if="statsLoading" class="text-sm text-slate-500 dark:text-slate-400">Loading results…</p>
                    <p v-else-if="statsError" class="text-sm text-red-600 dark:text-red-300">{{ statsError }}</p>
                    <div v-else-if="!stats" class="rounded-2xl border border-dashed border-slate-300 dark:border-[#2E3D58] p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      This unit has no practice quiz yet, so there are no results to show.
                    </div>
                    <template v-else>
                      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div class="rounded-2xl p-5 bg-white dark:bg-[#111A28] border border-slate-200/80 dark:border-[#22304A]">
                          <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">Students practised</p>
                          <p class="mt-3 text-4xl font-extrabold text-slate-900 dark:text-white">{{ stats.practised }}<span class="text-lg font-semibold text-slate-400"> / {{ stats.enrolled }}</span></p>
                        </div>
                        <div class="rounded-2xl p-5 bg-white dark:bg-[#111A28] border border-slate-200/80 dark:border-[#22304A]">
                          <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">Average score</p>
                          <p class="mt-3 text-4xl font-extrabold text-amber-500 dark:text-[#F2C14E]">{{ stats.average_percent === null ? '—' : stats.average_percent + '%' }}</p>
                        </div>
                        <div class="rounded-2xl p-5 bg-white dark:bg-[#111A28] border border-slate-200/80 dark:border-[#22304A]">
                          <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">Passed ({{ stats.pass_percentage }}%+)</p>
                          <p class="mt-3 text-4xl font-extrabold text-slate-900 dark:text-white">{{ stats.passed }}</p>
                        </div>
                      </div>

                      <div class="rounded-2xl p-6 bg-white dark:bg-[#111A28] border border-slate-200/80 dark:border-[#22304A]">
                        <h2 class="text-base font-bold text-slate-900 dark:text-white mb-4">Hardest questions</h2>
                        <p v-if="stats.hardest.length === 0" class="text-sm text-slate-500 dark:text-slate-400">Not enough attempts yet to tell which questions are hardest.</p>
                        <ul v-else class="space-y-3.5">
                          <li v-for="q in stats.hardest" :key="q.number" class="flex items-center gap-4">
                            <span class="w-9 shrink-0 text-sm font-bold text-slate-500 dark:text-slate-400">Q{{ q.number }}</span>
                            <span class="flex-1 min-w-0 truncate text-sm text-slate-800 dark:text-slate-100"><MathText :text="q.question" /></span>
                            <span class="hidden sm:block w-40 h-2 rounded-full bg-slate-100 dark:bg-[#1F2C42] overflow-hidden shrink-0">
                              <span class="block h-full rounded-full bg-amber-500" :style="{ width: q.percent_correct + '%' }"></span>
                            </span>
                            <span class="w-24 text-right text-sm font-bold text-amber-600 dark:text-[#F2C14E] shrink-0">{{ q.percent_correct }}% correct</span>
                          </li>
                        </ul>
                      </div>
                    </template>
                  </template>
                </template>
                <p v-else class="text-sm text-slate-500 italic">Select a unit to start reading.</p>
              </section>
            </div>
          </template>
        </div>
      </main>
      <Footer />
      </div>
    </div>

    <ConfirmModal
      v-if="showDeleteUnitModal"
      title="Delete this unit?"
      :message="`This will permanently delete '${selected?.title}' and its content. This action cannot be undone.`"
      confirm-label="Delete Unit"
      :loading="deletingUnit"
      :error="deleteUnitError"
      @close="closeDeleteUnitModal"
      @confirm="confirmDeleteUnit"
    />
  </div>
</template>

<style scoped>
.unit-menu-item { display: block; width: 100%; text-align: left; padding: 0.55rem 0.9rem; cursor: pointer; color: rgb(51 65 85); }
.unit-menu-item:hover { background: rgb(241 245 249); }
.unit-menu-danger { color: rgb(185 28 28); }
:global(.dark) .unit-menu-item { color: rgb(226 232 240); }
:global(.dark) .unit-menu-item:hover { background: rgb(30 41 59); }
:global(.dark) .unit-menu-danger { color: #FCA5A5; }
</style>

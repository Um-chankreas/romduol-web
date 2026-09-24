<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'
import MarkdownContent from '@/components/ui/MarkdownContent.vue'
import UnitEditForm from '@/components/units/UnitEditForm.vue'
import UnitPractice from '@/components/units/UnitPractice.vue'
import UnitQuizEditor from '@/components/units/UnitQuizEditor.vue'
import CurriculumSidebar from '@/components/units/CurriculumSidebar.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import { unitService } from '@/services/unitService'
import { lessonService } from '@/services/lessonService'
import { authService } from '@/services/authService'

defineOptions({ name: 'LessonView' })

const route = useRoute()
const router = useRouter()

const lessonId = computed(() => route.params.lessonId)
const currentUser = authService.getCurrentUser()
const isTeacher = currentUser?.role === 'teacher'

const chapter = ref(null)
const courseAccess = ref(false)
const units = ref([])
const loading = ref(true)
const error = ref(null)

const selectedId = ref(null)
const selected = computed(() => units.value.find((u) => u.id === selectedId.value) || null)

// Ref onto the curriculum sidebar so an inline edit/delete here (below) can
// tell it its own cached list for this chapter is stale — otherwise the
// sidebar keeps showing the old title / the deleted unit until a full reload.
const curriculumSidebarRef = ref(null)

// Teacher-only tabs for the selected unit. A student never sees these — they
// just read the unit and, below it, take the practice quiz (see UnitPractice).
const TABS = [
  { id: 'theory', label: 'Theory Lesson', icon: '📖' },
  { id: 'quiz', label: 'Quiz Editor', icon: '📝' },
  { id: 'results', label: 'Student Results', icon: '📊' },
]
const activeTab = ref('theory')
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

      <main class="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
        <div class="w-full max-w-6xl mx-auto flex flex-col gap-6">
          <div v-if="loading" class="text-center py-20 text-slate-500 dark:text-slate-400 font-medium">
            Loading chapter…
          </div>
          <div v-else-if="error" class="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm">{{ error }}</div>

          <template v-else>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {{ chapter?.course?.title || 'Chapter' }}
              </p>
              <h1 class="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-200">
                {{ chapter?.title }}
              </h1>
            </div>

            <!-- Reader / editor -->
            <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
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

              <!-- Selected unit -->
              <article class="min-w-0 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
                <template v-if="selected">
                  <!-- Tabs: teacher only. A student has nothing to switch between —
                       just the reader, with the practice quiz below it. -->
                  <div
                    v-if="isTeacher && courseAccess"
                    class="flex items-center justify-between gap-3 flex-wrap mb-6 pb-3 border-b border-slate-100 dark:border-slate-800"
                  >
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <button
                        v-for="t in TABS"
                        :key="t.id"
                        type="button"
                        class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition"
                        :class="activeTab === t.id
                          ? 'bg-[#006A3A] text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'"
                        @click="activeTab = t.id"
                      >
                        <span>{{ t.icon }}</span> {{ t.label }}
                      </button>
                    </div>
                    <span v-if="lastEditedLabel && activeTab === 'theory'" class="flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap">
                      🕐 Last edited: {{ lastEditedLabel }}
                    </span>
                  </div>

                  <div class="flex items-center justify-between gap-3 mb-4">
                    <h2 class="text-xl font-bold text-slate-800 dark:text-slate-200">{{ selected.title }}</h2>
                    <span v-if="isTeacher && courseAccess && activeTab === 'theory' && !editingContent" class="shrink-0 flex items-center gap-3">
                      <button
                        type="button"
                        class="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                        @click="editingContent = true"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        class="text-xs font-bold text-red-600 hover:underline"
                        @click="askDeleteUnit"
                      >
                        Delete
                      </button>
                    </span>
                  </div>

                  <!-- Inline theory-content editor — skips Manage units for the
                       common case of just fixing/rewriting this one unit. -->
                  <template v-if="isTeacher && courseAccess && activeTab === 'theory' && editingContent">
                    <UnitEditForm
                      :lesson-id="lessonId"
                      :unit="selected"
                      @saved="onContentSaved"
                      @cancel="editingContent = false"
                    />
                  </template>

                  <template v-else-if="!isTeacher || !courseAccess || activeTab === 'theory'">
                    <video
                      v-if="selected.video_url"
                      :src="selected.video_url"
                      controls
                      class="w-full max-h-[60vh] rounded-xl bg-black mb-5"
                    ></video>

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
                      class="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800"
                    >
                      <UnitPractice :key="selected.id" :unit-id="selected.id" />
                    </div>

                    <div
                      v-if="courseAccess && !isTeacher && units.length > 0"
                      class="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800"
                    >
                      <button
                        :disabled="markingComplete || completed"
                        @click="markComplete"
                        class="px-5 py-2.5 rounded-xl bg-[#006A3A] hover:bg-[#005A31] text-white text-xs font-bold disabled:opacity-50 transition active:scale-95"
                      >
                        {{ completed ? '✓ Chapter completed' : markingComplete ? 'Saving…' : 'Mark chapter complete' }}
                      </button>
                    </div>
                  </template>

                  <template v-else-if="activeTab === 'quiz'">
                    <UnitQuizEditor
                      :key="'m-' + selected.id"
                      :unit-id="selected.id"
                      :unit-title="selected.title"
                      :course-id="chapter?.course?.id"
                      :lesson-id="lessonId"
                    />
                  </template>

                  <template v-else-if="activeTab === 'results'">
                    <div class="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      Per-student results for this quiz aren't available yet — this tab is a placeholder for now.
                    </div>
                  </template>
                </template>
                <p v-else class="text-sm text-slate-500 italic">Select a unit to start reading.</p>
              </article>
            </div>
          </template>
        </div>
      </main>
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

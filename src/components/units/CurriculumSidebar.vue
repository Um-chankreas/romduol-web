<script setup>
import { ref, watch, onMounted } from 'vue'
import { lessonService } from '@/services/lessonService'
import { unitService } from '@/services/unitService'
import { isLatexDocument, latexToMarkdown, renderPendingFigures } from '@/utils/latexToMarkdown'
import UploadLessonModal from '@/components/modals/UploadLessonModal.vue'

const props = defineProps({
  courseId: { type: String, default: null },
  activeChapterId: { type: String, default: null },
  activeUnitId: { type: String, default: null },
  isTeacher: { type: Boolean, default: false },
})
// { chapterId, unit } for a unit in the ACTIVE chapter (in-page switch, no
// navigation); a unit in a different chapter is navigated to directly by
// the caller instead (see LessonView.vue's curriculum-select handler).
// 'unit-added' lets the parent refresh + jump to a just-added unit if it
// landed in the chapter it's currently showing; 'change' is the more
// general "this chapter's units changed under you" signal (reorder, bulk
// import) so the parent can silently refresh without changing selection.
// 'chapter-added' hands the parent a whole new chapter so it can navigate
// straight there (see LessonView.vue).
const emit = defineEmits(['select-unit', 'navigate-chapter', 'unit-added', 'change', 'chapter-added'])

const chapters = ref([])
const loading = ref(true)
const expanded = ref(new Set())
const unitsByChapter = ref({}) // chapterId -> units[] | 'loading' | 'error'

const loadChapters = async () => {
  if (!props.courseId) return
  loading.value = true
  try {
    const res = await lessonService.getCourseLessons(props.courseId)
    chapters.value = res?.data?.lessons || []
  } catch {
    chapters.value = []
  } finally {
    loading.value = false
  }
}

const loadUnitsFor = async (chapterId) => {
  unitsByChapter.value = { ...unitsByChapter.value, [chapterId]: 'loading' }
  try {
    const res = await unitService.listUnits(chapterId)
    unitsByChapter.value = { ...unitsByChapter.value, [chapterId]: res?.data?.units || [] }
  } catch {
    unitsByChapter.value = { ...unitsByChapter.value, [chapterId]: 'error' }
  }
}

const toggle = (chapterId) => {
  const next = new Set(expanded.value)
  if (next.has(chapterId)) {
    next.delete(chapterId)
  } else {
    next.add(chapterId)
    if (!unitsByChapter.value[chapterId]) loadUnitsFor(chapterId)
  }
  expanded.value = next
}

const pickUnit = (chapterId, unit) => {
  if (chapterId === props.activeChapterId) emit('select-unit', unit)
  else emit('navigate-chapter', { chapterId, unitId: unit.id })
}

// Quick "+ Add Unit" inline under a chapter — skips the full Manage Units
// screen for the common case of just wanting one more unit right now.
const addingTo = ref(null) // chapterId currently showing the inline form
const newUnitTitle = ref('')
const addBusy = ref(false)
const addError = ref(null)

const startAdd = (chapterId) => {
  addingTo.value = chapterId
  newUnitTitle.value = ''
  addError.value = null
  if (!expanded.value.has(chapterId)) toggle(chapterId)
}
const cancelAdd = () => { addingTo.value = null }

const submitAdd = async (chapterId) => {
  const title = newUnitTitle.value.trim()
  if (!title) return
  addBusy.value = true
  addError.value = null
  try {
    const res = await unitService.createUnit({ lesson_id: chapterId, title })
    await loadUnitsFor(chapterId)
    addingTo.value = null
    emit('unit-added', { chapterId, unit: res?.data?.unit || null })
  } catch (err) {
    addError.value = err.response?.data?.error || err.message || 'Failed to add unit'
  } finally {
    addBusy.value = false
  }
}

// ── Add Chapter (whole new lesson) ───────────────────────────────────────
// Reuses the same drawer CourseDetailView's "Upload Lesson" uses, so a
// teacher can start a new chapter right from here instead of navigating
// back to the course page.
const showAddChapterModal = ref(false)
const addChapterBusy = ref(false)
const addChapterError = ref(null)
const addChapterVideoProgress = ref(null)

const openAddChapterModal = () => {
  addChapterError.value = null
  showAddChapterModal.value = true
}
const closeAddChapterModal = () => {
  if (addChapterBusy.value) return
  showAddChapterModal.value = false
}

const handleAddChapter = async ({ title, description, orderNumber, videoFile, markdown }) => {
  if (!props.courseId) return
  addChapterBusy.value = true
  addChapterError.value = null
  addChapterVideoProgress.value = null
  try {
    const res = await lessonService.createLesson(props.courseId, title, description, null, orderNumber)
    let newChapter = res.data?.lesson || res

    if (markdown) {
      await unitService.bulkImport(newChapter.id, markdown)
    }

    if (videoFile) {
      addChapterVideoProgress.value = 0
      const videoRes = await lessonService.uploadLessonVideo(newChapter.id, videoFile, {
        onProgress: (pct) => { addChapterVideoProgress.value = pct }
      })
      newChapter = { ...newChapter, ...(videoRes.data?.lesson || videoRes) }
    }

    showAddChapterModal.value = false
    await loadChapters()
    emit('chapter-added', { chapter: newChapter })
  } catch (err) {
    addChapterError.value = err.response?.data?.error || err.message || 'Failed to create chapter'
  } finally {
    addChapterBusy.value = false
    addChapterVideoProgress.value = null
  }
}

// ── Reorder (▲▼) ──────────────────────────────────────────────────────────
const reorderBusy = ref(null) // chapterId currently persisting a move
const moveUnit = async (chapterId, index, dir) => {
  const list = unitsByChapter.value[chapterId]
  if (!Array.isArray(list)) return
  const target = index + dir
  if (target < 0 || target >= list.length) return
  const next = list.slice()
  ;[next[index], next[target]] = [next[target], next[index]]
  unitsByChapter.value = { ...unitsByChapter.value, [chapterId]: next }
  reorderBusy.value = chapterId
  try {
    await unitService.reorderUnits(chapterId, next.map((u) => u.id))
    emit('change', { chapterId })
  } catch {
    await loadUnitsFor(chapterId) // out of sync with the server — reload the true order
  } finally {
    reorderBusy.value = null
  }
}

// ── Bulk Markdown / LaTeX import ─────────────────────────────────────────
// Paste (or "Upload .tex") a whole chapter at once — split into units on
// every `## ` heading. A `\includegraphics` or TikZ figure that can't be
// auto-rendered is left as a placeholder in the unit's content; upload an
// image for it afterwards via that unit's own Edit (see UnitEditForm.vue).
const importOpenFor = ref(null) // chapterId currently showing the import panel
const importState = ref({ markdown: '', replace: false })
const importBusy = ref(false)
const importError = ref(null)
const importNote = ref('')
const renderingFigures = ref(0) // >0 while a TikZ figure is being auto-rendered
// A plain `ref="importTexFileRef"` here would silently break: it's inside
// this chapter list's v-for, so Vue would collect it into an ARRAY of refs
// instead of a single element, making `.value.click()` throw. A function
// ref sidesteps that — only the one currently-open panel's input ever sets it.
const importTexFileRef = ref(null)
const setImportTexFileRef = (el) => { importTexFileRef.value = el }

const toggleImport = (chapterId) => {
  importOpenFor.value = importOpenFor.value === chapterId ? null : chapterId
  importState.value = { markdown: '', replace: false }
  importError.value = null
  importNote.value = ''
}

const renderImportFigures = async (chapterId) => {
  if (!/```figure-tikz\b/.test(importState.value.markdown)) return
  renderingFigures.value++
  try {
    const { markdown, rendered, failed } = await renderPendingFigures(
      importState.value.markdown,
      (source) => unitService.renderTikzFigure(source).then((r) => r.data.dataUrl),
    )
    importState.value.markdown = markdown
    if (failed) {
      importNote.value = rendered
        ? `${rendered} diagram(s) rendered. ${failed} couldn't be auto-rendered — fix ${failed === 1 ? 'it' : 'them'} via that unit's Edit afterwards.`
        : `Couldn't auto-render ${failed === 1 ? 'this diagram' : 'these diagrams'} — fix via that unit's Edit afterwards.`
    } else if (rendered) {
      importNote.value = `${rendered} diagram${rendered > 1 ? 's' : ''} rendered automatically.`
    }
    if (importNote.value) setTimeout(() => { importNote.value = '' }, 8000)
  } finally {
    renderingFigures.value--
  }
}

const convertImportField = async (chapterId) => {
  if (!isLatexDocument(importState.value.markdown)) return
  const { markdown, warnings } = latexToMarkdown(importState.value.markdown)
  importState.value.markdown = markdown
  importNote.value = warnings.length ? `Converted from LaTeX — ${warnings.join(' ')}` : 'Converted from LaTeX to Markdown.'
  setTimeout(() => { importNote.value = '' }, 8000)
  await renderImportFigures(chapterId)
}

const pickImportFile = () => importTexFileRef.value?.click()
// Accepts either a .md (used as-is) or a .tex document (auto-converted) —
// isLatexDocument() tells them apart, so one picker handles both.
const handleImportFile = async (e, chapterId) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    const text = await file.text()
    importState.value.markdown = text
    if (isLatexDocument(text)) await convertImportField(chapterId)
  } catch {
    importError.value = 'Could not read that file.'
  }
}

const runBulkImport = async (chapterId) => {
  if (!importState.value.markdown.trim()) return
  if (importState.value.replace && !confirm('Replace ALL existing units in this chapter?')) return
  importBusy.value = true
  importError.value = null
  try {
    await unitService.bulkImport(chapterId, importState.value.markdown, { replace: importState.value.replace })
    await loadUnitsFor(chapterId)
    importOpenFor.value = null
    emit('change', { chapterId })
  } catch (err) {
    importError.value = err.response?.data?.error || err.message || 'Import failed'
  } finally {
    importBusy.value = false
  }
}

// The active chapter is expanded by default so its units are visible
// without an extra click.
watch(() => props.activeChapterId, (id) => {
  if (!id) return
  const next = new Set(expanded.value)
  next.add(id)
  expanded.value = next
  if (!unitsByChapter.value[id]) loadUnitsFor(id)
}, { immediate: true })

watch(() => props.courseId, loadChapters)
onMounted(loadChapters)

// Lets a parent (e.g. LessonView's inline edit/delete) tell this sidebar's
// own cached unit list for one chapter is stale, without it having to know
// our internal state shape.
defineExpose({
  refreshChapter: (chapterId) => {
    if (expanded.value.has(chapterId)) loadUnitsFor(chapterId)
  },
})
</script>

<template>
  <aside class="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 lg:sticky lg:top-4">
    <div class="px-2 py-2 flex items-center justify-between">
      <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Curriculum</span>
      <button
        v-if="isTeacher"
        type="button"
        title="Add a new chapter"
        class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
        @click="openAddChapterModal"
      >
        + Add Chapter
      </button>
    </div>

    <p v-if="loading" class="px-3 py-2 text-xs text-slate-400 italic">Loading curriculum…</p>
    <p v-else-if="chapters.length === 0" class="px-3 py-2 text-xs text-slate-400 italic">No chapters yet.</p>

    <ul v-else class="space-y-0.5">
      <li v-for="(c, ci) in chapters" :key="c.id">
        <button
          type="button"
          class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-bold transition"
          :class="c.id === activeChapterId
            ? 'text-slate-800 dark:text-slate-100'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'"
          @click="toggle(c.id)"
        >
          <span
            class="w-5 h-5 rounded-md flex items-center justify-center text-[10px] shrink-0"
            :class="c.id === activeChapterId ? 'bg-[#033B26] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'"
          >{{ ci + 1 }}</span>
          <span class="flex-1 min-w-0 truncate">{{ c.title }}</span>
          <svg
            class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform"
            :class="expanded.has(c.id) ? 'rotate-90' : ''"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <ul v-if="expanded.has(c.id)" class="mt-0.5 ml-6 space-y-0.5 border-l border-slate-100 dark:border-slate-800 pl-2">
          <li v-if="unitsByChapter[c.id] === 'loading'" class="px-2 py-1.5 text-[11px] text-slate-400 italic">Loading…</li>
          <li v-else-if="unitsByChapter[c.id] === 'error'" class="px-2 py-1.5 text-[11px] text-red-500">Couldn't load units.</li>
          <li v-else-if="(unitsByChapter[c.id] || []).length === 0" class="px-2 py-1.5 text-[11px] text-slate-400 italic">No units yet.</li>
          <li v-for="(u, ui) in unitsByChapter[c.id]" :key="u.id" class="flex items-center gap-0.5 group">
            <button
              type="button"
              class="flex-1 min-w-0 text-left px-2.5 py-1.5 rounded-lg text-[12px] leading-snug transition flex items-start gap-1.5"
              :class="u.id === activeUnitId && c.id === activeChapterId
                ? 'bg-emerald-50 dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'"
              @click="pickUnit(c.id, u)"
            >
              <span class="flex-1 min-w-0">{{ u.title }}</span>
              <span v-if="u.locked" class="shrink-0" title="Locked">🔒</span>
            </button>
            <span v-if="isTeacher" class="shrink-0 flex flex-col opacity-0 group-hover:opacity-100 transition">
              <button
                type="button"
                title="Move up"
                :disabled="ui === 0 || reorderBusy === c.id"
                class="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 text-[9px] leading-none"
                @click="moveUnit(c.id, ui, -1)"
              >▲</button>
              <button
                type="button"
                title="Move down"
                :disabled="ui === unitsByChapter[c.id].length - 1 || reorderBusy === c.id"
                class="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 text-[9px] leading-none"
                @click="moveUnit(c.id, ui, 1)"
              >▼</button>
            </span>
          </li>

          <li v-if="isTeacher">
            <form v-if="addingTo === c.id" class="flex items-center gap-1 px-1 py-1" @submit.prevent="submitAdd(c.id)">
              <input
                v-model="newUnitTitle"
                type="text"
                autofocus
                placeholder="New unit title…"
                :disabled="addBusy"
                class="flex-1 min-w-0 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-[12px] focus:outline-none focus:border-emerald-500"
                @keydown.esc="cancelAdd"
              />
              <button type="submit" :disabled="addBusy || !newUnitTitle.trim()" class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 disabled:opacity-40 shrink-0">
                {{ addBusy ? '…' : 'Add' }}
              </button>
              <button type="button" class="text-[11px] font-bold text-slate-400 shrink-0" @click="cancelAdd">✕</button>
            </form>
            <button
              v-else
              type="button"
              class="w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800/60 transition"
              @click="startAdd(c.id)"
            >
              + Add Unit
            </button>
            <p v-if="addingTo === c.id && addError" class="px-2.5 pb-1 text-[11px] text-red-500">{{ addError }}</p>
          </li>

          <li v-if="isTeacher">
            <button
              type="button"
              class="w-full text-left px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
              @click="toggleImport(c.id)"
            >
              {{ importOpenFor === c.id ? 'Close import' : '⬆ Import Markdown / LaTeX' }}
            </button>

            <div v-if="importOpenFor === c.id" class="mt-1.5 mx-1 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-2">
              <input :ref="setImportTexFileRef" type="file" class="hidden" accept=".md,text/markdown,.tex,text/x-tex,application/x-tex" @change="handleImportFile($event, c.id)" />
              <div class="flex items-center justify-between gap-2">
                <p class="text-[10px] text-slate-500 dark:text-slate-400">
                  Paste a whole chapter's Markdown, or a LaTeX document — split into units on every <code>## </code> heading.
                </p>
                <button type="button" class="shrink-0 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline" @click="pickImportFile">Upload .md / .tex</button>
              </div>
              <textarea
                v-model="importState.markdown"
                rows="6"
                placeholder="## Unit 1: …"
                class="w-full px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-mono focus:outline-none focus:border-emerald-500"
                @blur="convertImportField(c.id)"
              ></textarea>
              <p v-if="isLatexDocument(importState.markdown)" class="text-[10px] text-amber-700 dark:text-amber-300">
                Looks like LaTeX —
                <button type="button" class="font-semibold hover:underline" @click="convertImportField(c.id)">convert to Markdown</button>
              </p>
              <p v-if="importNote" class="text-[10px] text-amber-700 dark:text-amber-300">{{ importNote }}</p>
              <p v-if="renderingFigures > 0" class="text-[10px] text-emerald-700 dark:text-emerald-400">Rendering diagram(s)…</p>
              <p v-if="importError" class="text-[10px] text-red-500">{{ importError }}</p>
              <label class="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                <input v-model="importState.replace" type="checkbox" class="rounded" />
                Replace all existing units first
              </label>
              <div class="flex justify-end">
                <button
                  type="button"
                  :disabled="importBusy || !importState.markdown.trim() || renderingFigures > 0"
                  class="px-3 py-1 rounded-lg bg-[#033B26] hover:bg-[#022819] text-white text-[11px] font-bold disabled:opacity-50"
                  @click="runBulkImport(c.id)"
                >
                  {{ importBusy ? 'Importing…' : 'Import units' }}
                </button>
              </div>
            </div>
          </li>
        </ul>
      </li>
    </ul>

    <UploadLessonModal
      v-if="showAddChapterModal"
      :uploading="addChapterBusy"
      :error="addChapterError"
      :video-progress="addChapterVideoProgress"
      @close="closeAddChapterModal"
      @upload="handleAddChapter"
    />
  </aside>
</template>

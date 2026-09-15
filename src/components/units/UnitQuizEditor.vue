<script setup>
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { quizService } from '@/services/quizService'
import MathInput from '@/components/ui/MathInput.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'
import { normalizeMath, autoWrapLatex, renderInline } from '@/utils/markdown'

const props = defineProps({
  unitId: { type: String, required: true },
  unitTitle: { type: String, default: '' },
  courseId: { type: String, default: null },
  lessonId: { type: String, default: null },
})
const emit = defineEmits(['change'])

const TIERS = ['Easy', 'Medium', 'Hard']
const tierBadgeClass = (t) => {
  const k = String(t || '').toLowerCase()
  if (k.startsWith('e')) return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
  if (k.startsWith('h')) return 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
  return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
}
const normType = (t) => {
  const k = String(t || '').toLowerCase().replace(/[\s_-]+/g, '')
  return ['numberinput', 'numeric', 'numericentry', 'number', 'num', 'input'].includes(k) ? 'number_input' : 'QCM'
}

const loading = ref(true)
const saving = ref(false)
const msg = ref(null)
const error = ref(null)

const blankQuestion = () => ({
  id: Date.now() + Math.random(),
  question: '',
  options: ['', '', '', ''],
  correct_answer: '',
  explanation: '',
  difficulty: 'Medium',
  question_type: 'QCM',
})

const quiz = ref({
  id: null,
  course_id: props.courseId,
  lesson_id: props.lessonId,
  unit_id: props.unitId,
  title: '',
  pass_percentage: 70,
  time_limit: 15,
  status: 'draft',
  questions: [blankQuestion()],
})

// A published quiz is locked: editing a live quiz mid-attempt would let a
// question change under a student partway through it. Unpublish (back to
// draft) to resume editing, then Publish again when done.
const isPublished = computed(() => quiz.value.status === 'published')

// True on-demand paging: a page of the bank is only fetched from the server
// when Next actually needs it (Back never re-fetches — pages already seen
// stay in quiz.value.questions). This only works because save() no longer
// resends the whole bank: it diffs against originalById (a snapshot of what
// the server is known to hold, per question id) and issues one add/update/
// delete call per question that actually changed. A page the teacher never
// paged to was never added to originalById, so it's never touched — safe to
// leave unfetched.
const EDITOR_PAGE_SIZE = 10
const editorPage = ref(1)
const totalCount = ref(0)
const pageLoading = ref(false)
const editorTotalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / EDITOR_PAGE_SIZE)))
const pagedQuestions = computed(() => {
  const start = (editorPage.value - 1) * EDITOR_PAGE_SIZE
  return quiz.value.questions.slice(start, start + EDITOR_PAGE_SIZE).map((q, i) => ({ q, index: start + i }))
})
// A run of page-number pills centered on the current page (so "2" of 14
// shows "1 2 3 4 5", clamped at either end of the range).
const PILL_WINDOW = 5
const pageWindow = computed(() => {
  const total = editorTotalPages.value
  let start = Math.max(1, editorPage.value - Math.floor((PILL_WINDOW - 1) / 2))
  let end = Math.min(total, start + PILL_WINDOW - 1)
  start = Math.max(1, end - PILL_WINDOW + 1)
  const pills = []
  for (let p = start; p <= end; p++) pills.push(p)
  return { pills }
})
const originalById = new Map()
// Lets the "fx" / "√" buttons in a question's prompt label row drive that
// question's own MathInput (its built-in math toolbar), keyed by question id.
const promptRefs = new Map()
const setPromptRef = (id, el) => { if (el) promptRefs.set(id, el); else promptRefs.delete(id) }
const lastSavedAt = ref(null)
const lastSavedLabel = computed(() =>
  lastSavedAt.value ? lastSavedAt.value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null
)

const mapQuestion = (q) => {
  const type = normType(q.question_type)
  const rawOpts = typeof q.options === 'string' ? JSON.parse(q.options || '[]') : (q.options || ['', '', '', ''])
  return {
    id: q.id,
    question: normalizeMath(q.question || ''),
    options: type === 'number_input' ? [] : rawOpts.map((o) => autoWrapLatex(o)),
    correct_answer: type === 'number_input' ? (q.correct_answer || '') : autoWrapLatex(q.correct_answer || ''),
    explanation: normalizeMath(q.explanation || ''),
    difficulty: q.difficulty || 'Medium',
    question_type: type,
  }
}
const serializeQuestion = (q) => ({
  question: q.question,
  options: q.question_type === 'number_input' ? [] : q.options.filter((o) => o.trim()),
  correct_answer: q.correct_answer,
  explanation: q.explanation || null,
  difficulty: q.difficulty,
  question_type: q.question_type,
})
const snapshotOf = (q) => JSON.stringify(serializeQuestion(q))

const load = async () => {
  flushAutosave()
  loading.value = true
  editorPage.value = 1
  totalCount.value = 0
  originalById.clear()
  lastSavedAt.value = null
  error.value = null
  clearSearch()
  try {
    const existing = (await quizService.getUnitQuizzes(props.unitId)) || []
    const found = existing[0]
    if (found) {
      const first = await quizService.getQuizById(found.id, { page: 1, limit: EDITOR_PAGE_SIZE })
      totalCount.value = first.pagination?.total ?? (first.questions || []).length
      lastSavedAt.value = first.updated_at ? new Date(first.updated_at) : null
      const mapped = (first.questions || []).map(mapQuestion)
      mapped.forEach((q) => originalById.set(q.id, snapshotOf(q)))
      quiz.value = {
        id: first.id,
        course_id: props.courseId,
        lesson_id: props.lessonId,
        unit_id: props.unitId,
        title: first.title || '',
        pass_percentage: first.pass_percentage ?? 70,
        time_limit: first.time_limit ?? 15,
        status: first.status || 'draft',
        questions: mapped.length ? mapped : [blankQuestion()],
      }
    } else {
      quiz.value.title = props.unitTitle ? `${props.unitTitle} — Practice` : 'Practice'
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to load quiz'
  } finally {
    loading.value = false
  }
}

// Fetches whatever pages are missing until the local array holds at least
// `needed` questions (shared by goToPage — a short hop ahead — and
// addQuestion, which must catch all the way up before it can safely append
// at the true end; see addQuestion for why).
const loadPagesUntil = async (needed) => {
  while (quiz.value.questions.length < needed) {
    const page = Math.floor(quiz.value.questions.length / EDITOR_PAGE_SIZE) + 1
    const res = await quizService.getQuizById(quiz.value.id, { page, limit: EDITOR_PAGE_SIZE })
    const mapped = (res.questions || []).map(mapQuestion)
    if (!mapped.length) break // safety net against an infinite loop
    mapped.forEach((q) => originalById.set(q.id, snapshotOf(q)))
    quiz.value.questions = [...quiz.value.questions, ...mapped]
  }
}

// Jumps to any page (Back/Next, or a numbered pill). A jump ahead of what's
// loaded fetches every page in between first, in order — already-seen pages
// never re-fetch.
const goToPage = async (target) => {
  const clamped = Math.min(Math.max(target, 1), editorTotalPages.value)
  if (clamped === editorPage.value) return
  const needed = Math.min(clamped * EDITOR_PAGE_SIZE, totalCount.value)
  if (quiz.value.questions.length < needed) {
    pageLoading.value = true
    error.value = null
    try {
      await loadPagesUntil(needed)
    } catch (err) {
      error.value = err.response?.data?.error || err.message || 'Failed to load that question'
      pageLoading.value = false
      return
    }
    pageLoading.value = false
  }
  editorPage.value = clamped
}
const goBack = () => goToPage(editorPage.value - 1)
const goNext = () => goToPage(editorPage.value + 1)

// ── Search the question bank ────────────────────────────────────────────
// Searches the server (not just what's loaded locally — the whole point on a
// 150-question bank) by prompt text, then jumps to whichever page the picked
// match lives on. Assumes order_number is a dense 1..N sequence (true for
// anything created/imported/reordered normally), so page = ceil(n / size).
const searchQuery = ref('')
const searchResults = ref([])
const searching = ref(false)
const highlightId = ref(null)
let searchTimer = null

const runSearch = async (term) => {
  searching.value = true
  try {
    searchResults.value = await quizService.searchQuizQuestions(quiz.value.id, term)
  } catch {
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

watch(searchQuery, (val) => {
  if (searchTimer) clearTimeout(searchTimer)
  const term = val.trim()
  if (!term || !quiz.value.id) { searchResults.value = []; searching.value = false; return }
  searching.value = true
  searchTimer = setTimeout(() => runSearch(term), 350)
})

// A search-result snippet: trims to length WITHOUT stripping the math (a
// CSV-generated bank commonly reuses one prompt template with only the
// formula differing per row — toPlainPreview() strips $…$ entirely, which
// made every row in the dropdown show identical text). Truncating the raw
// source before rendering can occasionally cut a math span mid-formula;
// renderInline()'s KaTeX call just falls back to showing that fragment as
// plain text rather than throwing, so worst case is a slightly odd tail.
const searchSnippet = (text, max = 100) => {
  const t = String(text || '').trim()
  return renderInline(t.length > max ? t.slice(0, max).trimEnd() + '…' : t)
}

const clearSearch = () => {
  if (searchTimer) { clearTimeout(searchTimer); searchTimer = null }
  searchQuery.value = ''
  searchResults.value = []
  searching.value = false
}

// Enter jumps straight to the best (first) match — runs the search
// immediately rather than waiting out the debounce if the teacher hits
// Enter before it's fired (e.g. right after pasting a search term).
const onSearchEnter = async () => {
  const term = searchQuery.value.trim()
  if (!term || !quiz.value.id) return
  if (searchTimer) { clearTimeout(searchTimer); searchTimer = null }
  await runSearch(term)
  if (searchResults.value.length > 0) jumpToMatch(searchResults.value[0])
}

const jumpToMatch = async (match) => {
  const targetPage = Math.max(1, Math.ceil((match.order_number || 1) / EDITOR_PAGE_SIZE))
  clearSearch()
  await goToPage(targetPage)
  highlightId.value = match.id
  await nextTick()
  document.getElementById(`q-${match.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => { if (highlightId.value === match.id) highlightId.value = null }, 2500)
}

// Autosave: a teacher who edits then hits Back or closes the tab without
// clicking Save shouldn't lose the edit. Every real edit (see the template's
// @input/@update:model-value/@change hooks, and addQuestion/removeQuestion/
// setType/addOption/removeOption below) calls scheduleAutosave(), which
// debounces briefly then runs the exact same create/update/delete diff as
// an explicit Save — silently, keeping whatever status (draft/published)
// the quiz already has. Publish/Save draft flush any pending autosave first
// so they never race it.
const AUTOSAVE_DELAY_MS = 1000
const autosaving = ref(false)
let autosaveTimer = null
const flushAutosave = () => {
  if (autosaveTimer) { clearTimeout(autosaveTimer); autosaveTimer = null }
}
const scheduleAutosave = () => {
  if (loading.value || isPublished.value) return // don't schedule off of the initial fetch itself, or while locked
  flushAutosave()
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null
    syncQuiz(quiz.value.status, { silent: true })
  }, AUTOSAVE_DELAY_MS)
}

const setType = (q, type) => {
  q.question_type = type
  q.correct_answer = ''
  q.options = type === 'number_input' ? [] : ['', '', '', '']
  scheduleAutosave()
}
const addQuestion = async () => {
  const q = blankQuestion()
  // Inserted at the top of whatever page you're currently viewing (not
  // appended to the true end) — so adding one never navigates you away from
  // where you are. This is a purely local reordering: everything after it,
  // including later pages, shifts down by one, and its real order_number
  // (computed server-side as max+1 on save) is decided fresh at save time
  // regardless of where it happened to sit in this session's view.
  const insertAt = (editorPage.value - 1) * EDITOR_PAGE_SIZE
  quiz.value.questions.splice(insertAt, 0, q)
  totalCount.value += 1
  // Land the teacher straight in the new question's prompt field instead of
  // making them scroll down and click into it themselves.
  await nextTick()
  promptRefs.get(q.id)?.focus()
}
const removeQuestion = (i) => {
  quiz.value.questions.splice(i, 1)
  totalCount.value = Math.max(0, totalCount.value - 1)
  if (editorPage.value > editorTotalPages.value) editorPage.value = editorTotalPages.value
  scheduleAutosave()
}
const addOption = (q) => { q.options.push(''); scheduleAutosave() }
const removeOption = (q, oi) => { q.options.splice(oi, 1); scheduleAutosave() }

// The actual create/update/delete diff, shared by autosave and the explicit
// Save/Publish buttons. `silent` suppresses the success/error banner —
// autosave failing quietly once isn't worth interrupting typing over; the
// next successful autosave (or an explicit Save) clears it up.
const syncQuiz = async (status, { silent = false } = {}) => {
  if (!quiz.value.title.trim()) {
    if (!silent) error.value = 'Give the quiz a title.'
    return
  }
  if (silent) autosaving.value = true
  else { saving.value = true; error.value = null; msg.value = null }
  try {
    const metadata = {
      course_id: props.courseId,
      lesson_id: props.lessonId,
      unit_id: props.unitId,
      title: quiz.value.title.trim(),
      pass_percentage: quiz.value.pass_percentage,
      time_limit: quiz.value.time_limit,
      status,
    }
    if (!quiz.value.id) {
      const created = await quizService.createQuiz(metadata)
      quiz.value.id = created?.id || created?.data?.id
    } else {
      await quizService.updateQuiz(quiz.value.id, metadata)
    }

    const validQuestions = quiz.value.questions.filter((q) => q.question.trim())

    // Deletions: anything the server is known to have (originalById) that no
    // longer appears among the current, non-blank questions — covers an
    // explicit Remove and a question blanked back to empty text. A question
    // on a page never paged to was never added to originalById, so it's
    // never treated as deleted.
    const currentIds = new Set(validQuestions.map((q) => q.id).filter((id) => typeof id === 'string'))
    for (const id of [...originalById.keys()]) {
      if (!currentIds.has(id)) {
        await quizService.deleteQuizQuestion(quiz.value.id, id)
        originalById.delete(id)
      }
    }

    for (const q of validQuestions) {
      if (typeof q.id !== 'string') {
        const createdQ = await quizService.addQuizQuestion(quiz.value.id, serializeQuestion(q))
        q.id = createdQ.id
        originalById.set(q.id, snapshotOf(q))
      } else if (originalById.get(q.id) !== snapshotOf(q)) {
        await quizService.updateQuizQuestion(quiz.value.id, q.id, serializeQuestion(q))
        originalById.set(q.id, snapshotOf(q))
      }
    }

    quiz.value.status = status
    lastSavedAt.value = new Date()
    if (!silent) msg.value = status === 'published' ? 'Published.' : 'Draft saved.'
    emit('change')
  } catch (err) {
    const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Save failed'
    error.value = silent ? `Auto-save failed — ${message}` : message
  } finally {
    if (silent) autosaving.value = false
    else saving.value = false
  }
}

const save = async (status) => {
  flushAutosave()
  await syncQuiz(status, { silent: false })
}

const csvInput = ref(null)
const importing = ref(false)
const importCsv = async (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  importing.value = true
  error.value = null
  try {
    if (!quiz.value.id) {
      if (!quiz.value.title.trim()) { error.value = 'Give the quiz a title before importing.'; return }
      const created = await quizService.createQuiz({
        course_id: props.courseId, lesson_id: props.lessonId, unit_id: props.unitId,
        title: quiz.value.title.trim(), pass_percentage: quiz.value.pass_percentage,
        time_limit: quiz.value.time_limit, status: 'draft',
      })
      quiz.value.id = created?.id || created?.data?.id
    }
    const res = await quizService.importQuestionsFromCsv(quiz.value.id, file)
    const rows = (res?.data?.questions || res?.questions || []).map(mapQuestion)
    rows.forEach((q) => originalById.set(q.id, snapshotOf(q))) // already persisted by the import endpoint
    const onlyBlank = quiz.value.questions.length === 1 && !quiz.value.questions[0].question.trim()
    quiz.value.questions = onlyBlank ? rows : [...quiz.value.questions, ...rows]
    totalCount.value = onlyBlank ? rows.length : totalCount.value + rows.length
    editorPage.value = editorTotalPages.value
    msg.value = `${rows.length} question(s) imported.`
  } catch (err) {
    const rowErrors = err?.response?.data?.data?.rowErrors
    error.value = rowErrors?.length
      ? 'CSV: ' + rowErrors.slice(0, 4).map((r) => `row ${r.row}: ${r.error}`).join('; ')
      : (err.response?.data?.error || err.message || 'Import failed')
  } finally {
    importing.value = false
  }
}

const downloadTemplate = async () => {
  try {
    const blob = await quizService.downloadQuestionsCsvTemplate()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'quiz_questions_template.csv'; a.click()
    URL.revokeObjectURL(url)
  } catch { /* ignore */ }
}

// "+ New Question" / "Import CSV" / "Template" collapse into one dropdown
// menu instead of three separate buttons.
const addMenuOpen = ref(false)
const closeAddMenuOnOutsideClick = (e) => {
  if (!e.target.closest('.add-question-menu')) addMenuOpen.value = false
}
watch(addMenuOpen, (open) => {
  if (open) document.addEventListener('click', closeAddMenuOnOutsideClick)
  else document.removeEventListener('click', closeAddMenuOnOutsideClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeAddMenuOnOutsideClick)
  if (searchTimer) clearTimeout(searchTimer)
})
const chooseAddMenu = (action) => {
  addMenuOpen.value = false
  if (action === 'question') addQuestion()
  else if (action === 'csv') csvInput.value?.click()
  else if (action === 'template') downloadTemplate()
}

const showDeleteQuizModal = ref(false)
const deletingQuiz = ref(false)
const deleteQuizError = ref('')
const askRemoveQuiz = () => {
  if (!quiz.value.id) return
  deleteQuizError.value = ''
  showDeleteQuizModal.value = true
}
const closeDeleteQuizModal = () => {
  if (deletingQuiz.value) return
  showDeleteQuizModal.value = false
}
const confirmRemoveQuiz = async () => {
  flushAutosave()
  deletingQuiz.value = true
  deleteQuizError.value = ''
  try {
    await quizService.deleteQuiz(quiz.value.id)
    quiz.value = {
      id: null, course_id: props.courseId, lesson_id: props.lessonId, unit_id: props.unitId,
      title: props.unitTitle ? `${props.unitTitle} — Practice` : 'Practice',
      pass_percentage: 70, time_limit: 15, status: 'draft', questions: [blankQuestion()],
    }
    editorPage.value = 1
    totalCount.value = 0
    originalById.clear()
    lastSavedAt.value = null
    showDeleteQuizModal.value = false
    emit('change')
  } catch (err) {
    deleteQuizError.value = err.response?.data?.error || err.message || 'Delete failed'
  } finally {
    deletingQuiz.value = false
  }
}

watch(() => props.unitId, load, { immediate: true })

const fieldCls =
  'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#033B26] dark:focus:border-emerald-500'
const miniSelect =
  'px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:border-[#033B26] dark:focus:border-emerald-500'
// Borderless — used inside an already-bordered answer-choice/explanation
// card so the field reads as plain text until you click into it, instead of
// stacking a second box border inside the row.
const optionFieldCls =
  'w-full bg-transparent border-0 focus:outline-none text-sm text-slate-800 dark:text-slate-100 py-0.5'
</script>

<template>
  <div>
    <p v-if="loading" class="text-xs text-slate-500 dark:text-slate-400">Checking…</p>
    <p v-if="msg" class="text-xs text-[#033B26] dark:text-emerald-400 mb-2">{{ msg }}</p>
    <p v-if="error" class="text-xs text-red-600 mb-2">{{ error }}</p>

    <!-- Inline editor -->
    <div v-if="!loading" class="space-y-4">
      <!-- Status / actions bar. Published is locked to a single Unpublish
           action; unpublished (draft) keeps both Save Draft and Publish. -->
      <div class="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <span
          class="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
          :class="isPublished ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-emerald-50 dark:bg-emerald-900/30 text-[#033B26] dark:text-emerald-400'"
        >
          <span class="w-2 h-2 rounded-full shrink-0" :class="isPublished ? 'bg-slate-400' : autosaving ? 'bg-amber-400 animate-pulse' : 'bg-[#033B26] dark:bg-emerald-400'"></span>
          <template v-if="isPublished">Published — locked for editing</template>
          <template v-else>Auto-save: {{ autosaving ? 'Saving…' : 'Active' }}</template>
        </span>
        <span v-if="lastSavedLabel" class="text-xs text-slate-400">Last saved at {{ lastSavedLabel }}</span>

        <span class="flex flex-wrap items-center gap-2 sm:ml-auto">
          <button
            v-if="isPublished"
            type="button"
            :disabled="saving"
            class="px-4 py-2 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold disabled:opacity-50"
            @click="save('draft')"
          >
            {{ saving ? 'Unpublishing…' : 'Unpublish to edit' }}
          </button>
          <template v-else>
            <button
              type="button"
              :disabled="saving"
              class="px-4 py-2 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold disabled:opacity-50"
              @click="save('draft')"
            >
              {{ saving ? 'Saving…' : 'Save Draft' }}
            </button>
            <button
              type="button"
              :disabled="saving"
              class="px-4 py-2 rounded-xl bg-[#033B26] hover:bg-[#022819] text-white text-xs font-bold disabled:opacity-50"
              @click="save('published')"
            >
              {{ saving ? 'Publishing…' : 'Publish' }}
            </button>
          </template>
          <button v-if="quiz.id" type="button" class="px-3 py-2 rounded-xl text-red-600 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20" @click="askRemoveQuiz">
            Delete Quiz
          </button>
        </span>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0">T</span>
          <input
            v-model="quiz.title"
            type="text"
            placeholder="Quiz title"
            :disabled="isPublished"
            class="min-w-0 flex-1 bg-transparent border-0 focus:outline-none text-sm font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-70 disabled:cursor-not-allowed"
            @input="scheduleAutosave"
          />
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <label class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Pass:
            <input v-model.number="quiz.pass_percentage" type="number" min="0" max="100" :disabled="isPublished" class="w-9 bg-transparent border-0 focus:outline-none text-slate-700 dark:text-slate-200 disabled:opacity-70" @input="scheduleAutosave" />%
          </label>
          <label class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Time:
            <input v-model.number="quiz.time_limit" type="number" min="1" :disabled="isPublished" class="w-9 bg-transparent border-0 focus:outline-none text-slate-700 dark:text-slate-200 disabled:opacity-70" @input="scheduleAutosave" />min
          </label>
        </div>
      </div>

      <!-- Search the bank by prompt text — a debounced server search (not
           just what's loaded locally), jump-to-result loads whatever page
           the match lives on. -->
      <div v-if="quiz.id" class="relative">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search questions by text or LaTeX…"
            class="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#033B26] dark:focus:border-emerald-500"
            @keydown.enter.prevent="onSearchEnter"
            @keydown.esc="clearSearch"
          />
          <button
            v-if="searchQuery"
            type="button"
            title="Clear search"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs"
            @click="clearSearch"
          >✕</button>
        </div>

        <div
          v-if="searchQuery.trim()"
          class="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg max-h-80 overflow-y-auto z-20"
        >
          <p v-if="searching" class="px-3.5 py-3 text-xs text-slate-400">Searching…</p>
          <p v-else-if="searchResults.length === 0" class="px-3.5 py-3 text-xs text-slate-400">No matching questions.</p>
          <template v-else>
            <button
              v-for="m in searchResults"
              :key="m.id"
              type="button"
              class="w-full flex items-start gap-2.5 text-left px-3.5 py-2.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition border-b border-slate-100 dark:border-slate-800 last:border-0"
              @click="jumpToMatch(m)"
            >
              <span class="shrink-0 font-bold text-slate-400 mt-0.5">Q{{ m.order_number }}</span>
              <span class="text-slate-700 dark:text-slate-300 line-clamp-2 search-snippet" v-html="searchSnippet(m.question)"></span>
            </button>
          </template>
        </div>
      </div>

      <!-- Navigator: Prev / jump-to pills (centered on the current page) /
           Next, plus the add/import actions on the same row. Jumping to a
           page fetches any pages in between on demand (see goToPage()). -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div v-if="editorTotalPages > 1" class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            :disabled="editorPage === 1 || pageLoading"
            class="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
            @click="goBack"
          >
            ‹ Prev
          </button>
          <button
            v-for="p in pageWindow.pills"
            :key="p"
            type="button"
            :disabled="pageLoading"
            class="w-7 h-7 rounded-lg text-xs font-bold transition disabled:opacity-40"
            :class="p === editorPage
              ? 'bg-[#033B26] text-white'
              : 'text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'"
            @click="goToPage(p)"
          >
            {{ p }}
          </button>
          <button
            type="button"
            :disabled="editorPage === editorTotalPages || pageLoading"
            class="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
            @click="goNext"
          >
            {{ pageLoading ? 'Loading…' : 'Next ›' }}
          </button>
          <span class="text-xs text-slate-400 ml-1 whitespace-nowrap">(Question {{ editorPage }} of {{ totalCount }})</span>
        </div>
        <div v-else class="text-xs text-slate-400">{{ totalCount }} question{{ totalCount === 1 ? '' : 's' }}</div>

        <div v-if="!isPublished" class="relative add-question-menu">
          <input ref="csvInput" type="file" accept=".csv,text/csv" class="hidden" @change="importCsv" />
          <button
            type="button"
            :disabled="importing || pageLoading"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#033B26] hover:bg-[#022819] text-white text-xs font-bold disabled:opacity-50"
            @click="addMenuOpen = !addMenuOpen"
          >
            <span class="text-sm leading-none">+</span> {{ importing ? 'Importing…' : pageLoading ? 'Loading…' : 'Add Questions' }}
            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>
          </button>

          <div
            v-if="addMenuOpen"
            class="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden py-1 z-20"
          >
            <button type="button" class="w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition" @click="chooseAddMenu('question')">
              <span>➕</span> Add Question
            </button>
            <button type="button" class="w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition" @click="chooseAddMenu('csv')">
              <span>📄</span> Upload CSV
            </button>
            <button type="button" class="w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition" @click="chooseAddMenu('template')">
              <span>⬇</span> Download CSV Template
            </button>
          </div>
        </div>
      </div>

      <!-- Questions — one page of EDITOR_PAGE_SIZE at a time; add/remove/import
           still act on the full quiz.questions array by its real index. -->
      <div
        v-for="{ q, index } in pagedQuestions"
        :id="`q-${q.id}`"
        :key="q.id"
        class="rounded-2xl border bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4 transition-colors duration-500"
        :class="highlightId === q.id
          ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-300/60 dark:ring-amber-500/40'
          : 'border-slate-200 dark:border-slate-800'"
      >
        <div class="flex items-center gap-2 flex-wrap">
          <span class="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold">
            Question {{ String(index + 1).padStart(2, '0') }}
          </span>
          <select :value="q.question_type" :disabled="isPublished" @change="setType(q, $event.target.value)" :class="[miniSelect, isPublished && 'opacity-70 cursor-not-allowed']">
            <option value="QCM">Multiple Choice</option>
            <option value="number_input">Number Input</option>
          </select>
          <select
            :value="q.difficulty"
            :disabled="isPublished"
            @change="q.difficulty = $event.target.value; scheduleAutosave()"
            :class="['px-2 py-1 rounded-lg border text-xs font-bold focus:outline-none', tierBadgeClass(q.difficulty), isPublished && 'opacity-70 cursor-not-allowed']"
          >
            <option v-for="t in TIERS" :key="t" :value="t">{{ t }}</option>
          </select>
          <span v-if="!isPublished" class="ml-auto flex items-center gap-1">
            <button v-if="quiz.questions.length > 1" type="button" title="Remove question" class="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition" @click="removeQuestion(index)">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </span>
        </div>

        <div>
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <label class="text-[11px] font-bold text-slate-400 uppercase">Question Prompt</label>
            <span v-if="!isPublished" class="flex items-center gap-1">
              <button
                type="button"
                title="Insert a formula"
                class="w-6 h-6 rounded-md text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                @click="promptRefs.get(q.id)?.openToolbar()"
              >fx</button>
              <button
                type="button"
                title="Insert a square root"
                class="w-6 h-6 rounded-md text-xs font-bold text-[#033B26] dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                @click="promptRefs.get(q.id)?.insertSqrt()"
              >√</button>
            </span>
          </div>
          <MathInput
            :ref="(el) => setPromptRef(q.id, el)"
            v-model="q.question"
            multiline
            :rows="3"
            :disabled="isPublished"
            placeholder="Question… (wrap math in $…$)"
            :input-class="fieldCls"
            @update:model-value="scheduleAutosave"
          />
        </div>

        <!-- QCM options -->
        <div v-if="q.question_type !== 'number_input'">
          <label class="block text-[11px] font-bold text-slate-400 uppercase mb-2">
            Answer Choices <span class="normal-case font-medium text-slate-400">(select correct choice)</span>
          </label>
          <div class="space-y-2.5">
            <div
              v-for="(opt, oi) in q.options"
              :key="oi"
              class="flex items-center gap-3 rounded-2xl border bg-white dark:bg-slate-900 px-4 py-3 shadow-xs transition"
              :class="q.correct_answer === opt && opt !== ''
                ? 'border-[#033B26] dark:border-emerald-400'
                : 'border-slate-200 dark:border-slate-800'"
            >
              <button
                type="button"
                :disabled="isPublished"
                class="w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center transition disabled:cursor-not-allowed"
                :class="q.correct_answer === opt && opt !== ''
                  ? 'bg-[#033B26] border-[#033B26]'
                  : 'border-slate-300 dark:border-slate-600'"
                :aria-label="`Mark option ${String.fromCharCode(65 + oi)} correct`"
                @click="q.correct_answer = opt; scheduleAutosave()"
              >
                <span v-if="q.correct_answer === opt && opt !== ''" class="w-2 h-2 rounded-full bg-white"></span>
              </button>
              <span class="text-xs font-bold text-slate-400 w-4 shrink-0">{{ String.fromCharCode(65 + oi) }}.</span>
              <MathInput v-model="q.options[oi]" :placeholder="`Option ${oi + 1}`" :disabled="isPublished" :input-class="optionFieldCls" class="flex-1" @update:model-value="scheduleAutosave" />
              <span v-if="q.correct_answer === opt && opt !== ''" class="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#033B26] text-white whitespace-nowrap">✓ Correct Answer</span>
              <button v-if="!isPublished && q.options.length > 2" type="button" class="shrink-0 text-slate-400 hover:text-red-500 text-xs" @click="removeOption(q, oi)">✕</button>
            </div>
          </div>
          <button
            v-if="!isPublished && q.options.length < 6"
            type="button"
            class="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#033B26] dark:text-emerald-400 hover:underline"
            @click="addOption(q)"
          >
            <span class="w-4 h-4 rounded-full border-2 border-[#033B26] dark:border-emerald-400 flex items-center justify-center text-[10px] leading-none">+</span>
            Add Answer Option
          </button>
        </div>

        <!-- Numeric answer -->
        <div v-else>
          <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1">Correct answer (number)</label>
          <input v-model="q.correct_answer" type="text" inputmode="decimal" placeholder="e.g. 1955" :disabled="isPublished" class="w-40 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm disabled:opacity-70 disabled:cursor-not-allowed" @input="scheduleAutosave" />
        </div>

        <div class="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
          <label class="flex items-center gap-1.5 text-[11px] font-bold text-[#033B26] dark:text-emerald-400 uppercase tracking-wide mb-2">
            📍 Explanation for Students
          </label>
          <div class="rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30 px-3 py-2">
            <MathInput v-model="q.explanation" multiline :rows="2" placeholder="Explanation (optional)" :disabled="isPublished" :input-class="optionFieldCls" @update:model-value="scheduleAutosave" />
          </div>
          <p class="flex items-center gap-1 text-[10px] text-[#033B26]/70 dark:text-emerald-400/60 mt-2">
            👁 This explanation is visible to students after submitting or reviewing the quiz.
          </p>
        </div>
      </div>

    </div>

    <ConfirmModal
      v-if="showDeleteQuizModal"
      title="Delete this quiz?"
      message="This will permanently delete this unit's practice quiz and all its questions. This action cannot be undone."
      confirm-label="Delete Quiz"
      :loading="deletingQuiz"
      :error="deleteQuizError"
      @close="closeDeleteQuizModal"
      @confirm="confirmRemoveQuiz"
    />
  </div>
</template>

<style>
/* v-html content (search-result snippets) — keep inline math sized to match
   the surrounding text instead of KaTeX's default, slightly larger metrics. */
.search-snippet .katex { font-size: 1em; }
.search-snippet p { display: inline; margin: 0; }
</style>

<template>
  <div class="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors">
    <Sidebar class="hidden md:flex shrink-0 h-full" />

    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <Header class="shrink-0">
        <template #left>
          <Breadcrumb :items="breadcrumbItems" />
        </template>
      </Header>

      <main class="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10 text-slate-900 dark:text-slate-100">
    <div class="max-w-4xl mx-auto space-y-6 text-left">

      <!-- Feedback Messages -->
      <div v-if="errorMessage" class="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex justify-between items-center">
        <span>⚠️ {{ errorMessage }}</span>
        <button @click="errorMessage = ''" class="text-xs font-bold px-2">✕</button>
      </div>

      <div v-if="successMessage" class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex justify-between items-center">
        <span>✅ {{ successMessage }}</span>
        <button @click="successMessage = ''" class="text-xs font-bold px-2">✕</button>
      </div>

      <!-- Top Actions Bar -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-3">
          <button
            @click="goBack"
            class="px-3 py-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            ← Back
          </button>

          <span
            :class="[
              'px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider',
              assignment.status === 'published'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
            ]"
          >
            ● {{ assignment.status }}
          </span>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-xs text-slate-400">
            <template v-if="saving">Saving...</template>
            <template v-else-if="lastSaved">Saved {{ lastSaved }}</template>
          </span>

          <template v-if="assignment.status === 'published'">
            <button
              @click="save('published')"
              :disabled="saving"
              class="px-5 py-2 rounded-xl bg-[#006A3A] hover:bg-[#005A31] text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : 'Save changes' }}
            </button>
          </template>
          <template v-else>
            <button
              @click="save('draft')"
              :disabled="saving"
              class="px-4 py-2 rounded-xl bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              <span v-if="saving" class="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full"></span>
              {{ saving ? 'Saving...' : 'Save Draft' }}
            </button>

            <button
              @click="save('published')"
              :disabled="saving"
              class="px-5 py-2 rounded-xl bg-[#006A3A] hover:bg-[#005A31] text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
            >
              Publish
            </button>
          </template>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="p-8 text-center text-xs text-slate-500 dark:text-slate-400">Loading assignment…</div>

      <template v-else>
        <!-- Assignment Details -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Assignment Details</h2>

          <p class="text-xs text-slate-500 dark:text-slate-400">
            Multiple choice — students answer questions below and are scored automatically.
          </p>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Title *</label>
            <input
              v-model="assignment.title"
              type="text"
              placeholder="e.g. Essay: French colonial administration"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Instructions</label>
            <textarea
              v-model="assignment.description"
              rows="4"
              placeholder="What should students do? Length, format, what to submit…"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-600 resize-y"
            ></textarea>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Due date <span class="font-medium text-slate-400">(optional)</span>
              </label>
              <input
                v-model="dueDateLocal"
                type="datetime-local"
                class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Points</label>
              <input
                v-model.number="assignment.points"
                type="number"
                min="1"
                class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        </div>

        <!-- Questions Section (quiz-type only) -->
        <div v-if="assignment.type === 'quiz'" class="space-y-4">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Questions ({{ questions.length }})</h3>
            <div v-if="!locked" class="flex items-center gap-2">
              <button
                type="button"
                @click="downloadTemplate"
                class="text-xs text-slate-500 dark:text-slate-400 font-bold hover:underline cursor-pointer"
              >
                Download CSV Template
              </button>
              <input ref="csvInputRef" type="file" accept=".csv,text/csv" class="hidden" @change="importCsv" />
              <button
                type="button"
                :disabled="importing"
                @click="csvInputRef?.click()"
                class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                {{ importing ? 'Importing…' : 'Import CSV' }}
              </button>
              <button
                type="button"
                @click="addQuestion"
                class="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-slate-800 text-[#006A3A] dark:text-emerald-400 border border-emerald-200 dark:border-slate-700 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
              >
                + Add Question
              </button>
            </div>
          </div>
          <p v-if="importMsg" class="text-xs text-emerald-700 dark:text-emerald-400">{{ importMsg }}</p>

          <div
            v-if="locked"
            class="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 text-xs text-amber-800 dark:text-amber-300"
          >
            Questions are locked — a student has already submitted this assignment.
          </div>

          <div
            v-for="(q, index) in questions"
            :key="q.id"
            class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4"
          >
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300">
                Question {{ index + 1 }}
              </span>
              <button
                v-if="!locked && questions.length > 1"
                type="button"
                title="Remove question"
                class="ml-auto p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition cursor-pointer"
                @click="removeQuestion(index)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>

            <MathInput
              v-model="q.question"
              multiline
              :rows="3"
              :disabled="locked"
              placeholder="Question… (wrap math in $…$)"
              input-class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-600"
            />

            <div>
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Answer Choices <span class="normal-case font-medium text-slate-400">(select correct choice)</span>
              </label>
              <div class="space-y-2.5">
                <div
                  v-for="(opt, oi) in q.options"
                  :key="oi"
                  class="flex items-center gap-3 rounded-2xl border bg-white dark:bg-slate-900 px-4 py-3 shadow-xs transition"
                  :class="q.correct_answer === opt && opt !== ''
                    ? 'border-[#006A3A] dark:border-emerald-400'
                    : 'border-slate-200 dark:border-slate-800'"
                >
                  <button
                    type="button"
                    :disabled="locked"
                    class="w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center transition disabled:cursor-not-allowed"
                    :class="q.correct_answer === opt && opt !== ''
                      ? 'bg-[#006A3A] border-[#006A3A]'
                      : 'border-slate-300 dark:border-slate-600'"
                    :aria-label="`Mark option ${String.fromCharCode(65 + oi)} correct`"
                    @click="q.correct_answer = opt"
                  >
                    <span v-if="q.correct_answer === opt && opt !== ''" class="w-2 h-2 rounded-full bg-white"></span>
                  </button>
                  <span class="text-xs font-bold text-slate-400 w-4 shrink-0">{{ String.fromCharCode(65 + oi) }}.</span>
                  <MathInput v-model="q.options[oi]" :placeholder="`Option ${oi + 1}`" :disabled="locked" input-class="w-full bg-transparent border-0 focus:outline-none text-sm text-slate-800 dark:text-slate-100 py-0.5" class="flex-1" />
                  <span v-if="q.correct_answer === opt && opt !== ''" class="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#006A3A] text-white whitespace-nowrap">✓ Correct</span>
                  <button v-if="!locked && q.options.length > 2" type="button" class="shrink-0 text-slate-400 hover:text-red-500 text-xs" @click="removeOption(q, oi)">✕</button>
                </div>
              </div>
              <button
                v-if="!locked && q.options.length < 6"
                type="button"
                class="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#006A3A] dark:text-emerald-400 hover:underline"
                @click="addOption(q)"
              >
                <span class="w-4 h-4 rounded-full border-2 border-[#006A3A] dark:border-emerald-400 flex items-center justify-center text-[10px] leading-none">+</span>
                Add Answer Option
              </button>
            </div>

            <div class="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
              <label class="flex items-center gap-1.5 text-[11px] font-bold text-[#006A3A] dark:text-emerald-400 uppercase tracking-wide mb-2">
                📍 Explanation for Students
              </label>
              <div class="rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30 px-3 py-2">
                <MathInput v-model="q.explanation" multiline :rows="2" placeholder="Explanation (optional)" :disabled="locked" input-class="w-full bg-transparent border-0 focus:outline-none text-sm text-slate-800 dark:text-slate-100 py-0.5" />
              </div>
            </div>
          </div>

          <button
            v-if="!locked"
            type="button"
            class="w-full py-3 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-500 dark:text-slate-400 hover:border-[#006A3A] hover:text-[#006A3A] dark:hover:border-emerald-400 dark:hover:text-emerald-400 transition"
            @click="addQuestion"
          >
            + Add Question
          </button>
        </div>
      </template>
    </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { assignmentService } from '@/services/assignmentService'
import MathInput from '@/components/ui/MathInput.vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'
import Breadcrumb from '@/components/layout/Breadcrumb.vue'

const route = useRoute()
const router = useRouter()

const courseId = route.params.courseId
const editId = route.params.id || null

// CourseDetailView passes its course title along as a query param so this
// breadcrumb doesn't need its own fetch just to show "My Classes / <class> / …".
const breadcrumbItems = computed(() => [
  { label: 'My Classes', to: '/' },
  { label: route.query.courseTitle || 'Class', to: `/courses/${courseId}` },
  { label: assignment.value.title || (editId ? 'Edit Assignment' : 'New Assignment') },
])

const loading = ref(!!editId)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const lastSaved = ref('')

const assignment = ref({
  id: null,
  title: '',
  description: '',
  // 'quiz' only for new assignments — file-type is legacy (still editable
  // here if one already exists) but no longer offered on creation.
  type: 'quiz',
  status: 'draft', // 'draft' | 'published'
  points: 100,
})
const dueDateLocal = ref('') // bound to the datetime-local input

// `datetime-local` wants "YYYY-MM-DDTHH:mm" in local time.
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Quiz-type only: the question bank.
const questions = ref([])
// Ids present when the page loaded — anything else in `questions` on save
// is new; anything in here but missing from `questions` was deleted.
const savedIds = ref(new Set())
const blankQuestion = () => ({
  id: `local-${Date.now()}-${Math.random()}`,
  question: '',
  options: ['', '', '', ''],
  correct_answer: '',
  explanation: '',
})

// Once any student has submitted, the question bank locks server-side too
// (see assertQuestionsEditable in assignments.routes.js) — mirrored here so
// the inputs read-only instead of failing on save.
const roster = ref([])
const submissions = ref([])
const locked = computed(() => {
  if (!assignment.value.id) return false
  return roster.value.some(r => r.submission) || submissions.value.length > 0
})

const canPublishQuiz = computed(() =>
  questions.value.length > 0 &&
  questions.value.every(q => q.question.trim() && q.correct_answer && q.options.filter(o => o.trim()).length >= 2)
)

const load = async () => {
  if (!editId) return
  loading.value = true
  errorMessage.value = ''
  try {
    const a = await assignmentService.getAssignment(editId)
    if (!a) { errorMessage.value = 'Assignment not found.'; return }
    assignment.value = {
      id: a.id,
      title: a.title || '',
      description: a.description || '',
      type: a.type === 'quiz' ? 'quiz' : 'file',
      status: a.status === 'published' ? 'published' : 'draft',
      points: Number.isFinite(Number(a.points)) && Number(a.points) > 0 ? Number(a.points) : 100,
    }
    dueDateLocal.value = toLocalInput(a.due_date)
    roster.value = a.roster || []
    submissions.value = a.submissions || []
    if (assignment.value.type === 'quiz') {
      const qs = (a.questions || []).map(q => ({ ...q, options: Array.isArray(q.options) ? [...q.options] : [] }))
      questions.value = qs.length ? qs : [blankQuestion()]
      savedIds.value = new Set(qs.map(q => q.id))
    }
  } catch (err) {
    errorMessage.value = err.response?.data?.error || err.message || 'Failed to load assignment.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const addQuestion = () => { questions.value.push(blankQuestion()) }
const removeQuestion = (index) => { questions.value.splice(index, 1) }
const addOption = (q) => { if (q.options.length < 6) q.options.push('') }
const removeOption = (q, oi) => {
  if (q.correct_answer === q.options[oi]) q.correct_answer = ''
  q.options.splice(oi, 1)
}

const csvInputRef = ref(null)
const importing = ref(false)
const importMsg = ref('')

// CSV import persists straight to the server (see assignments.routes.js
// POST /:id/questions/import), so it needs the assignment to already exist —
// save a draft first if this is a brand-new assignment.
const importCsv = async (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (!assignment.value.id) {
    errorMessage.value = 'Save this as a draft first, then import questions.'
    return
  }
  importing.value = true
  errorMessage.value = ''
  importMsg.value = ''
  try {
    const res = await assignmentService.importAssignmentQuestionsFromCsv(assignment.value.id, file)
    const rows = (res?.data?.questions || res?.questions || []).map(q => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : [],
    }))
    rows.forEach(q => savedIds.value.add(q.id))
    const onlyBlank = questions.value.length === 1 && !questions.value[0].question.trim()
    questions.value = onlyBlank ? rows : [...questions.value, ...rows]
    importMsg.value = `${rows.length} question(s) imported.`
    setTimeout(() => { importMsg.value = '' }, 6000)
  } catch (err) {
    const rowErrors = err.response?.data?.data?.rowErrors
    errorMessage.value = rowErrors?.length
      ? 'CSV: ' + rowErrors.slice(0, 4).map(r => `row ${r.row}: ${r.error}`).join('; ')
      : (err.response?.data?.error || err.message || 'Import failed')
  } finally {
    importing.value = false
  }
}

const downloadTemplate = async () => {
  try {
    const blob = await assignmentService.downloadAssignmentQuestionsCsvTemplate()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'assignment_questions_template.csv'; a.click()
    URL.revokeObjectURL(url)
  } catch { /* ignore */ }
}

// Persist question add/update/delete diffs against the (by now existing)
// assignment id — mirrors the old AssignmentQuestionEditorModal's save().
const saveQuestions = async (assignmentId) => {
  const currentIds = new Set(questions.value.map(q => q.id))
  const deletedIds = [...savedIds.value].filter(id => !currentIds.has(id))
  for (const id of deletedIds) {
    await assignmentService.deleteAssignmentQuestion(assignmentId, id)
  }
  for (const q of questions.value) {
    if (!q.question.trim()) continue // blank scratch row — draft-friendly, just skip it
    const payload = {
      question: q.question.trim(),
      options: q.options.map(o => o.trim()).filter(Boolean),
      correct_answer: q.correct_answer,
      explanation: q.explanation?.trim() || null,
    }
    if (savedIds.value.has(q.id)) {
      await assignmentService.updateAssignmentQuestion(assignmentId, q.id, payload)
    } else {
      const created = await assignmentService.addAssignmentQuestion(assignmentId, payload)
      if (created) {
        q.id = created.id
        savedIds.value.add(created.id)
      }
    }
  }
}

// `targetStatus` is 'draft' or 'published'. Publishing an already-published
// assignment (the "Save changes" button) just persists edits — the backend
// only notifies students on an actual draft → published transition.
const save = async (targetStatus) => {
  if (saving.value) return
  errorMessage.value = ''
  successMessage.value = ''

  if (!assignment.value.title.trim()) {
    errorMessage.value = 'Please enter a title before saving.'
    return
  }
  if (!(Number(assignment.value.points) > 0)) {
    errorMessage.value = 'Points must be a positive number.'
    return
  }
  if (targetStatus === 'published' && assignment.value.status !== 'published'
    && assignment.value.type === 'quiz' && !canPublishQuiz.value) {
    errorMessage.value = 'Add at least one complete question (with a correct answer and 2+ options) before publishing.'
    return
  }

  saving.value = true
  const wasPublished = assignment.value.status === 'published'
  try {
    const metaPayload = {
      title: assignment.value.title.trim(),
      description: assignment.value.description.trim(),
      due_date: dueDateLocal.value ? new Date(dueDateLocal.value).toISOString() : null,
      points: Math.round(Number(assignment.value.points)),
    }

    if (!assignment.value.id) {
      const created = await assignmentService.createAssignment({ course_id: courseId, type: assignment.value.type, ...metaPayload })
      if (!created) throw new Error('Failed to create assignment')
      assignment.value.id = created.id
      assignment.value.status = created.status || 'draft'
    } else if (!locked.value) {
      const updated = await assignmentService.updateAssignment(assignment.value.id, metaPayload)
      if (updated) assignment.value.status = updated.status
    }

    if (assignment.value.type === 'quiz' && !locked.value) {
      await saveQuestions(assignment.value.id)
    }

    // Publish is a second call so the backend's question-count guard checks
    // what's actually persisted (from the save above), not the form state.
    if (targetStatus === 'published' && assignment.value.status !== 'published') {
      const published = await assignmentService.updateAssignment(assignment.value.id, { status: 'published' })
      if (published) assignment.value.status = published.status
    }

    lastSaved.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    if (assignment.value.status === 'published' && !wasPublished) {
      alert('Assignment published — students have been notified.')
      goBack()
    } else {
      successMessage.value = wasPublished ? 'Changes saved.' : 'Draft saved.'
      setTimeout(() => { successMessage.value = '' }, 4000)
    }
  } catch (err) {
    errorMessage.value = err.response?.data?.error || err.message || 'Failed to save assignment.'
  } finally {
    saving.value = false
  }
}

const goBack = () => { router.back() }
</script>

<template>
  <div class="min-h-screen bg-[#f8fafd] dark:bg-slate-950 p-6 sm:p-10 text-slate-900 dark:text-slate-100 transition-colors">
    <div class="max-w-4xl mx-auto space-y-6 text-left">
      
      <!-- Feedback Messages (Error & Success Banners) -->
      <div v-if="errorMessage" class="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex justify-between items-center">
        <span>⚠️ {{ errorMessage }}</span>
        <button @click="errorMessage = ''" class="text-xs font-bold px-2">✕</button>
      </div>

      <div v-if="successMessage" class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex justify-between items-center">
        <span>✅ {{ successMessage }}</span>
        <button @click="successMessage = ''" class="text-xs font-bold px-2">✕</button>
      </div>

      <!-- Top Actions Bar -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button 
            @click="goBack" 
            class="px-3 py-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            ← Back
          </button>
          
          <!-- Status Badge -->
          <span 
            :class="[
              'px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider',
              quiz.status === 'published' 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800' 
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
            ]"
          >
            ● {{ quiz.status }}
          </span>
        </div>

        <div class="flex items-center gap-3">
          <!-- Real-time Save Status Indicator -->
          <span class="text-xs text-slate-400">
            <template v-if="saving">Saving...</template>
            <template v-else-if="lastSaved">Saved {{ lastSaved }}</template>
          </span>

          <button 
            @click="saveQuiz('draft')" 
            :disabled="saving"
            class="px-4 py-2 rounded-xl bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            <span v-if="saving" class="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full"></span>
            {{ saving ? 'Saving...' : 'Save Draft' }}
          </button>

          <button 
            @click="saveQuiz('published')" 
            :disabled="saving"
            class="px-5 py-2 rounded-xl bg-[#033B26] hover:bg-[#022819] text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
          >
            Publish Quiz
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
        {{ loadTotal > 0 ? `Loading ${loadedCount}/${loadTotal} questions…` : 'Loading quiz details...' }}
      </div>

      <template v-else>
        <!-- Quiz Form Details -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Quiz Details</h2>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Quiz Title *</label>
              <input
                v-model="quiz.title"
                type="text"
                placeholder="e.g., Chapter 1 Knowledge Assessment"
                class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                v-model="quiz.description"
                rows="2"
                placeholder="Add instructions or context..."
                class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-600"
              ></textarea>
            </div>

            <!-- Placement -->
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Attached to</label>

              <!-- Unit practice quiz: placement comes from where the teacher
                   opened this (the unit reader) — shown read-only. -->
              <div
                v-if="quiz.unit_id"
                class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-700 dark:text-slate-200"
              >
                Unit practice — <span class="font-semibold">{{ placementUnitTitle || 'this unit' }}</span>
                <span v-if="placementChapterTitle" class="text-slate-400"> · {{ placementChapterTitle }}</span>
              </div>

              <!-- Chapter quiz: pick which chapter (covers all its units). -->
              <select
                v-else
                v-model="quiz.lesson_id"
                :disabled="!!quiz.id"
                class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-600 disabled:opacity-60"
              >
                <option :value="null">— Course-wide (no chapter) —</option>
                <option v-for="l in lessons" :key="l.id" :value="l.id">{{ l.title }}</option>
              </select>

              <p v-if="quiz.id" class="text-[11px] text-slate-400 mt-1">Placement is fixed after the first save.</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Passing Grade (%)</label>
                <input
                  v-model.number="quiz.pass_percentage"
                  type="number"
                  min="0"
                  max="100"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Time Limit (Minutes)</label>
                <input
                  v-model.number="quiz.time_limit"
                  type="number"
                  min="1"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Questions Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Questions ({{ quiz.questions.length }})
            </h3>
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="downloadCsvTemplate"
                class="text-xs text-slate-500 dark:text-slate-400 font-bold hover:underline cursor-pointer"
              >
                Download CSV Template
              </button>

              <input
                ref="csvFileInput"
                type="file"
                accept=".csv,text/csv"
                class="hidden"
                @change="handleCsvFileChange"
              />
              <button
                type="button"
                @click="triggerCsvImport"
                :disabled="importingCsv"
                class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-200 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <span v-if="importingCsv" class="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full"></span>
                {{ importingCsv ? 'Importing...' : 'Import CSV' }}
              </button>

              <button
                @click="addQuestion"
                class="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-slate-800 text-[#033B26] dark:text-emerald-400 border border-emerald-200 dark:border-slate-700 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
              >
                + Add Question
              </button>
            </div>
          </div>

          <div
            v-for="{ q, index: qIndex } in pagedQuestions"
            :key="q.id"
            class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4 relative"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300">
                  Question {{ qIndex + 1 }}
                </span>
                <label class="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Tier
                  <select
                    v-model="q.difficulty"
                    class="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 text-xs font-semibold normal-case tracking-normal focus:outline-none focus:border-emerald-600"
                  >
                    <option v-for="t in TIERS" :key="t" :value="t">{{ t }}</option>
                  </select>
                </label>
                <label class="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Type
                  <select
                    :value="q.question_type"
                    @change="setQuestionType(q, $event.target.value)"
                    class="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 text-xs font-semibold normal-case tracking-normal focus:outline-none focus:border-emerald-600"
                  >
                    <option value="QCM">Multiple choice</option>
                    <option value="number_input">Number input</option>
                  </select>
                </label>
              </div>

              <button
                v-if="quiz.questions.length > 1"
                @click="removeQuestion(qIndex)"
                class="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition cursor-pointer"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>

            <MathInput
              v-model="q.question"
              placeholder="Enter question statement... (wrap math in $...$)"
              input-class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:border-emerald-600"
            />

            <!-- Options (multiple choice only) -->
            <div v-if="q.question_type !== 'number_input'" class="space-y-2 pt-2">
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Options (Select correct radio)
              </label>

              <div
                v-for="(opt, oIndex) in q.options"
                :key="oIndex"
                class="flex items-start gap-3"
              >
                <input
                  type="radio"
                  :name="`correct-${q.id}`"
                  :checked="q.correct_answer === opt"
                  @change="q.correct_answer = opt"
                  class="w-4 h-4 mt-3 shrink-0 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />

                <MathInput
                  v-model="q.options[oIndex]"
                  :placeholder="`Option ${oIndex + 1}`"
                  input-class="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-600"
                  class="flex-1"
                />

                <button
                  v-if="q.options.length > 2"
                  @click="removeOption(qIndex, oIndex)"
                  class="text-slate-400 hover:text-red-500 text-xs px-1 mt-3 shrink-0"
                >
                  ✕
                </button>
              </div>

              <button
                v-if="q.options.length < 6"
                @click="addOption(qIndex)"
                class="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline pt-1 cursor-pointer inline-block"
              >
                + Add Option
              </button>
            </div>

            <!-- Numeric answer (number input only) -->
            <div v-else class="space-y-1.5 pt-2">
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Correct answer (number)
              </label>
              <input
                v-model="q.correct_answer"
                type="text"
                inputmode="decimal"
                placeholder="e.g. 1955"
                class="w-48 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-600"
              />
              <p class="text-[11px] text-slate-400">The student's typed answer must match this exactly (spaces and commas are ignored).</p>
            </div>

            <!-- Explanation (shown to students after they answer) -->
            <div class="space-y-1.5 pt-2">
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Explanation <span class="normal-case font-medium text-slate-400">(optional — wrap math in $...$)</span>
              </label>
              <MathInput
                v-model="q.explanation"
                multiline
                :rows="3"
                placeholder="Explain why the correct answer is right... (wrap math in $...$)"
                input-class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-600 resize-y"
              />
            </div>
          </div>

          <!-- Pagination: Back / Next through the bank, EDITOR_PAGE_SIZE questions at a time -->
          <div v-if="editorTotalPages > 1" class="flex items-center justify-between gap-3">
            <button
              type="button"
              :disabled="editorPage === 1"
              class="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              @click="goToQuestionPage(editorPage - 1)"
            >
              Back
            </button>
            <span class="text-xs text-slate-500 dark:text-slate-400">
              Page {{ editorPage }} of {{ editorTotalPages }} ({{ quiz.questions.length }} questions)
            </span>
            <button
              type="button"
              :disabled="editorPage === editorTotalPages"
              class="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              @click="goToQuestionPage(editorPage + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { quizService } from '@/services/quizService'
import { lessonService } from '@/services/lessonService'
import { unitService } from '@/services/unitService'
import MathInput from '@/components/ui/MathInput.vue'
import { normalizeMath } from '@/utils/markdown'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
// A big bank is fetched page by page (quizService.fetchAllQuizQuestions) so
// one slow SELECT * doesn't block this screen — progress for the message above.
const loadedCount = ref(0)
const loadTotal = ref(0)
const saving = ref(false)
const lastSaved = ref('')
const errorMessage = ref('')
const successMessage = ref('')

// Extract courseId with fallbacks
const courseId = route.params.courseId || route.params.course_id || route.query.course_id || null
const quizId = route.params.quizId || route.params.id || null

const quiz = ref({
  id: quizId,
  course_id: courseId,
  lesson_id: route.query.lessonId || route.query.lesson_id || null,
  unit_id: route.query.unitId || route.query.unit_id || null,
  title: '',
  description: '',
  pass_percentage: 70,
  time_limit: 30,
  status: 'draft',
  questions: [
    {
      id: Date.now(),
      question: '',
      options: ['', '', '', ''],
      correct_answer: '',
      explanation: '',
      difficulty: 'Medium',
      question_type: 'QCM'
    }
  ]
})

const TIERS = ['Easy', 'Medium', 'Hard']

// The whole bank is loaded up front (Save PUTs it back as one array), but
// shown a page at a time so editing 100+ questions isn't one long scroll.
// Purely a display slice; add/remove/import still act on the full
// quiz.value.questions array by its real index.
const EDITOR_PAGE_SIZE = 10
const editorPage = ref(1)
const editorTotalPages = computed(() => Math.max(1, Math.ceil(quiz.value.questions.length / EDITOR_PAGE_SIZE)))
const pagedQuestions = computed(() => {
  const start = (editorPage.value - 1) * EDITOR_PAGE_SIZE
  return quiz.value.questions.slice(start, start + EDITOR_PAGE_SIZE).map((q, i) => ({ q, index: start + i }))
})
watch(() => quiz.value.questions.length, () => {
  if (editorPage.value > editorTotalPages.value) editorPage.value = editorTotalPages.value
})
const goToQuestionPage = (p) => { editorPage.value = Math.min(Math.max(p, 1), editorTotalPages.value) }

// quiz_questions.question_type is 'QCM' or 'number_input'. Older rows /
// CSV exports may carry aliases ('multiple_choice', 'numeric', 'MCQ-4', …) —
// fold everything down to the two canonical values.
const normType = (t) => {
  const k = String(t || '').toLowerCase().replace(/[\s_-]+/g, '')
  return ['numberinput', 'numeric', 'numericentry', 'number', 'num', 'input'].includes(k)
    ? 'number_input'
    : 'QCM'
}

// ── Chapter + Unit placement ─────────────────────────────────────────────
// A quiz belongs to a course, optionally a chapter (lesson_id), and optionally
// a unit within that chapter (unit_id). unit_id can only be set at create time
// (the PUT endpoint doesn't move a quiz), so pick it before the first save.
const lessons = ref([])
const units = ref([])
const loadingUnits = ref(false)

const placementUnitTitle = computed(() => {
  const u = units.value.find((x) => x.id === quiz.value.unit_id)
  return u ? `${u.order_number}. ${u.title}` : (route.query.unitTitle || '')
})
const placementChapterTitle = computed(() =>
  lessons.value.find((l) => l.id === quiz.value.lesson_id)?.title || '',
)

const loadLessons = async () => {
  const activeCourseId = quiz.value.course_id || courseId
  if (!activeCourseId) return
  try {
    const res = await lessonService.getCourseLessons(activeCourseId)
    lessons.value = res.data?.lessons || res.lessons || []
  } catch (err) {
    console.error('Failed to load chapters:', err)
  }
}

const loadUnits = async (lessonId) => {
  units.value = []
  if (!lessonId) {
    quiz.value.unit_id = null
    return
  }
  loadingUnits.value = true
  try {
    const res = await unitService.listUnits(lessonId)
    units.value = res.data?.units || []
    // Drop a stale unit selection that isn't in the chosen chapter.
    if (quiz.value.unit_id && !units.value.some((u) => u.id === quiz.value.unit_id)) {
      quiz.value.unit_id = null
    }
  } catch (err) {
    console.error('Failed to load units:', err)
  } finally {
    loadingUnits.value = false
  }
}

watch(() => quiz.value.lesson_id, (lessonId) => loadUnits(lessonId))

// Database Save Function (Triggered ONLY by manual button clicks)
const saveQuiz = async (targetStatus = quiz.value.status) => {
  if (saving.value) return
  
  // Reset alert states
  errorMessage.value = ''
  successMessage.value = ''

  // Client-side Validation check
  if (!quiz.value.title || quiz.value.title.trim() === '') {
    errorMessage.value = 'Please enter a Quiz Title before saving.'
    return
  }

  saving.value = true
  quiz.value.status = targetStatus

  try {
    let responseData
    if (quiz.value.id) {
      responseData = await quizService.updateQuiz(quiz.value.id, quiz.value)
    } else {
      const activeCourseId = quiz.value.course_id || courseId
      responseData = await quizService.createQuiz(activeCourseId, quiz.value)
      
      // Update ID locally so subsequent saves act as updates
      if (responseData && (responseData.id || responseData.data?.id)) {
        quiz.value.id = responseData.id || responseData.data.id
      }
    }

    const now = new Date()
    lastSaved.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    if (targetStatus === 'published') {
      alert('Quiz published successfully!')
      goBack()
    } else {
      successMessage.value = 'Draft saved successfully!'
      setTimeout(() => {
        successMessage.value = ''
      }, 4000)
    }
  } catch (error) {
    console.error('Failed to save quiz:', error)
    errorMessage.value = error?.response?.data?.message || error?.message || 'Failed to save quiz. Check browser console.'
  } finally {
    saving.value = false
  }
}

const addQuestion = () => {
  quiz.value.questions.push({
    id: Date.now(),
    question: '',
    options: ['', '', '', ''],
    correct_answer: '',
    explanation: '',
    difficulty: 'Medium',
    question_type: 'QCM'
  })
  editorPage.value = editorTotalPages.value // jump to the page holding the new question
}

const removeQuestion = (index) => {
  quiz.value.questions.splice(index, 1)
}

// Switch a question between multiple choice and number input, resetting the
// answer shape so we never send stale options / a stale correct_answer.
const setQuestionType = (q, type) => {
  q.question_type = type
  q.correct_answer = ''
  q.options = type === 'number_input' ? [] : ['', '', '', '']
}

const addOption = (qIndex) => {
  quiz.value.questions[qIndex].options.push('')
}

const removeOption = (qIndex, oIndex) => {
  quiz.value.questions[qIndex].options.splice(oIndex, 1)
}

// CSV Import
const csvFileInput = ref(null)
const importingCsv = ref(false)

// Some CSV exports (OCR'd from PDF worksheets) pack a garbled OCR line or two
// ahead of the one clean, hand-verified LaTeX expression for the same formula.
// Pull out just that LaTeX and wrap it in $...$ so MathInput/KaTeX renders it,
// instead of showing the raw OCR noise.
const LATEX_HINT = /\\(?:lim|frac|sqrt|sin|cos|tan|cot|csc|sec|ln|log|infty|to|int|sum|prod|left|right|text|cdot|times|div|leq|geq|neq|approx|pi|theta|alpha|beta|rightarrow)\b|\^\{|_\{/

const extractLatexField = (raw, { wrapDisplay = false } = {}) => {
  if (!raw) return raw
  const text = String(raw).trim()
  const wrap = (inner) => (wrapDisplay ? `$$${inner}$$` : `$${inner}$`)

  // Prefer an explicit $$...$$ or \[...\] block — the clean, verified LaTeX
  const displayMatch = text.match(/\$\$([\s\S]+?)\$\$/) || text.match(/\\\[([\s\S]+?)\\\]/)
  if (displayMatch) {
    return wrap(displayMatch[1].replace(/\s+/g, ' ').trim())
  }

  // Or an inline $...$ expression
  const inlineMatch = text.match(/\$([^$\n]+)\$/)
  if (inlineMatch) {
    return wrap(inlineMatch[1].trim())
  }

  // Otherwise scan lines bottom-up for the one that looks like real LaTeX
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (LATEX_HINT.test(lines[i])) {
      return wrap(lines[i])
    }
  }

  // No LaTeX found — fall back to the raw text, collapsed to one line
  return lines.join(' ')
}

const triggerCsvImport = () => {
  csvFileInput.value?.click()
}

const downloadCsvTemplate = async () => {
  try {
    const blob = await quizService.downloadQuestionsCsvTemplate()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'quiz_questions_template.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to download CSV template:', error)
    errorMessage.value = 'Failed to download CSV template.'
  }
}

const handleCsvFileChange = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = '' // allow re-selecting the same file later
  if (!file) return

  errorMessage.value = ''
  successMessage.value = ''
  importingCsv.value = true

  try {
    // Questions can only be imported into a quiz that already exists on the server
    if (!quiz.value.id) {
      if (!quiz.value.title || quiz.value.title.trim() === '') {
        errorMessage.value = 'Please enter a Quiz Title before importing questions.'
        return
      }
      const activeCourseId = quiz.value.course_id || courseId
      const created = await quizService.createQuiz(activeCourseId, quiz.value)
      quiz.value.id = created?.id || created?.data?.id
    }

    const result = await quizService.importQuestionsFromCsv(quiz.value.id, file)
    const imported = (result?.data?.questions || result?.questions || []).map(q => {
      const rawOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
      const type = normType(q.question_type)
      return {
        id: q.id,
        question: extractLatexField(normalizeMath(q.question), { wrapDisplay: true }),
        options: type === 'number_input' ? [] : (rawOptions || []).map(opt => extractLatexField(normalizeMath(opt))),
        correct_answer: type === 'number_input' ? String(q.correct_answer ?? '').trim() : extractLatexField(normalizeMath(q.correct_answer)),
        explanation: normalizeMath(q.explanation || ''),
        difficulty: q.difficulty || 'Medium',
        question_type: type
      }
    })

    // Replace the single blank starter question instead of leaving it dangling
    const isBlankDefault = quiz.value.questions.length === 1 && !quiz.value.questions[0].question
    const firstNewIndex = isBlankDefault ? 0 : quiz.value.questions.length
    if (isBlankDefault) {
      quiz.value.questions = imported
    } else {
      quiz.value.questions.push(...imported)
    }
    editorPage.value = Math.floor(firstNewIndex / EDITOR_PAGE_SIZE) + 1

    successMessage.value = `${imported.length} question(s) imported from CSV.`
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
  } catch (error) {
    console.error('Failed to import CSV questions:', error)
    const rowErrors = error?.response?.data?.data?.rowErrors
    if (rowErrors?.length) {
      errorMessage.value = 'CSV errors — ' + rowErrors.map(r => `Row ${r.row}: ${r.error}`).join('; ')
    } else {
      errorMessage.value = error?.response?.data?.error || error?.message || 'Failed to import questions from CSV.'
    }
  } finally {
    importingCsv.value = false
  }
}

const goBack = () => {
  router.back()
}

// Fetch existing quiz details if editing
onMounted(async () => {
  const editId = route.params.quizId || route.params.id
  if (editId) {
    loading.value = true
    loadedCount.value = 0
    loadTotal.value = 0
    editorPage.value = 1
    try {
      // Save PUTs the whole `questions` array back (replacing the bank), so
      // it must be fully loaded before this screen can be edited/saved —
      // pull all pages up front, showing progress for a big bank.
      const data = await quizService.fetchAllQuizQuestions(editId, {
        onPage: (questionsSoFar, quizMeta) => {
          loadTotal.value = quizMeta.pagination?.total ?? questionsSoFar.length
          loadedCount.value = questionsSoFar.length
        },
      })
      if (data) {
        quiz.value = {
          ...quiz.value,
          ...data,
          questions: data.questions?.length ? data.questions.map(q => {
            const type = normType(q.question_type)
            const opts = typeof q.options === 'string' ? JSON.parse(q.options || '[]') : (q.options || [])
            return {
              id: q.id,
              question: q.question,
              options: type === 'number_input' ? [] : opts,
              correct_answer: q.correct_answer,
              explanation: q.explanation || '',
              difficulty: q.difficulty || 'Medium',
              question_type: type
            }
          }) : quiz.value.questions
        }
      }
    } catch (err) {
      console.error('Failed to fetch quiz details for editing:', err)
      errorMessage.value = 'Failed to load existing quiz data.'
    } finally {
      loading.value = false
    }
  }

  await loadLessons()
  if (quiz.value.lesson_id) await loadUnits(quiz.value.lesson_id)
})
</script>
<script setup>
import { ref, computed, watch } from 'vue'
import { quizService } from '@/services/quizService'
import MathInput from '@/components/ui/MathInput.vue'
import { normalizeMath, autoWrapLatex } from '@/utils/markdown'

const props = defineProps({
  unitId: { type: String, required: true },
  unitTitle: { type: String, default: '' },
  courseId: { type: String, default: null },
  lessonId: { type: String, default: null },
})
const emit = defineEmits(['change'])

const TIERS = ['Easy', 'Medium', 'Hard']
const normType = (t) => {
  const k = String(t || '').toLowerCase().replace(/[\s_-]+/g, '')
  return ['numberinput', 'numeric', 'numericentry', 'number', 'num', 'input'].includes(k) ? 'number_input' : 'QCM'
}

const loading = ref(true)
const open = ref(false)
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

const questionCount = computed(() => quiz.value.questions.filter((q) => q.question.trim()).length)

const load = async () => {
  loading.value = true
  error.value = null
  try {
    const existing = (await quizService.getUnitQuizzes(props.unitId)) || []
    const found = existing[0]
    if (found) {
      const full = await quizService.getQuizById(found.id)
      quiz.value = {
        id: full.id,
        course_id: props.courseId,
        lesson_id: props.lessonId,
        unit_id: props.unitId,
        title: full.title || '',
        pass_percentage: full.pass_percentage ?? 70,
        time_limit: full.time_limit ?? 15,
        status: full.status || 'draft',
        questions: (full.questions?.length ? full.questions : [blankQuestion()]).map((q) => {
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
        }),
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

const setType = (q, type) => {
  q.question_type = type
  q.correct_answer = ''
  q.options = type === 'number_input' ? [] : ['', '', '', '']
}
const addQuestion = () => quiz.value.questions.push(blankQuestion())
const removeQuestion = (i) => quiz.value.questions.splice(i, 1)
const addOption = (q) => q.options.push('')
const removeOption = (q, oi) => q.options.splice(oi, 1)

const payload = (status) => ({
  id: quiz.value.id || undefined,
  course_id: props.courseId,
  lesson_id: props.lessonId,
  unit_id: props.unitId,
  title: quiz.value.title.trim(),
  pass_percentage: quiz.value.pass_percentage,
  time_limit: quiz.value.time_limit,
  status,
  questions: quiz.value.questions
    .filter((q) => q.question.trim())
    .map((q) => ({
      id: typeof q.id === 'string' ? q.id : undefined,
      question: q.question,
      options: q.question_type === 'number_input' ? [] : q.options.filter((o) => o.trim()),
      correct_answer: q.correct_answer,
      explanation: q.explanation || null,
      difficulty: q.difficulty,
      question_type: q.question_type,
    })),
})

const save = async (status) => {
  if (!quiz.value.title.trim()) { error.value = 'Give the quiz a title.'; return }
  saving.value = true
  error.value = null
  msg.value = null
  try {
    const body = payload(status)
    const saved = quiz.value.id
      ? await quizService.updateQuiz(quiz.value.id, body)
      : await quizService.createQuiz(body)
    quiz.value.id = saved?.id || saved?.data?.id || quiz.value.id
    quiz.value.status = status
    msg.value = status === 'published' ? 'Published.' : 'Draft saved.'
    emit('change')
  } catch (err) {
    error.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Save failed'
  } finally {
    saving.value = false
  }
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
      const created = await quizService.createQuiz(payload('draft'))
      quiz.value.id = created?.id || created?.data?.id
    }
    const res = await quizService.importQuestionsFromCsv(quiz.value.id, file)
    const rows = (res?.data?.questions || res?.questions || []).map((q) => {
      const type = normType(q.question_type)
      const rawOpts = typeof q.options === 'string' ? JSON.parse(q.options || '[]') : (q.options || [])
      return {
        id: q.id,
        question: normalizeMath(q.question || ''),
        options: type === 'number_input' ? [] : rawOpts.map((o) => autoWrapLatex(o)),
        correct_answer: type === 'number_input' ? String(q.correct_answer ?? '').trim() : autoWrapLatex(q.correct_answer || ''),
        explanation: normalizeMath(q.explanation || ''),
        difficulty: q.difficulty || 'Medium',
        question_type: type,
      }
    })
    const onlyBlank = quiz.value.questions.length === 1 && !quiz.value.questions[0].question.trim()
    quiz.value.questions = onlyBlank ? rows : [...quiz.value.questions, ...rows]
    msg.value = `${rows.length} question(s) imported. Save to keep them.`
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

const removeQuiz = async () => {
  if (!quiz.value.id) { open.value = false; return }
  if (!confirm('Delete this unit practice quiz?')) return
  saving.value = true
  try {
    await quizService.deleteQuiz(quiz.value.id)
    quiz.value = {
      id: null, course_id: props.courseId, lesson_id: props.lessonId, unit_id: props.unitId,
      title: props.unitTitle ? `${props.unitTitle} — Practice` : 'Practice',
      pass_percentage: 70, time_limit: 15, status: 'draft', questions: [blankQuestion()],
    }
    open.value = false
    emit('change')
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Delete failed'
  } finally {
    saving.value = false
  }
}

watch(() => props.unitId, load, { immediate: true })

const fieldCls =
  'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-600'
const miniSelect =
  'px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-600'
</script>

<template>
  <div class="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 sm:p-5">
    <!-- Summary row -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <span>📝</span> Practice quiz
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          <template v-if="loading">Checking…</template>
          <template v-else-if="!quiz.id && !open">No quiz for this unit yet.</template>
          <template v-else>
            {{ questionCount }} question{{ questionCount === 1 ? '' : 's' }} ·
            <span :class="quiz.status === 'published' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'">
              {{ quiz.status }}
            </span>
          </template>
        </p>
      </div>
      <button
        type="button"
        class="px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95"
        :class="open ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700' : 'bg-[#033B26] hover:bg-[#022819] text-white'"
        @click="open = !open"
      >
        {{ open ? 'Close' : (quiz.id ? 'Edit quiz' : 'Add quiz') }}
      </button>
    </div>

    <p v-if="msg" class="text-xs text-emerald-700 dark:text-emerald-400 mt-2">{{ msg }}</p>
    <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>

    <!-- Inline editor -->
    <div v-if="open && !loading" class="mt-4 space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3">
        <input v-model="quiz.title" type="text" placeholder="Quiz title" :class="fieldCls" />
        <label class="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase">
          Pass %
          <input v-model.number="quiz.pass_percentage" type="number" min="0" max="100" class="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm" />
        </label>
        <label class="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase">
          Min
          <input v-model.number="quiz.time_limit" type="number" min="1" class="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm" />
        </label>
      </div>

      <!-- Questions -->
      <div
        v-for="(q, qi) in quiz.questions"
        :key="q.id"
        class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
      >
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-500">Q{{ qi + 1 }}</span>
            <select :value="q.difficulty" @change="q.difficulty = $event.target.value" :class="miniSelect">
              <option v-for="t in TIERS" :key="t" :value="t">{{ t }}</option>
            </select>
            <select :value="q.question_type" @change="setType(q, $event.target.value)" :class="miniSelect">
              <option value="QCM">Multiple choice</option>
              <option value="number_input">Number input</option>
            </select>
          </div>
          <button v-if="quiz.questions.length > 1" type="button" class="text-xs font-bold text-red-500 hover:underline" @click="removeQuestion(qi)">Remove</button>
        </div>

        <MathInput v-model="q.question" placeholder="Question… (wrap math in $…$)" :input-class="fieldCls" />

        <!-- QCM options -->
        <div v-if="q.question_type !== 'number_input'" class="space-y-2">
          <div v-for="(opt, oi) in q.options" :key="oi" class="flex items-center gap-2">
            <input type="radio" :name="`c-${q.id}`" :checked="q.correct_answer === opt && opt !== ''" @change="q.correct_answer = opt" class="shrink-0" />
            <MathInput v-model="q.options[oi]" :placeholder="`Option ${oi + 1}`" :input-class="fieldCls" class="flex-1" />
            <button v-if="q.options.length > 2" type="button" class="text-slate-400 hover:text-red-500 text-xs" @click="removeOption(q, oi)">✕</button>
          </div>
          <button v-if="q.options.length < 6" type="button" class="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline" @click="addOption(q)">+ Option</button>
        </div>

        <!-- Numeric answer -->
        <div v-else>
          <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1">Correct answer (number)</label>
          <input v-model="q.correct_answer" type="text" inputmode="decimal" placeholder="e.g. 1955" class="w-40 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm" />
        </div>

        <MathInput v-model="q.explanation" multiline :rows="2" placeholder="Explanation (optional)" :input-class="fieldCls" />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-slate-800 text-[#033B26] dark:text-emerald-400 border border-emerald-200 dark:border-slate-700 text-xs font-bold" @click="addQuestion">+ Question</button>
        <input ref="csvInput" type="file" accept=".csv,text/csv" class="hidden" @change="importCsv" />
        <button type="button" :disabled="importing" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-50" @click="csvInput?.click()">
          {{ importing ? 'Importing…' : 'Import CSV' }}
        </button>
        <button type="button" class="text-xs text-slate-500 dark:text-slate-400 font-bold hover:underline" @click="downloadTemplate">Template</button>
      </div>

      <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <button type="button" :disabled="saving" class="px-4 py-2 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold disabled:opacity-50" @click="save('draft')">
          {{ saving ? 'Saving…' : 'Save draft' }}
        </button>
        <button type="button" :disabled="saving" class="px-4 py-2 rounded-xl bg-[#033B26] hover:bg-[#022819] text-white text-xs font-bold disabled:opacity-50" @click="save('published')">
          Publish
        </button>
        <button v-if="quiz.id" type="button" :disabled="saving" class="px-3 py-2 rounded-xl text-red-600 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 ml-auto" @click="removeQuiz">
          Delete quiz
        </button>
      </div>
    </div>
  </div>
</template>

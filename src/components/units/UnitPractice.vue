<script setup>
import { ref, computed, watch } from 'vue'
import { quizService } from '@/services/quizService'
import MarkdownContent from '@/components/ui/MarkdownContent.vue'
import { renderInline } from '@/utils/markdown'

const props = defineProps({
  unitId: { type: String, required: true },
  // Skip loading until the panel is actually opened.
  active: { type: Boolean, default: true },
})

const loading = ref(false)
const error = ref(null)
const quiz = ref(null)          // { id, title, pass_percentage, questions: [...] }
const answers = ref({})         // { [questionId]: optionText | numericString }
const submitting = ref(false)
const result = ref(null)        // { score, passed, correct_answers, total_questions, review, xp_awarded }

const started = ref(false)
// One question shown at a time (Back/Next) instead of the whole bank in one
// scrolling list or one big upfront fetch — a teacher's bank can run into
// the hundreds, and there's nothing to save back here (unlike the editors),
// so each question is only fetched the moment Next actually needs it.
// Already-fetched questions stay cached in quiz.value.questions, so Back
// never re-fetches. For a student the server always returns their whole
// (small, capped) draw in one response regardless of page/limit, so this
// degrades to a single request with totalCount === questions.length.
const currentIndex = ref(0)
const totalCount = ref(0)
const nextLoading = ref(false)

const load = async () => {
  loading.value = true
  error.value = null
  quiz.value = null
  result.value = null
  answers.value = {}
  started.value = false
  currentIndex.value = 0
  totalCount.value = 0
  try {
    const quizzes = await quizService.getUnitQuizzes(props.unitId)
    const published = (quizzes || []).find((q) => q.status === 'published') || (quizzes || [])[0]
    if (!published) { loading.value = false; return }
    quiz.value = await quizService.getQuizById(published.id, { page: 1, limit: 1 })
    totalCount.value = quiz.value.pagination?.total ?? (quiz.value.questions || []).length
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to load practice'
  } finally {
    loading.value = false
  }
}

const questions = computed(() => quiz.value?.questions || [])
const currentQuestion = computed(() => questions.value[currentIndex.value] || null)
const isLastQuestion = computed(() => currentIndex.value >= totalCount.value - 1)
const goBack = () => { if (currentIndex.value > 0) currentIndex.value-- }
const goNext = async () => {
  if (isLastQuestion.value) return
  const nextIndex = currentIndex.value + 1
  if (nextIndex >= questions.value.length) {
    nextLoading.value = true
    error.value = null
    try {
      const page = questions.value.length + 1 // one question per page
      const next = await quizService.getQuizById(quiz.value.id, { page, limit: 1 })
      quiz.value.questions = [...questions.value, ...(next.questions || [])]
    } catch (err) {
      error.value = err.response?.data?.error || err.message || 'Failed to load the next question'
      return
    } finally {
      nextLoading.value = false
    }
  }
  currentIndex.value = nextIndex
}
const answeredCount = computed(
  () => questions.value.filter((q) => {
    const a = answers.value[q.id]
    return a != null && String(a).trim() !== ''
  }).length,
)
const allAnswered = computed(() => questions.value.length > 0 && answeredCount.value === questions.value.length)

const reviewById = computed(() => {
  const map = {}
  for (const r of result.value?.review || []) map[r.question_id] = r
  return map
})

const submit = async () => {
  if (!quiz.value) return
  submitting.value = true
  error.value = null
  try {
    // Numeric answers: strip spaces/commas to match how the CSV import stores
    // the correct value (server compares with strict equality).
    const payload = {}
    for (const q of questions.value) {
      const raw = answers.value[q.id]
      if (raw == null) continue
      payload[q.id] = qType(q) === 'number_input'
        ? String(raw).replace(/[\s,]/g, '')
        : raw
    }
    const res = await quizService.submitQuiz(quiz.value.id, payload)
    result.value = {
      ...(res.data?.submission || {}),
      review: res.data?.review || [],
      xp_awarded: res.data?.xp_awarded || 0,
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to submit'
  } finally {
    submitting.value = false
  }
}

const retake = () => {
  result.value = null
  answers.value = {}
  started.value = true
  currentIndex.value = 0
}

// Canonical question types are 'QCM' / 'number_input'; tolerate legacy aliases.
const qType = (q) => {
  const k = String(q?.question_type || '').toLowerCase().replace(/[\s_-]+/g, '')
  return ['numberinput', 'numeric', 'numericentry', 'number', 'num', 'input'].includes(k)
    ? 'number_input'
    : 'QCM'
}

const tierClass = (t) => {
  const k = String(t).toLowerCase()
  if (k.startsWith('e')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
  if (k.startsWith('h')) return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
}

watch(
  () => [props.unitId, props.active],
  () => { if (props.active) load() },
  { immediate: true },
)
</script>

<template>
  <div class="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
    <div class="flex items-center justify-between gap-3 mb-4">
      <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
        <span>📝</span> Practice
      </h3>
      <span v-if="quiz && !result" class="text-xs text-slate-500 dark:text-slate-400">
        {{ answeredCount }} / {{ questions.length }} answered
      </span>
      <span
        v-if="result"
        :class="[
          'text-xs font-bold px-2 py-0.5 rounded-full',
          result.passed
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
        ]"
      >
        {{ result.score }}% · {{ result.passed ? 'Passed' : 'Keep practising' }}
      </span>
    </div>

    <div v-if="loading" class="text-xs text-slate-500">Loading practice…</div>
    <div v-else-if="error" class="text-xs text-red-600">{{ error }}</div>
    <div v-else-if="!quiz" class="text-xs text-slate-500 italic">
      No practice questions for this unit yet.
    </div>

    <template v-else>
      <!-- Intro -->
      <div v-if="!started && !result" class="space-y-3">
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ totalCount }} question{{ totalCount === 1 ? '' : 's' }} ·
          pass mark {{ quiz.pass_percentage ?? 70 }}%.
        </p>
        <button
          type="button"
          class="px-4 py-2 rounded-xl bg-[#033B26] hover:bg-[#022819] text-white text-xs font-bold transition active:scale-95"
          @click="started = true"
        >
          Start practice
        </button>
      </div>

      <!-- Current question -->
      <div v-else-if="currentQuestion" class="space-y-6">
        <div class="flex gap-2">
          <span class="text-sm font-bold text-slate-400 shrink-0">{{ currentIndex + 1 }}.</span>
          <div class="flex-1 min-w-0 space-y-2">
            <span
              v-if="currentQuestion.difficulty"
              :class="[
                'inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide',
                tierClass(currentQuestion.difficulty),
              ]"
            >{{ currentQuestion.difficulty }}</span>
            <MarkdownContent :source="currentQuestion.question" class="text-sm" />

            <!-- Numeric -->
            <input
              v-if="qType(currentQuestion) === 'number_input'"
              v-model="answers[currentQuestion.id]"
              :disabled="!!result"
              type="text"
              inputmode="decimal"
              placeholder="Your answer"
              class="w-40 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-60"
            />

            <!-- Multiple choice -->
            <div v-else class="space-y-1.5">
              <label
                v-for="opt in currentQuestion.options"
                :key="opt"
                :class="[
                  'flex items-start gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm transition',
                  result
                    ? (opt === reviewById[currentQuestion.id]?.correct_answer
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                        : (opt === answers[currentQuestion.id]
                            ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
                            : 'border-slate-200 dark:border-slate-800'))
                    : (opt === answers[currentQuestion.id]
                        ? 'border-emerald-400 bg-emerald-50/60 dark:bg-slate-800'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'),
                ]"
              >
                <input
                  type="radio"
                  class="mt-0.5"
                  :name="currentQuestion.id"
                  :value="opt"
                  v-model="answers[currentQuestion.id]"
                  :disabled="!!result"
                />
                <span class="flex-1 text-slate-700 dark:text-slate-300 markdown-inline" v-html="renderInline(opt)"></span>
              </label>
            </div>

            <!-- Review feedback -->
            <div
              v-if="result && reviewById[currentQuestion.id]"
              class="text-xs rounded-lg px-3 py-2 mt-1"
              :class="reviewById[currentQuestion.id].is_correct
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'"
            >
              <p class="font-semibold">
                <template v-if="reviewById[currentQuestion.id].is_correct">✓ Correct</template>
                <template v-else>
                  ✗ Correct answer: <span class="markdown-inline" v-html="renderInline(reviewById[currentQuestion.id].correct_answer)"></span>
                </template>
              </p>
              <p v-if="reviewById[currentQuestion.id].explanation" class="mt-0.5 opacity-90 markdown-inline" v-html="renderInline(reviewById[currentQuestion.id].explanation)"></p>
            </div>
          </div>
        </div>

        <!-- Pagination: Back / Next through the bank one question at a time -->
        <div class="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            :disabled="currentIndex === 0 || nextLoading"
            class="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
            @click="goBack"
          >
            Back
          </button>

          <span class="text-xs text-slate-500 dark:text-slate-400">
            Question {{ currentIndex + 1 }} of {{ totalCount }}
          </span>

          <button
            v-if="!isLastQuestion"
            type="button"
            :disabled="nextLoading"
            class="px-4 py-2 rounded-xl bg-[#033B26] hover:bg-[#022819] text-white text-xs font-bold disabled:opacity-50 transition active:scale-95"
            @click="goNext"
          >
            {{ nextLoading ? 'Loading…' : 'Next' }}
          </button>
          <button
            v-else-if="!result"
            type="button"
            :disabled="submitting || !allAnswered"
            class="px-5 py-2 rounded-xl bg-[#033B26] hover:bg-[#022819] text-white text-xs font-bold disabled:opacity-50 transition active:scale-95"
            @click="submit"
          >
            {{ submitting ? 'Submitting…' : 'Submit answers' }}
          </button>
        </div>
        <p v-if="!result && !allAnswered && isLastQuestion" class="text-xs text-slate-400 text-right">
          Answer all {{ questions.length }} to submit
        </p>

        <!-- Result summary + retake, always reachable regardless of the current page -->
        <div v-if="result" class="flex items-center gap-3">
          <span class="text-xs text-slate-600 dark:text-slate-400">
            {{ result.correct_answers }} / {{ result.total_questions }} correct
            <template v-if="result.xp_awarded"> · +{{ result.xp_awarded }} XP</template>
          </span>
          <button
            type="button"
            class="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
            @click="retake"
          >
            Retake
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style>
.markdown-inline { white-space: pre-wrap; }
.markdown-inline .katex { font-size: 1.02em; }
.markdown-inline p { display: inline; margin: 0; }
</style>

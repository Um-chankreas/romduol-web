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
        Loading quiz details...
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
            <button 
              @click="addQuestion" 
              class="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-slate-800 text-[#033B26] dark:text-emerald-400 border border-emerald-200 dark:border-slate-700 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
            >
              + Add Question
            </button>
          </div>

          <div 
            v-for="(q, qIndex) in quiz.questions" 
            :key="q.id"
            class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4 relative"
          >
            <div class="flex items-center justify-between">
              <span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300">
                Question {{ qIndex + 1 }}
              </span>

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

            <!-- Options -->
            <div class="space-y-2 pt-2">
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
        </div>
      </template>

    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { quizService } from '@/services/quizService'
import MathInput from '@/components/ui/MathInput.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
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
      question_type: 'multiple_choice'
    }
  ]
})

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
    question_type: 'multiple_choice'
  })
}

const removeQuestion = (index) => {
  quiz.value.questions.splice(index, 1)
}

const addOption = (qIndex) => {
  quiz.value.questions[qIndex].options.push('')
}

const removeOption = (qIndex, oIndex) => {
  quiz.value.questions[qIndex].options.splice(oIndex, 1)
}

const goBack = () => {
  router.back()
}

// Fetch existing quiz details if editing
onMounted(async () => {
  const editId = route.params.quizId || route.params.id
  if (editId) {
    loading.value = true
    try {
      const data = await quizService.getQuizById(editId)
      if (data) {
        quiz.value = {
          ...quiz.value,
          ...data,
          questions: data.questions?.length ? data.questions.map(q => ({
            id: q.id,
            question: q.question,
            options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation || '',
            question_type: q.question_type || 'multiple_choice'
          })) : quiz.value.questions
        }
      }
    } catch (err) {
      console.error('Failed to fetch quiz details for editing:', err)
      errorMessage.value = 'Failed to load existing quiz data.'
    } finally {
      loading.value = false
    }
  }
})
</script>
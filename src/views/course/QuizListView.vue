<template>
  <div>
    <!-- EMPTY / NO QUIZ STATE (YOUR EXACT UI) -->
    <div
      v-if="quizzes.length === 0"
      class="w-full pt-3 mt-3  border-slate-100 dark:border-slate-800/60 flex items-center justify-between"
    >
      <div class="text-xs text-slate-600 dark:text-slate-400 italic">
        No quiz attached to this lesson.
      </div>

      <button
        @click="$router.push({ name: 'CreateQuiz', params: { courseId: activeCourseId }, query: { lessonId: lessonId } })"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 text-[#033B26] dark:text-emerald-400 border border-emerald-200 dark:border-slate-700 text-xs font-bold transition cursor-pointer active:scale-95"
      >
        <span>+</span> Add Quiz
      </button>
    </div>

    <!-- QUIZZES EXIST: FULL TABLE UI -->
    <div v-else class="space-y-4 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/60 text-left">
      <!-- Header Bar when Quizzes Exist -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-bold flex items-center gap-1.5">
            ❓ {{ quizzes.length }} {{ quizzes.length === 1 ? 'Quiz' : 'Quizzes' }} Attached
          </span>
        </div>

        <button 
          @click="$router.push({ name: 'CreateQuiz', params: { courseId: activeCourseId }, query: { lessonId: lessonId } })"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 text-[#033B26] dark:text-emerald-400 border border-emerald-200 dark:border-slate-700 text-xs font-bold transition cursor-pointer active:scale-95"
        >
          <span>+</span> Add Quiz
        </button>
      </div>

      <!-- Table Container -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead class="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th class="p-3">Title</th>
                <th class="p-3">Questions</th>
                <th class="p-3">Passing Grade</th>
                <th class="p-3">Status</th>
                <th class="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
              <tr 
                v-for="q in quizzes" 
                :key="q.id"
                class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
              >
                <td class="p-3 font-bold text-slate-900 dark:text-white">
                  {{ q.title || 'Untitled Quiz' }}
                </td>
                <td class="p-3">
                  {{ questionCount(q) }} items
                </td>
                <td class="p-3">
                  {{ q.pass_percentage != null ? `${q.pass_percentage}%` : '—' }}
                </td>
                <td class="p-3">
                  <span 
                    :class="[
                      'px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wide',
                      q.status === 'published' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                    ]"
                  >
                    {{ q.status || 'draft' }}
                  </span>
                </td>
                <td class="p-3 text-right space-x-3">
                  <button 
                    @click="$router.push(`/course/${activeCourseId}/quiz/edit/${q.id}`)"
                    class="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                    >
                    Edit
                    </button>
                  <button 
                    @click="deleteQuiz(q.id)"
                    class="text-red-500 hover:text-red-700 font-bold hover:underline cursor-pointer"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { quizService } from '@/services/quizService'

const props = defineProps({
  courseId: {
    type: [String, Number],
    default: null
  },
  lessonId: {
    type: [String, Number],
    default: null
  },
  // The parent (CourseDetailView) already fetches every lesson's quizzes in
  // its single course-details request, so this component never fetches on
  // its own — it just renders whatever is passed in here.
  initialQuizzes: {
    type: Array,
    default: () => []
  }
})

const route = useRoute()
const quizzes = ref([...props.initialQuizzes])

// Stay in sync if the parent's data changes (e.g. after it re-fetches).
watch(
  () => props.initialQuizzes,
  (val) => {
    quizzes.value = [...(val || [])]
  }
)

const activeCourseId = computed(() => {
  return props.courseId || route.params.id || route.params.courseId
})

// Quiz objects reach this component in a few different shapes depending on
// where they came from: the lightweight lesson-embedded quiz (total_questions),
// the course quiz list endpoint (quiz_questions: [{ count }]), or a full quiz
// with its questions array loaded.
const questionCount = (quiz) => {
  if (quiz.total_questions != null) return quiz.total_questions
  if (quiz.questions_count != null) return quiz.questions_count
  if (quiz.quiz_questions?.[0]?.count != null) return quiz.quiz_questions[0].count
  return quiz.questions?.length || 0
}

const deleteQuiz = async (quizId) => {
  if (!confirm('Are you sure you want to delete this quiz?')) return
  try {
    await quizService.deleteQuiz(quizId)
    // Remove from local list immediately on success
    quizzes.value = quizzes.value.filter(q => q.id !== quizId)
  } catch (err) {
    console.error('Failed to delete quiz:', err)
    alert('Failed to delete quiz: ' + (err.response?.data?.error || err.message))
  }
}
</script>
<template>
  <div class="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors">
    <Sidebar class="hidden md:flex shrink-0 h-full" />

    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <Header class="shrink-0">
        <template #left>
          <Breadcrumb :items="breadcrumbItems" />
        </template>
      </Header>

      <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col">
        <main class="flex-1 p-6 sm:p-10 text-slate-900 dark:text-slate-100">
          <div class="max-w-[1200px] mx-auto text-left space-y-5">

            <p v-if="loading" class="text-sm text-slate-500">Loading…</p>
            <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>

            <template v-else-if="assignment">
              <router-link
                :to="{ name: 'CourseDetail', params: { id: courseId }, query: { tab: 'assignments' } }"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111A28] text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <span aria-hidden="true">‹</span> All assignments
              </router-link>

              <!-- Title + actions -->
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0 space-y-2">
                  <div class="flex items-center gap-3 flex-wrap">
                    <h1 class="text-3xl font-extrabold">{{ assignment.title }}</h1>
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300">{{ assignment.type === 'quiz' ? 'Quiz' : 'Homework' }}</span>
                    <span :class="['px-2.5 py-0.5 rounded-full text-[11px] font-bold', STATUS_CLASS[status]]">{{ STATUS_LABEL[status] }}</span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    <template v-if="assignment.type === 'quiz'">{{ questions.length }} question{{ questions.length === 1 ? '' : 's' }} · </template>{{ points }} points
                    <template v-if="assignment.due_date">
                      <span class="font-bold text-slate-800 dark:text-slate-100"> · Due {{ formatShort(assignment.due_date) }}<template v-if="status !== 'closed'"> · {{ relativeTime(assignment.due_date) }}</template></span>
                    </template>
                  </p>
                </div>
                <div class="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    @click="exportCsv"
                    class="px-4 py-2.5 rounded-xl bg-white dark:bg-[#111A28] border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    ⤓ Export CSV
                  </button>
                  <span v-if="recentReminder" role="status" class="min-h-[44px] px-4 rounded-xl bg-emerald-50 dark:bg-[#13261C] text-emerald-700 dark:text-emerald-300 font-semibold text-sm inline-flex items-center gap-2">
                    ✓ Reminded {{ relativeTime(assignment.last_reminder.created_at) }}
                  </span>
                  <button
                    v-else-if="pendingCount > 0 && assignment.status === 'published'"
                    type="button"
                    @click="openRemind"
                    class="px-5 py-2.5 rounded-xl bg-[#0f7a45] hover:bg-[#0c6a3c] text-white text-sm font-bold transition cursor-pointer shadow-[0_3px_0_#0a5530]"
                  >
                    Remind {{ pendingCount }} student{{ pendingCount === 1 ? '' : 's' }}
                  </button>
                </div>
              </div>

              <!-- Summary -->
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div v-for="c in summary" :key="c.label" class="rounded-2xl p-5 bg-white dark:bg-[#111A28] border border-slate-200/80 dark:border-[#22304A]">
                  <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">{{ c.label }}</p>
                  <p class="mt-2 text-3xl font-extrabold" :class="c.accent ? 'text-amber-500 dark:text-amber-300' : ''">
                    {{ c.value }}<span v-if="c.of !== undefined && c.of !== null" class="text-base font-semibold text-slate-400"> / {{ c.of }}</span>
                  </p>
                  <div v-if="c.bar !== undefined" class="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div class="h-full rounded-full bg-emerald-500" :style="{ width: c.bar + '%' }"></div>
                  </div>
                  <p v-if="c.note" class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{ c.note }}</p>
                </div>
              </div>

              <!-- Tabs -->
              <div class="flex gap-8 border-b border-slate-200 dark:border-[#22304A]">
                <button
                  v-for="t in tabs"
                  :key="t.id"
                  type="button"
                  @click="tab = t.id"
                  :class="[
                    'pb-3 text-sm font-bold transition cursor-pointer border-b-2 -mb-px',
                    tab === t.id ? 'border-emerald-500 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  ]"
                >{{ t.label }}</button>
              </div>

              <!-- STUDENTS -->
              <section v-if="tab === 'students'" class="space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="f in FILTERS"
                      :key="f.id"
                      type="button"
                      @click="filter = f.id"
                      :class="[
                        'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer border',
                        filter === f.id
                          ? 'bg-emerald-50 text-[#006A3A] border-emerald-200'
                          : 'bg-white dark:bg-[#111A28] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#22304A]'
                      ]"
                    >
                      {{ f.label }}
                      <span :class="['px-1.5 rounded-full text-[10px]', filter === f.id ? 'bg-emerald-100' : 'bg-slate-100 dark:bg-slate-800']">{{ filterCounts[f.id] }}</span>
                    </button>
                  </div>
                  <input
                    v-model="search"
                    type="search"
                    placeholder="Search by name"
                    class="w-full sm:w-72 px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-[#111A28] border border-slate-200 dark:border-[#22304A] focus:outline-none focus:ring-2 focus:ring-[#006A3A]/30"
                  />
                </div>

                <div class="rounded-2xl overflow-x-auto bg-white dark:bg-[#111A28] border border-slate-200/80 dark:border-[#22304A]">
                  <table class="w-full min-w-[720px] text-sm">
                    <thead class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <tr class="border-b border-slate-100 dark:border-[#22304A]">
                        <th class="px-5 py-3.5 text-left font-semibold">Student</th>
                        <th class="px-5 py-3.5 text-left font-semibold">Status</th>
                        <th class="px-5 py-3.5 text-right font-semibold">
                          <button type="button" class="uppercase font-semibold tracking-wider cursor-pointer" @click="cycleSort">
                            Score <span class="text-slate-400">{{ sort === 'desc' ? '↓' : sort === 'asc' ? '↑' : '' }}</span>
                          </button>
                        </th>
                        <th class="px-5 py-3.5 text-left font-semibold">Submitted</th>
                        <th class="px-5 py-3.5 text-right font-semibold">Attempts</th>
                        <th class="px-5 py-3.5"></th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr v-if="rows.length === 0">
                        <td colspan="6" class="px-5 py-8 text-center text-xs text-slate-500">No students match.</td>
                      </tr>
                      <tr v-for="r in rows" :key="r.student?.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                        <td class="px-5 py-3.5" :title="r.student?.email || ''">
                          <div class="flex items-center gap-3">
                            <img v-if="r.student?.avatar_url" :src="r.student.avatar_url" class="h-9 w-9 rounded-full object-cover shrink-0" alt="" />
                            <div v-else :class="['h-9 w-9 rounded-full text-white', r.submission ? 'bg-[#12804A]' : 'bg-slate-400 dark:bg-[#2E3D58]']" class="flex items-center justify-center text-xs font-bold shrink-0 select-none">
                              {{ initialsOf(r.student?.name) }}
                            </div>
                            <span class="font-semibold truncate max-w-[260px]">{{ r.student?.name || 'Unknown' }}</span>
                          </div>
                        </td>
                        <td class="px-5 py-3.5">
                          <span :class="['px-2.5 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap', rowStatus(r).cls]">{{ rowStatus(r).label }}</span>
                        </td>
                        <td class="px-5 py-3.5 text-right font-extrabold whitespace-nowrap" :class="lowScore(r) ? 'text-amber-500 dark:text-amber-300' : ''">
                          {{ r.submission && scoreOf(r.submission) !== null ? `${earned(r.submission)} / ${points}` : '—' }}
                        </td>
                        <td class="px-5 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {{ r.submission ? formatShort(r.submission.submitted_at) : '—' }}
                        </td>
                        <td class="px-5 py-3.5 text-right text-slate-600 dark:text-slate-300">{{ r.submission ? 1 : '—' }}</td>
                        <td class="px-5 py-3.5 text-right">
                          <button
                            v-if="r.submission"
                            type="button"
                            @click="selected = r"
                            class="px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#006A3A] dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 transition cursor-pointer"
                          >View answers</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-if="capped" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 dark:border-[#1C2840] text-sm text-slate-500 dark:text-slate-400">
                    <span>Showing {{ rows.length }} of {{ allRows.length }} students</span>
                    <button type="button" class="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-[#2E3D58] text-slate-800 dark:text-slate-100 font-semibold cursor-pointer" @click="showAll = true">Show all</button>
                  </div>
                </div>
              </section>

              <!-- QUESTIONS -->
              <section v-else-if="tab === 'questions'" class="space-y-3">
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  Based on {{ submittedCount }} submission{{ submittedCount === 1 ? '' : 's' }}. Questions under 60% correct are marked so you know what to reteach.
                </p>
                <article
                  v-for="q in questionStats"
                  :key="q.id"
                  :class="['rounded-2xl px-5 py-4 bg-white dark:bg-[#111A28] border flex flex-wrap items-center gap-x-6 gap-y-3', q.reteach ? 'border-amber-300 dark:border-[#5A4615]' : 'border-slate-200/80 dark:border-[#22304A]']"
                >
                  <div class="flex-[999_1_380px] min-w-0 flex items-start gap-3.5">
                    <span class="w-8 h-8 shrink-0 rounded-[10px] bg-slate-100 dark:bg-[#1F2C42] font-bold flex items-center justify-center">{{ q.number }}</span>
                    <div class="min-w-0 space-y-1">
                      <p class="text-base leading-7"><MathText :text="q.question" /></p>
                      <p class="text-sm text-slate-500 dark:text-slate-400">Correct answer: <strong class="text-emerald-600 dark:text-emerald-300">{{ q.correctLetter }} · <MathText :text="q.correct" /></strong></p>
                    </div>
                  </div>
                  <div class="flex-[1_1_300px] space-y-2">
                    <div class="flex items-center justify-between gap-2">
                      <span :class="['font-bold', q.percent === null ? 'text-slate-400' : q.reteach ? 'text-amber-600 dark:text-amber-300' : q.percent === 100 ? 'text-emerald-600 dark:text-emerald-300' : '']">
                        {{ q.percent === null ? '—' : q.percent + '% correct' }}
                      </span>
                      <span v-if="q.reteach" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">Reteach</span>
                    </div>
                    <div class="h-2 rounded-full bg-slate-100 dark:bg-[#1F2C42] overflow-hidden">
                      <div class="h-full rounded-full" :class="q.reteach ? 'bg-amber-500' : 'bg-emerald-500'" :style="{ width: (q.percent || 0) + '%' }"></div>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-300">
                      <template v-if="q.topWrong">Most picked wrong answer: {{ q.topWrong.letter }} · {{ q.topWrong.count }} of {{ q.answered }} students</template>
                      <template v-else-if="q.answered > 0">Everyone got this right</template>
                      <template v-else>No answers yet</template>
                    </p>
                  </div>
                </article>
              </section>
            </template>
          </div>
        </main>
        <Footer />
      </div>
    </div>

    <!-- Student answers side panel -->
    <div v-if="selected" class="fixed inset-0 z-40 flex justify-end bg-[#04080E]/60" @click.self="selected = null">
      <aside aria-label="Student answers" class="w-full max-w-[440px] h-full overflow-y-auto bg-white dark:bg-[#111A28] border-l border-slate-200 dark:border-[#2E3D58] p-6 text-left flex flex-col gap-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-11 h-11 shrink-0 rounded-full bg-[#12804A] text-white font-bold flex items-center justify-center">{{ initialsOf(selected.student?.name) }}</span>
            <div class="min-w-0">
              <p class="text-[17px] font-bold truncate">{{ selected.student?.name }}</p>
              <p class="text-sm text-slate-500 dark:text-slate-400">Submitted {{ formatShort(selected.submission.submitted_at) }} · attempt 1</p>
            </div>
          </div>
          <button class="w-11 h-11 shrink-0 rounded-xl border border-slate-200 dark:border-[#2E3D58] flex items-center justify-center cursor-pointer" aria-label="Close" @click="selected = null">✕</button>
        </div>

        <template v-if="assignment.type === 'quiz'">
          <div v-if="scoreOf(selected.submission) !== null" class="flex items-baseline gap-2 px-4 py-3.5 rounded-xl bg-slate-100 dark:bg-[#172234]">
            <span class="text-3xl font-bold text-amber-500 dark:text-[#F2C14E]">{{ earned(selected.submission) }}</span>
            <span class="text-slate-500 dark:text-slate-400">/ {{ points }} · {{ correctCountOf(selected) }} of {{ questions.length }} correct</span>
          </div>
          <ol class="flex flex-col gap-2.5 m-0 p-0 list-none">
            <li
              v-for="(q, i) in questions"
              :key="q.id"
              :class="['flex items-start gap-3 px-3.5 py-3 rounded-xl border', isRight(selected, q) ? 'border-slate-200 dark:border-[#22304A] dark:bg-[#111A28]' : 'border-amber-300 bg-amber-50 dark:border-[#5A4615] dark:bg-amber-400/[0.06]']"
            >
              <span :class="['w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold text-[#0A111C]', isRight(selected, q) ? 'bg-[#5BD58C]' : 'bg-[#FBBF24]']">{{ isRight(selected, q) ? '✓' : '✕' }}</span>
              <div class="min-w-0 flex flex-col gap-0.5">
                <span class="text-sm leading-7">Q{{ i + 1 }}. <MathText :text="q.question" /></span>
                <span :class="['text-sm', isRight(selected, q) ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300']">
                  <template v-if="!answerOf(selected, q)">No answer · correct answer {{ letterFor(q, q.correct_answer) }}</template>
                  <template v-else-if="isRight(selected, q)">Picked {{ letterFor(q, answerOf(selected, q)) }} · correct</template>
                  <template v-else>Picked {{ letterFor(q, answerOf(selected, q)) }} · correct answer {{ letterFor(q, q.correct_answer) }}</template>
                </span>
              </div>
            </li>
          </ol>
        </template>
        <template v-else>
          <p v-if="selected.submission.submission_text" class="text-sm whitespace-pre-wrap">{{ selected.submission.submission_text }}</p>
          <a v-if="selected.submission.file_url" :href="selected.submission.file_url" target="_blank" rel="noopener" class="text-sm font-bold text-[#006A3A] dark:text-emerald-300 hover:underline">Open submitted file</a>
          <p v-if="!selected.submission.submission_text && !selected.submission.file_url" class="text-sm text-slate-500">Nothing attached.</p>
        </template>
      </aside>
    </div>

    <!-- Remind dialog -->
    <div v-if="remind" class="fixed inset-0 z-50 flex justify-center items-start pt-28 px-4 bg-[#04080E]/60" @click.self="!remind.busy && (remind = null)">
      <div role="dialog" aria-modal="true" aria-labelledby="remind-title" class="w-full max-w-[520px] h-fit rounded-[20px] bg-white dark:bg-[#111A28] border border-slate-200 dark:border-[#2E3D58] p-6 text-left shadow-2xl flex flex-col gap-4">
        <h2 id="remind-title" class="text-xl font-bold">Remind {{ pendingCount }} student{{ pendingCount === 1 ? '' : 's' }}</h2>
        <p class="text-slate-600 dark:text-slate-300">Students who haven't submitted get a notification in the app. Tapping it opens this assignment.</p>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold text-slate-600 dark:text-slate-300">Message</span>
          <textarea v-model="remind.body" rows="3" maxlength="500" class="resize-y px-3.5 py-3 rounded-xl border border-slate-300 dark:border-[#2E3D58] bg-transparent dark:bg-[#0D1522] text-[15px] leading-7"></textarea>
        </label>
        <p class="text-sm text-slate-500 dark:text-slate-400">You can send one reminder every 12 hours.</p>
        <p v-if="remind.error" class="text-sm text-red-600 dark:text-red-300">{{ remind.error }}</p>
        <div class="flex justify-end gap-2.5">
          <button class="min-h-[44px] px-5 rounded-xl border border-slate-300 dark:border-[#2E3D58] text-sm font-semibold cursor-pointer" :disabled="remind.busy" @click="remind = null">Cancel</button>
          <button class="min-h-[44px] px-5 rounded-xl bg-[#12804A] hover:bg-[#0f7a45] text-white text-sm font-bold disabled:opacity-50 cursor-pointer shadow-[0_3px_0_#0A5C34]" :disabled="remind.busy || !remind.body.trim()" @click="sendRemind">
            {{ remind.busy ? 'Sending…' : 'Send reminder' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'
import Footer from '@/components/layout/Footer.vue'
import Breadcrumb from '@/components/layout/Breadcrumb.vue'
import MathText from '@/components/ui/MathText.vue'
import { assignmentService } from '@/services/assignmentService'
import { formatDateTime, formatShort } from '@/utils/dateFormat'
import { statusOf, STATUS_LABEL, STATUS_CLASS, relativeTime } from '@/utils/assignmentStatus'

const route = useRoute()
const courseId = route.params.courseId
const assignmentId = route.params.id

const assignment = ref(null)
const loading = ref(true)
const error = ref('')

const breadcrumbItems = computed(() => [
  { label: 'My Classes', to: '/' },
  { label: route.query.courseTitle || assignment.value?.course?.title || 'Class', to: `/courses/${courseId}` },
  { label: assignment.value?.title || 'Results' },
])

const load = async () => {
  try {
    assignment.value = await assignmentService.getAssignment(assignmentId)
    if (!assignment.value) error.value = 'Assignment not found'
    // Nobody submitted yet: an empty "Submitted" list would look broken.
    else if (!assignment.value.roster?.some(r => r.submission)) filter.value = 'all'
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to load results'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const status = computed(() => statusOf(assignment.value || {}))
const points = computed(() => (Number(assignment.value?.points) > 0 ? Number(assignment.value.points) : 100))
const questions = computed(() => assignment.value?.questions || [])
const roster = computed(() => assignment.value?.roster || [])

// ── numbers ──
const scoreOf = (s) => {
  const v = s?.score ?? s?.grade
  return v === null || v === undefined ? null : Number(v)
}
const earned = (s) => Math.round((scoreOf(s) / 100) * points.value * 10) / 10
const isLate = (s) => !!assignment.value?.due_date && !!s?.submitted_at && new Date(s.submitted_at) > new Date(assignment.value.due_date)

const submittedRows = computed(() => roster.value.filter(r => r.submission))
const submittedCount = computed(() => submittedRows.value.length)
const pendingCount = computed(() => roster.value.length - submittedCount.value)
const lateCount = computed(() => submittedRows.value.filter(r => isLate(r.submission)).length)
const averagePoints = computed(() => {
  const scores = submittedRows.value.map(r => scoreOf(r.submission)).filter(v => v !== null)
  if (!scores.length) return '—'
  return Math.round((scores.reduce((t, v) => t + v, 0) / scores.length / 100) * points.value)
})
const medianOf = (nums) => {
  const v = [...nums].sort((x, y) => x - y)
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}
const scoreNote = computed(() => {
  const pts = submittedRows.value.map(r => scoreOf(r.submission)).filter(v => v !== null).map(v => Math.round((v / 100) * points.value))
  return pts.length ? `Median ${Math.round(medianOf(pts))} · lowest ${Math.min(...pts)}` : 'No scores yet'
})
const timeLeft = computed(() => {
  if (!assignment.value?.due_date || status.value === 'closed') return status.value === 'closed' ? 'Closed' : ''
  return `${relativeTime(assignment.value.due_date).replace(/^in /, '')} left`
})
const summary = computed(() => [
  { label: 'Submitted', value: submittedCount.value, of: roster.value.length, bar: roster.value.length ? Math.round((submittedCount.value / roster.value.length) * 100) : 0 },
  { label: 'Not submitted', value: pendingCount.value, note: timeLeft.value },
  { label: 'Average score', value: averagePoints.value, of: averagePoints.value === '—' ? null : points.value, accent: true, note: scoreNote.value },
  { label: 'Late', value: lateCount.value, note: assignment.value?.type === 'quiz' ? 'Quizzes close at the due date' : 'Late submissions allowed' },
])

// ── tabs ──
const tab = ref('students')
const tabs = computed(() => [
  { id: 'students', label: 'Students' },
  ...(assignment.value?.type === 'quiz' ? [{ id: 'questions', label: 'Questions' }] : []),
])

// ── students tab ──
const FILTERS = [
  { id: 'submitted', label: 'Submitted' },
  { id: 'missing', label: 'Not submitted' },
  { id: 'late', label: 'Late' },
  { id: 'all', label: 'All' },
]
const filter = ref('submitted')
const filterCounts = computed(() => ({
  submitted: submittedCount.value,
  missing: pendingCount.value,
  late: lateCount.value,
  all: roster.value.length,
}))
const search = ref('')
const sort = ref('none') // none | desc | asc
const cycleSort = () => { sort.value = sort.value === 'none' ? 'desc' : sort.value === 'desc' ? 'asc' : 'none' }

const SHOW_LIMIT = 8
const showAll = ref(false)
const allRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  const time = (r) => new Date(r.submission?.submitted_at || 0).getTime()
  // Submitted first (latest first), then the rest in server order.
  let list = [
    ...roster.value.filter(r => r.submission).sort((a, b) => time(b) - time(a)),
    ...roster.value.filter(r => !r.submission),
  ]
  const f = filter.value
  if (f === 'submitted') list = list.filter(r => r.submission)
  else if (f === 'missing') list = list.filter(r => !r.submission)
  else if (f === 'late') list = list.filter(r => r.submission && isLate(r.submission))
  if (q) list = list.filter(r => `${r.student?.name || ''} ${r.student?.email || ''}`.toLowerCase().includes(q))
  if (sort.value !== 'none') {
    const dir = sort.value === 'desc' ? -1 : 1
    const val = (r) => (r.submission ? scoreOf(r.submission) ?? -1 : -2)
    list = [...list].sort((a, b) => (val(a) - val(b)) * dir)
  }
  return list
})
// Long lists start at 8 rows; searching or "Show all" lifts the cap.
const capped = computed(() => !showAll.value && !search.value.trim() && allRows.value.length > SHOW_LIMIT)
const rows = computed(() => (capped.value ? allRows.value.slice(0, SHOW_LIMIT) : allRows.value))

// The server allows one reminder per 12 hours; within that, show "Reminded …".
const recentReminder = computed(() => {
  const at = assignment.value?.last_reminder?.created_at
  return !!at && Date.now() - new Date(at).getTime() < 12 * 3600e3
})

const isPastDue = computed(() => !!assignment.value?.due_date && new Date(assignment.value.due_date) < new Date())
const initialsOf = (name) => {
  const w = (name || '?').trim().split(/\s+/)
  return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : w[0].slice(0, 2)).toUpperCase()
}
const lowScore = (r) => r.submission && scoreOf(r.submission) !== null && scoreOf(r.submission) < 80
const rowStatus = (r) => {
  if (r.submission) {
    return isLate(r.submission)
      ? { label: 'Late', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300' }
      : { label: 'Submitted', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300' }
  }
  return isPastDue.value
    ? { label: 'Missing', cls: 'bg-slate-200 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300' }
    : { label: 'Not submitted', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300' }
}

// ── student side panel ──
const selected = ref(null)
const answerOf = (row, q) => row.submission?.answers?.[q.id] ?? ''

// ── answers ──
const letterFor = (q, text) => LETTERS[(q.options || []).indexOf(text)] || '?'
const isRight = (row, q) => !!answerOf(row, q) && answerOf(row, q) === q.correct_answer
const correctCountOf = (row) => questions.value.filter(q => isRight(row, q)).length

// ── questions tab ──
const LETTERS = 'ABCDEFGH'
const questionStats = computed(() => questions.value.map((q, i) => {
  const answered = submittedRows.value.map(r => answerOf(r, q)).filter(Boolean)
  const correct = answered.filter(a => a === q.correct_answer).length
  const counts = {}
  answered.filter(a => a !== q.correct_answer).forEach((a) => { counts[a] = (counts[a] || 0) + 1 })
  const [wrongText, wrongCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || []
  const letterOf = (text) => LETTERS[(q.options || []).indexOf(text)] || '?'
  return {
    id: q.id,
    number: i + 1,
    question: q.question,
    answered: answered.length,
    percent: answered.length ? Math.round((correct / answered.length) * 100) : null,
    correct: q.correct_answer,
    correctLetter: letterOf(q.correct_answer),
    reteach: answered.length > 0 && Math.round((correct / answered.length) * 100) < 60,
    topWrong: wrongText ? { text: wrongText, letter: letterOf(wrongText), count: wrongCount } : null,
  }
}))

// ── remind ──
const remind = ref(null)
const openRemind = () => {
  const a = assignment.value
  const when = a.due_date ? ` មុនថ្ងៃ ${formatShort(a.due_date).replace(' · ', ' ម៉ោង ')}` : ''
  remind.value = {
    body: `កុំភ្លេចធ្វើកិច្ចការ «${a.title}»${when} ណា!`,
    busy: false,
    error: '',
  }
}
const sendRemind = async () => {
  remind.value.busy = true
  remind.value.error = ''
  try {
    const { sent, reminded_at } = await assignmentService.remindStudents(assignmentId, { title: `⏰ ${assignment.value.title}`.slice(0, 120), body: remind.value.body.trim() })
    assignment.value.last_reminder = { title: assignment.value.title, body: remind.value.body, sent, created_at: reminded_at || new Date().toISOString() }
    remind.value = null
  } catch (err) {
    remind.value.error = err.response?.data?.error || err.message || 'Could not send the reminder'
    remind.value.busy = false
  }
}

// ── export ──
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const exportCsv = () => {
  const head = ['Name', 'Email', 'Status', `Score (/${points.value})`, 'Percent', 'Submitted at']
  const lines = roster.value.map((r) => {
    const s = r.submission
    return [
      r.student?.name, r.student?.email, rowStatus(r).label,
      s && scoreOf(s) !== null ? earned(s) : '', s && scoreOf(s) !== null ? scoreOf(s) : '',
      s ? formatDateTime(s.submitted_at) : '',
    ].map(csvCell).join(',')
  })
  // BOM so Excel opens Khmer names correctly.
  const blob = new Blob(['﻿' + [head.map(csvCell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(assignment.value.title || 'results').replace(/[\\/:*?"<>|]+/g, '_')}-results.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

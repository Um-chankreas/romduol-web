<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'

// Class roster for one course: where every enrolled student currently is,
// plus the numbers a teacher scans to spot who needs a nudge. Presentational:
// the parent fetches insightsService.getCourseStudents() and passes it in.
// Shapes: ../lms-backend/src/routes/studentInsights.routes.js
//
// Layout switches on the component's own width (container queries), not the
// viewport's — it sits in a narrow tab column next to the sidebar, so a
// viewport breakpoint would show the wide table where it doesn't fit.
const props = defineProps({
  // { course, lessons, summary, students } — null while unknown
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null }
})
const emit = defineEmits(['retry'])

const router = useRouter()

const STATUS = {
  on_track: { label: 'On track', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', dot: 'bg-emerald-500' },
  behind: { label: 'Behind', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', dot: 'bg-amber-500' },
  inactive: { label: 'Inactive', chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', dot: 'bg-red-500' },
  not_started: { label: 'Not started', chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', dot: 'bg-slate-400' },
  completed: { label: 'Completed', chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300', dot: 'bg-indigo-500' }
}
const STATUS_FILTERS = ['all', 'on_track', 'behind', 'inactive', 'not_started', 'completed']
const NEEDS_ATTENTION = new Set(['inactive', 'behind', 'not_started'])

const students = computed(() => props.data?.students || [])
const lessons = computed(() => props.data?.lessons || [])
const summary = computed(() => props.data?.summary || {})

// ── Summary tiles ─────────────────────────────────────────────────────────
const pctOfClass = (n) => (summary.value.students ? Math.round(((n || 0) / summary.value.students) * 100) : 0)
const needsAttention = computed(() => students.value.filter((s) => NEEDS_ATTENTION.has(s.status)).length)

const tiles = computed(() => {
  const s = summary.value
  return [
    { label: 'Students', value: s.students ?? 0, hint: 'enrolled', icon: '👥' },
    { label: 'Avg progress', value: `${s.avg_progress ?? 0}%`, hint: 'of units done', icon: '📈' },
    { label: 'Active (7d)', value: s.active_7d ?? 0, hint: `${pctOfClass(s.active_7d)}% of class`, icon: '⚡' },
    { label: 'Completed', value: s.completed ?? 0, hint: `${pctOfClass(s.completed)}% of class`, icon: '🏁' },
    {
      label: 'Needs attention',
      value: needsAttention.value,
      hint: 'inactive, behind or not started',
      icon: '⚠️',
      warn: needsAttention.value > 0
    },
    { label: 'Quiz average', value: s.avg_quiz_score != null ? `${s.avg_quiz_score}%` : '—', hint: 'best score per quiz', icon: '🎯' }
  ]
})

// ── "Where the class is" distribution ────────────────────────────────────
// FINISHED is a pseudo-chapter for the last bucket. It is keyed on "no
// current chapter" (every chapter has a lesson completion) rather than on
// status, so a student who read every unit but still has quizzes pending
// stays in their chapter's bar and the buckets add up to the class size.
const FINISHED = '__finished'
const chapterFilter = ref(null) // lesson_id | FINISHED | null

const hasFinished = (s) => !s.progress?.current && (s.progress?.units_total || 0) > 0

const isOnChapter = (s, key) =>
  key === FINISHED ? hasFinished(s) : s.progress?.current?.lesson_id === key

const chapterRows = computed(() => {
  const here = new Map()
  students.value.forEach((s) => {
    const id = s.progress?.current?.lesson_id
    if (!id) return
    if (!here.has(id)) here.set(id, [])
    here.get(id).push(s)
  })
  return lessons.value.map((l) => ({ ...l, students: here.get(l.lesson_id) || [] }))
})
const finishedStudents = computed(() => students.value.filter(hasFinished))

// Bars are scaled to the busiest bucket so the shape stays readable in a big
// class; the count next to each bar is the absolute number.
const bucketMax = computed(() =>
  Math.max(1, finishedStudents.value.length, ...lessons.value.map((l) => l.students_here || 0))
)
const barWidth = (n) => (n > 0 ? `${Math.max(4, (n / bucketMax.value) * 100)}%` : '0%')

const toggleChapter = (key) => {
  chapterFilter.value = chapterFilter.value === key ? null : key
}

const activeChapterLabel = computed(() => {
  if (!chapterFilter.value) return ''
  if (chapterFilter.value === FINISHED) return 'Finished the course'
  const l = lessons.value.find((x) => x.lesson_id === chapterFilter.value)
  return l ? `Ch ${l.index} · ${l.title}` : ''
})

// A refresh can drop the chapter being filtered on (deleted by the teacher).
watch(lessons, (list) => {
  if (chapterFilter.value && chapterFilter.value !== FINISHED && !list.some((l) => l.lesson_id === chapterFilter.value)) {
    chapterFilter.value = null
  }
})

// ── Search / status filter / sort ────────────────────────────────────────
const search = ref('')
const statusFilter = ref('all')
const sortBy = ref('progress')

const nameOf = (s) => s.student?.name || ''
const byName = (a, b) => nameOf(a).localeCompare(nameOf(b))
// Numeric descending with missing values last, ties broken by name.
const desc = (get) => (a, b) => {
  const x = get(a)
  const y = get(b)
  if (x == null || y == null) return x == null && y == null ? byName(a, b) : x == null ? 1 : -1
  return y - x || byName(a, b)
}
const timeOf = (iso) => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

const SORTS = [
  { id: 'progress', label: 'Progress', cmp: desc((s) => s.progress?.percentage ?? 0) },
  { id: 'name', label: 'Name', cmp: byName },
  { id: 'last_active', label: 'Last active', cmp: desc((s) => timeOf(s.activity?.last_active)) },
  { id: 'xp', label: 'Course XP', cmp: desc((s) => s.xp?.course ?? 0) },
  { id: 'quiz', label: 'Quiz avg', cmp: desc((s) => s.quizzes?.avg_score) }
]

// Search + chapter narrow the list first; the status chips count within that.
const baseList = computed(() => {
  const q = search.value.trim().toLowerCase()
  return students.value.filter((s) => {
    if (chapterFilter.value && !isOnChapter(s, chapterFilter.value)) return false
    if (!q) return true
    return nameOf(s).toLowerCase().includes(q) || (s.student?.email || '').toLowerCase().includes(q)
  })
})

const statusCounts = computed(() => {
  const counts = Object.fromEntries(STATUS_FILTERS.map((f) => [f, 0]))
  counts.all = baseList.value.length
  baseList.value.forEach((s) => {
    if (counts[s.status] !== undefined) counts[s.status] += 1
  })
  return counts
})

const visible = computed(() => {
  const list = statusFilter.value === 'all'
    ? [...baseList.value]
    : baseList.value.filter((s) => s.status === statusFilter.value)
  const sort = SORTS.find((o) => o.id === sortBy.value) || SORTS[0]
  return list.sort(sort.cmp)
})

const hasFilters = computed(() => !!(search.value.trim() || statusFilter.value !== 'all' || chapterFilter.value))
const clearFilters = () => {
  search.value = ''
  statusFilter.value = 'all'
  chapterFilter.value = null
}

// ── Row helpers ──────────────────────────────────────────────────────────
const profileRoute = (s) => ({ name: 'StudentProfile', params: { id: s.student.id } })
const openProfile = (s) => router.push(profileRoute(s))

const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
const brokenAvatars = reactive(new Set())
const hasAvatar = (st) => !!st?.avatar_url && !brokenAvatars.has(st.avatar_url)

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// "Ch 3 · Unit 2/5" + the unit (or chapter) title underneath.
const position = (p) => {
  if (!p || !p.units_total) return { label: '—', detail: '', title: 'This class has no chapters yet' }
  const c = p.current
  if (!c) return { label: 'Finished', detail: 'All chapters complete', title: 'All chapters complete' }
  const title = `Chapter ${c.lesson_index}: ${c.lesson_title || ''}${c.unit_title ? ` — ${c.unit_title}` : ''}`
  if (c.step === 'quiz') return { label: `Ch ${c.lesson_index} · quizzes pending`, detail: c.lesson_title || '', title }
  if (c.step === 'unit') {
    return { label: `Ch ${c.lesson_index} · Unit ${c.unit_index}/${c.units_in_lesson}`, detail: c.unit_title || c.lesson_title || '', title }
  }
  return { label: `Ch ${c.lesson_index}`, detail: c.lesson_title || '', title }
}

const lastActiveLabel = (a) => {
  const d = a?.days_inactive
  if (d == null) return 'never'
  if (d <= 0) return 'today'
  return `${d}d ago`
}
const lastActiveTone = (a) => {
  const d = a?.days_inactive
  if (d == null || d >= 7) return 'text-red-600 dark:text-red-400'
  return 'text-slate-600 dark:text-slate-300'
}

const subChip = (sub) => {
  if (sub?.is_active) {
    return {
      label: 'Active',
      long: 'Subscription active',
      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      title: sub.expiry_date ? `Subscribed until ${formatDate(sub.expiry_date)}` : 'Subscribed'
    }
  }
  if (sub?.expiry_date) {
    return {
      label: 'Expired',
      long: 'Subscription expired',
      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      title: `Expired ${formatDate(sub.expiry_date)}`
    }
  }
  return {
    label: 'None',
    long: 'No subscription',
    cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    title: 'No subscription for this course'
  }
}

const quizTone = (score) => {
  if (score == null) return 'text-slate-400'
  if (score < 50) return 'text-red-600 dark:text-red-400'
  return 'text-slate-900 dark:text-white'
}
</script>

<template>
  <div class="@container space-y-4">
    <!-- LOADING SKELETON -->
    <div v-if="loading && !data" class="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading students">
      <div class="grid grid-cols-2 @xl:grid-cols-3 @4xl:grid-cols-6 gap-3">
        <div
          v-for="i in 6"
          :key="i"
          class="h-24 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 space-y-3"
        >
          <div class="h-2.5 w-16 rounded bg-slate-200 dark:bg-slate-800"></div>
          <div class="h-6 w-12 rounded bg-slate-200 dark:bg-slate-800"></div>
          <div class="h-2 w-20 rounded bg-slate-100 dark:bg-slate-800/60"></div>
        </div>
      </div>
      <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 space-y-4">
        <div class="h-3 w-32 rounded bg-slate-200 dark:bg-slate-800"></div>
        <div v-for="i in 4" :key="i" class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0"></div>
          <div class="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800"></div>
        </div>
      </div>
      <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        <div v-for="i in 5" :key="i" class="flex items-center gap-3 p-4">
          <div class="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-800"></div>
            <div class="h-2 w-2/3 rounded bg-slate-100 dark:bg-slate-800/60"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ERROR -->
    <div
      v-else-if="error"
      class="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center"
      role="alert"
    >
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <button
        type="button"
        @click="emit('retry')"
        class="mt-3 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer active:scale-95"
      >
        Retry
      </button>
    </div>

    <!-- EMPTY -->
    <div
      v-else-if="!students.length"
      class="w-full border-2 border-dashed border-slate-200/80 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900/30 p-8 text-center shadow-xs"
    >
      <div class="w-12 h-12 rounded-full bg-emerald-100 dark:bg-slate-800 text-[#006A3A] dark:text-emerald-400 flex items-center justify-center text-xl mb-3 mx-auto">👥</div>
      <h3 class="text-base font-bold text-slate-900 dark:text-white">No students enrolled yet</h3>
      <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">Students show up here with their progress once they join this class.</p>
    </div>

    <template v-else>
      <!-- SUMMARY TILES -->
      <div class="grid grid-cols-2 @xl:grid-cols-3 @4xl:grid-cols-6 gap-3">
        <div
          v-for="t in tiles"
          :key="t.label"
          :class="[
            'rounded-2xl p-4 border shadow-xs min-w-0',
            t.warn
              ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200/80 dark:border-amber-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
          ]"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{{ t.label }}</span>
            <span class="text-sm shrink-0">{{ t.icon }}</span>
          </div>
          <p :class="['text-2xl font-extrabold mt-1.5 tabular-nums', t.warn ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white']">
            {{ t.value }}
          </p>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 truncate" :title="t.hint">{{ t.hint }}</p>
        </div>
      </div>

      <!-- WHERE THE CLASS IS -->
      <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="min-w-0">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Where the class is</h3>
            <p class="text-[11px] text-slate-400 dark:text-slate-500">Each student's current chapter · tap one to filter the list</p>
          </div>
          <button
            v-if="chapterFilter"
            type="button"
            @click="chapterFilter = null"
            class="shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Clear
          </button>
        </div>

        <p v-if="!chapterRows.length" class="py-4 text-center text-xs text-slate-400">This class has no chapters yet.</p>
        <ul v-else class="space-y-0.5 max-h-[26rem] overflow-y-auto custom-scrollbar -mx-2">
          <li v-for="row in chapterRows" :key="row.lesson_id">
            <button
              type="button"
              @click="toggleChapter(row.lesson_id)"
              :aria-pressed="chapterFilter === row.lesson_id"
              :title="`${row.students_here} student${row.students_here === 1 ? '' : 's'} on chapter ${row.index}`"
              :class="[
                'w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition cursor-pointer',
                chapterFilter === row.lesson_id
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-inset ring-emerald-300 dark:ring-emerald-700'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
              ]"
            >
              <span
                :class="[
                  'w-7 h-7 rounded-lg grid place-items-center text-[11px] font-bold shrink-0',
                  chapterFilter === row.lesson_id
                    ? 'bg-[#006A3A] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                ]"
              >{{ row.index }}</span>
              <span class="min-w-0 flex-1">
                <span class="flex items-baseline justify-between gap-2">
                  <span class="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{{ row.title }}</span>
                  <span class="shrink-0 text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">{{ row.students_here }}</span>
                </span>
                <span class="mt-1.5 block h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <span class="block h-full rounded-full bg-[#006A3A] dark:bg-emerald-500 transition-all" :style="{ width: barWidth(row.students_here) }"></span>
                </span>
              </span>
              <span class="hidden @xs:flex w-[76px] justify-end -space-x-1.5 shrink-0" aria-hidden="true">
                <template v-for="s in row.students.slice(0, 5)" :key="s.student.id">
                  <img
                    v-if="hasAvatar(s.student)"
                    :src="s.student.avatar_url"
                    @error="brokenAvatars.add(s.student.avatar_url)"
                    class="w-5 h-5 rounded-full object-cover ring-2 ring-white dark:ring-slate-900"
                    alt=""
                  />
                  <span
                    v-else
                    class="w-5 h-5 rounded-full bg-emerald-100 dark:bg-slate-700 text-emerald-800 dark:text-emerald-200 text-[8px] font-bold grid place-items-center ring-2 ring-white dark:ring-slate-900 select-none"
                  >{{ initials(s.student.name).charAt(0) }}</span>
                </template>
              </span>
            </button>
          </li>
        </ul>

        <!-- Finished bucket -->
        <div v-if="chapterRows.length" class="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800 -mx-2">
          <button
            type="button"
            @click="toggleChapter(FINISHED)"
            :aria-pressed="chapterFilter === FINISHED"
            :title="`${finishedStudents.length} student${finishedStudents.length === 1 ? '' : 's'} finished the course`"
            :class="[
              'w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition cursor-pointer',
              chapterFilter === FINISHED
                ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-inset ring-indigo-300 dark:ring-indigo-700'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
            ]"
          >
            <span class="w-7 h-7 rounded-lg grid place-items-center text-xs font-bold shrink-0 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">✓</span>
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline justify-between gap-2">
                <span class="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">Finished</span>
                <span class="shrink-0 text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">{{ finishedStudents.length }}</span>
              </span>
              <span class="mt-1.5 block h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <span class="block h-full rounded-full bg-indigo-500 transition-all" :style="{ width: barWidth(finishedStudents.length) }"></span>
              </span>
            </span>
            <span class="hidden @xs:flex w-[76px] justify-end -space-x-1.5 shrink-0" aria-hidden="true">
              <template v-for="s in finishedStudents.slice(0, 5)" :key="s.student.id">
                <img
                  v-if="hasAvatar(s.student)"
                  :src="s.student.avatar_url"
                  @error="brokenAvatars.add(s.student.avatar_url)"
                  class="w-5 h-5 rounded-full object-cover ring-2 ring-white dark:ring-slate-900"
                  alt=""
                />
                <span
                  v-else
                  class="w-5 h-5 rounded-full bg-indigo-100 dark:bg-slate-700 text-indigo-800 dark:text-indigo-200 text-[8px] font-bold grid place-items-center ring-2 ring-white dark:ring-slate-900 select-none"
                >{{ initials(s.student.name).charAt(0) }}</span>
              </template>
            </span>
          </button>
        </div>
      </section>

      <!-- STUDENT LIST -->
      <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <!-- Controls -->
        <div class="p-4 space-y-3 border-b border-slate-100 dark:border-slate-800">
          <div class="flex flex-col @md:flex-row gap-2">
            <div class="relative flex-1 min-w-0">
              <input
                v-model="search"
                type="search"
                placeholder="Search students…"
                aria-label="Search students by name"
                class="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
            </div>
            <label class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              Sort by
              <select
                v-model="sortBy"
                class="flex-1 @md:flex-none px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option v-for="o in SORTS" :key="o.id" :value="o.id">{{ o.label }}</option>
              </select>
            </label>
          </div>

          <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            <button
              v-for="f in STATUS_FILTERS"
              :key="f"
              type="button"
              @click="statusFilter = f"
              :aria-pressed="statusFilter === f"
              :class="[
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer',
                statusFilter === f
                  ? 'bg-[#006A3A] text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              ]"
            >
              <span v-if="f !== 'all'" :class="['w-1.5 h-1.5 rounded-full', STATUS[f].dot]"></span>
              {{ f === 'all' ? 'All' : STATUS[f].label }}
              <span :class="['tabular-nums font-semibold', statusFilter === f ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500']">{{ statusCounts[f] }}</span>
            </button>
          </div>

          <div v-if="activeChapterLabel" class="flex">
            <span class="inline-flex items-center gap-1.5 max-w-full pl-2.5 pr-1 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
              <span class="truncate">On {{ activeChapterLabel }}</span>
              <button
                type="button"
                @click="chapterFilter = null"
                class="shrink-0 w-5 h-5 grid place-items-center rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer"
                aria-label="Clear chapter filter"
              >✕</button>
            </span>
          </div>
        </div>

        <!-- No matches -->
        <div v-if="!visible.length" class="p-10 text-center">
          <p class="text-sm text-slate-500 dark:text-slate-400">No students match these filters.</p>
          <button
            v-if="hasFilters"
            type="button"
            @click="clearFilters"
            class="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Clear filters
          </button>
        </div>

        <template v-else>
          <!-- Wide: table (scrolls inside its own box if still too narrow) -->
          <div class="hidden @2xl:block overflow-x-auto custom-scrollbar">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th class="px-4 py-3 font-bold sticky left-0 z-10 bg-slate-50 dark:bg-slate-800">Student</th>
                  <th class="px-3 py-3 font-bold">Position</th>
                  <th class="px-3 py-3 font-bold">Progress</th>
                  <th class="px-3 py-3 font-bold">Course XP</th>
                  <th class="px-3 py-3 font-bold">Quiz avg</th>
                  <th class="px-3 py-3 font-bold">Assignments</th>
                  <th class="px-3 py-3 font-bold">Last active</th>
                  <th class="px-3 py-3 font-bold">Subscription</th>
                  <th class="px-3 py-3 pr-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr
                  v-for="s in visible"
                  :key="s.student.id"
                  @click="openProfile(s)"
                  class="group cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <!-- Student -->
                  <td class="px-4 py-3 sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition">
                    <div class="flex items-center gap-3">
                      <img
                        v-if="hasAvatar(s.student)"
                        :src="s.student.avatar_url"
                        @error="brokenAvatars.add(s.student.avatar_url)"
                        class="h-9 w-9 rounded-full object-cover shrink-0"
                        alt=""
                      />
                      <div v-else class="h-9 w-9 rounded-full bg-[#006A3A] text-white flex items-center justify-center text-xs font-bold shrink-0 select-none">
                        {{ initials(s.student.name) }}
                      </div>
                      <div class="min-w-0 max-w-[12rem]">
                        <p class="flex items-center gap-1.5 min-w-0">
                          <router-link
                            :to="profileRoute(s)"
                            @click.stop
                            class="truncate font-semibold text-slate-900 dark:text-white hover:text-[#006A3A] dark:hover:text-emerald-400 hover:underline"
                          >{{ s.student.name || 'Student' }}</router-link>
                          <span v-if="s.student.is_active === false" class="shrink-0 text-[10px] font-bold text-red-500 uppercase">deactivated</span>
                        </p>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate">{{ s.student.email || s.student.phone || 'No contact' }}</p>
                      </div>
                    </div>
                  </td>

                  <!-- Position -->
                  <td class="px-3 py-3" :title="position(s.progress).title">
                    <p class="text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{{ position(s.progress).label }}</p>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[11rem]">{{ position(s.progress).detail }}</p>
                  </td>

                  <!-- Progress -->
                  <td class="px-3 py-3">
                    <div class="flex items-center gap-2" :title="`${s.progress?.units_done ?? 0}/${s.progress?.units_total ?? 0} units · ${s.progress?.lessons_done ?? 0}/${s.progress?.lessons_total ?? 0} chapters`">
                      <div class="w-20 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          :class="['h-full rounded-full', s.status === 'completed' ? 'bg-indigo-500' : 'bg-[#006A3A] dark:bg-emerald-500']"
                          :style="{ width: `${s.progress?.percentage ?? 0}%` }"
                        ></div>
                      </div>
                      <span class="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200 w-9">{{ s.progress?.percentage ?? 0 }}%</span>
                    </div>
                  </td>

                  <!-- Course XP -->
                  <td class="px-3 py-3 whitespace-nowrap" :title="`${s.xp?.total ?? 0} XP overall`">
                    <p class="text-xs font-bold tabular-nums text-slate-900 dark:text-white">{{ s.xp?.course ?? 0 }} XP</p>
                    <p class="text-[11px] text-slate-400">Lv {{ s.xp?.level ?? 1 }}</p>
                  </td>

                  <!-- Quiz avg -->
                  <td class="px-3 py-3 whitespace-nowrap" :title="`${s.quizzes?.passed ?? 0} passed`">
                    <p :class="['text-xs font-bold tabular-nums', quizTone(s.quizzes?.avg_score)]">
                      {{ s.quizzes?.avg_score != null ? `${s.quizzes.avg_score}%` : '—' }}
                    </p>
                    <p class="text-[11px] text-slate-400 tabular-nums">{{ s.quizzes?.attempted ?? 0 }}/{{ s.quizzes?.total ?? 0 }} taken</p>
                  </td>

                  <!-- Assignments -->
                  <td class="px-3 py-3 whitespace-nowrap">
                    <template v-if="s.assignments?.total">
                      <p class="text-xs font-bold tabular-nums text-slate-900 dark:text-white">{{ s.assignments.submitted }}/{{ s.assignments.total }}</p>
                      <p v-if="s.assignments.missing" class="text-[11px] font-semibold text-red-600 dark:text-red-400">{{ s.assignments.missing }} missing</p>
                      <p v-else class="text-[11px] text-slate-400">submitted</p>
                      <p v-if="s.assignments.avg_pct != null" class="text-[11px] text-slate-400 tabular-nums">avg {{ s.assignments.avg_pct }}%</p>
                    </template>
                    <span v-else class="text-xs text-slate-400">—</span>
                  </td>

                  <!-- Last active -->
                  <td class="px-3 py-3 whitespace-nowrap" :title="formatDate(s.activity?.last_active)">
                    <p :class="['text-xs font-semibold', lastActiveTone(s.activity)]">{{ lastActiveLabel(s.activity) }}</p>
                    <p class="text-[11px] text-slate-400 tabular-nums">{{ s.activity?.active_days_7d ?? 0 }}/7 days · {{ s.activity?.study_minutes_7d ?? 0 }} min</p>
                  </td>

                  <!-- Subscription -->
                  <td class="px-3 py-3">
                    <span
                      :class="['px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide whitespace-nowrap', subChip(s.subscription).cls]"
                      :title="subChip(s.subscription).title"
                    >{{ subChip(s.subscription).label }}</span>
                  </td>

                  <!-- Status -->
                  <td class="px-3 py-3 pr-4">
                    <span :class="['px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap', STATUS[s.status]?.chip || STATUS.not_started.chip]">
                      {{ STATUS[s.status]?.label || s.status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Narrow: stacked cards -->
          <ul class="@2xl:hidden divide-y divide-slate-100 dark:divide-slate-800">
            <li v-for="s in visible" :key="s.student.id">
              <router-link
                :to="profileRoute(s)"
                class="block p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"
              >
                <div class="flex items-start gap-3">
                  <img
                    v-if="hasAvatar(s.student)"
                    :src="s.student.avatar_url"
                    @error="brokenAvatars.add(s.student.avatar_url)"
                    class="h-10 w-10 rounded-full object-cover shrink-0"
                    alt=""
                  />
                  <div v-else class="h-10 w-10 rounded-full bg-[#006A3A] text-white flex items-center justify-center text-xs font-bold shrink-0 select-none">
                    {{ initials(s.student.name) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-2">
                      <p class="min-w-0 flex items-center gap-1.5">
                        <span class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ s.student.name || 'Student' }}</span>
                        <span v-if="s.student.is_active === false" class="shrink-0 text-[10px] font-bold text-red-500 uppercase">deactivated</span>
                      </p>
                      <span :class="['shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap', STATUS[s.status]?.chip || STATUS.not_started.chip]">
                        {{ STATUS[s.status]?.label || s.status }}
                      </span>
                    </div>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate" :title="position(s.progress).title">
                      <span class="font-semibold text-slate-700 dark:text-slate-200">{{ position(s.progress).label }}</span>
                      <template v-if="position(s.progress).detail && s.progress?.current"> · {{ position(s.progress).detail }}</template>
                    </p>
                  </div>
                </div>

                <div class="mt-3 flex items-center gap-2">
                  <div class="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      :class="['h-full rounded-full', s.status === 'completed' ? 'bg-indigo-500' : 'bg-[#006A3A] dark:bg-emerald-500']"
                      :style="{ width: `${s.progress?.percentage ?? 0}%` }"
                    ></div>
                  </div>
                  <span class="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">{{ s.progress?.percentage ?? 0 }}%</span>
                </div>

                <dl class="mt-3 grid grid-cols-2 @sm:grid-cols-4 gap-x-3 gap-y-2 text-[11px]">
                  <div class="min-w-0">
                    <dt class="text-slate-400 dark:text-slate-500">Course XP</dt>
                    <dd class="font-bold text-slate-900 dark:text-white tabular-nums truncate">
                      {{ s.xp?.course ?? 0 }} <span class="font-medium text-slate-400">· Lv {{ s.xp?.level ?? 1 }}</span>
                    </dd>
                  </div>
                  <div class="min-w-0">
                    <dt class="text-slate-400 dark:text-slate-500">Quiz avg</dt>
                    <dd class="truncate tabular-nums">
                      <span :class="['font-bold', quizTone(s.quizzes?.avg_score)]">{{ s.quizzes?.avg_score != null ? `${s.quizzes.avg_score}%` : '—' }}</span>
                      <span class="text-slate-400"> ({{ s.quizzes?.attempted ?? 0 }}/{{ s.quizzes?.total ?? 0 }})</span>
                    </dd>
                  </div>
                  <div class="min-w-0">
                    <dt class="text-slate-400 dark:text-slate-500">Assignments</dt>
                    <dd class="truncate tabular-nums">
                      <template v-if="s.assignments?.total">
                        <span class="font-bold text-slate-900 dark:text-white">{{ s.assignments.submitted }}/{{ s.assignments.total }}</span>
                        <span v-if="s.assignments.missing" class="font-semibold text-red-600 dark:text-red-400"> · {{ s.assignments.missing }} missing</span>
                        <span v-if="s.assignments.avg_pct != null" class="text-slate-400"> · avg {{ s.assignments.avg_pct }}%</span>
                      </template>
                      <span v-else class="text-slate-400">—</span>
                    </dd>
                  </div>
                  <div class="min-w-0">
                    <dt class="text-slate-400 dark:text-slate-500">Last active</dt>
                    <dd class="truncate">
                      <span :class="['font-semibold', lastActiveTone(s.activity)]">{{ lastActiveLabel(s.activity) }}</span>
                      <span class="text-slate-400 tabular-nums"> · {{ s.activity?.study_minutes_7d ?? 0 }} min/7d</span>
                    </dd>
                  </div>
                </dl>

                <div class="mt-3 flex items-center gap-2">
                  <span
                    :class="['px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide whitespace-nowrap', subChip(s.subscription).cls]"
                    :title="subChip(s.subscription).title"
                  >{{ subChip(s.subscription).long }}</span>
                </div>
              </router-link>
            </li>
          </ul>
        </template>

        <div class="px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          Showing {{ visible.length }} of {{ students.length }} student{{ students.length === 1 ? '' : 's' }}
        </div>
      </section>
    </template>
  </div>
</template>

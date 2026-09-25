<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

// School-wide (admin) or my-classes-wide (teacher) "where are my students"
// panel for the dashboard. Data: GET /api/insights/overview — see
// services/insightsService.js for the shape.
const props = defineProps({
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
defineEmits(['retry'])

const router = useRouter()

// Same palette as the course roster (CourseStudentsProgress.vue).
const STATUS = [
  { key: 'on_track', label: 'On track', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  { key: 'behind', label: 'Behind', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  { key: 'inactive', label: 'Inactive', bar: 'bg-red-500', dot: 'bg-red-500' },
  { key: 'not_started', label: 'Not started', bar: 'bg-slate-300 dark:bg-slate-600', dot: 'bg-slate-400' },
  { key: 'completed', label: 'Completed', bar: 'bg-indigo-500', dot: 'bg-indigo-500' },
]

const num = (v) => Number(v) || 0
const arr = (v) => (Array.isArray(v) ? v : [])
const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

const totals = computed(() => props.data?.totals || {})
const courses = computed(() => arr(props.data?.courses))
const dailyActive = computed(() => arr(props.data?.daily_active))
const topLearners = computed(() => arr(props.data?.top_learners))

// Stacked-bar segments for a { on_track, behind, ... } count object.
const segments = (counts) => {
  const total = STATUS.reduce((s, st) => s + num(counts?.[st.key]), 0)
  if (!total) return []
  return STATUS
    .map(st => ({ ...st, count: num(counts?.[st.key]), pct: (num(counts?.[st.key]) / total) * 100 }))
    .filter(s => s.count > 0)
}
const overallSegments = computed(() => segments(totals.value))
const needsAttention = computed(() => num(totals.value.behind) + num(totals.value.inactive) + num(totals.value.not_started))

// Chapter histogram for a course card: one bar per chapter + "Finished".
const chapterBars = (course) => {
  const bars = arr(course.lessons).map(l => ({
    key: l.lesson_id,
    label: `Ch ${l.index}`,
    title: `Ch ${l.index} · ${l.title || 'Untitled'} — ${num(l.students_here)} student${num(l.students_here) === 1 ? '' : 's'}`,
    count: num(l.students_here),
    done: false,
  }))
  bars.push({
    key: 'finished',
    label: '✓',
    title: `Finished — ${num(course.finished)} student${num(course.finished) === 1 ? '' : 's'}`,
    count: num(course.finished),
    done: true,
  })
  const max = Math.max(1, ...bars.map(b => b.count))
  return bars.map(b => ({ ...b, height: b.count ? Math.max(12, (b.count / max) * 100) : 0 }))
}

// The chapter most students are currently sitting on, for the card caption.
const busiestChapter = (course) => {
  const top = arr(course.lessons).reduce((best, l) => (num(l.students_here) > num(best?.students_here) ? l : best), null)
  return top && num(top.students_here) > 0 ? top : null
}

const maxDaily = computed(() => Math.max(1, ...dailyActive.value.map(d => num(d.students))))
const dayLabel = (iso) => {
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
const activeToday = computed(() => num(dailyActive.value[dailyActive.value.length - 1]?.students))
const avgDaily = computed(() => {
  const d = dailyActive.value
  return d.length ? Math.round(d.reduce((s, x) => s + num(x.students), 0) / d.length) : 0
})

const openCourse = (id) => router.push({ path: `/courses/${id}`, query: { tab: 'students' } })
const openStudent = (id) => router.push({ name: 'StudentProfile', params: { id } })
</script>

<template>
  <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
      <div>
        <h2 class="text-base font-bold text-slate-900 dark:text-white">🧭 Where your students are</h2>
        <p class="text-[11px] text-slate-400">Progress across every class · click a class or student for details</p>
      </div>
      <div v-if="data && !loading" class="flex items-center gap-4 text-xs">
        <div><span class="font-extrabold text-slate-900 dark:text-white text-lg">{{ num(totals.avg_progress) }}%</span> <span class="text-slate-400">avg progress</span></div>
        <div><span class="font-extrabold text-amber-600 text-lg">{{ needsAttention }}</span> <span class="text-slate-400">need attention</span></div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading && !data" class="space-y-4 animate-pulse">
      <div class="h-3 rounded-full bg-slate-100 dark:bg-slate-800"></div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div v-for="i in 4" :key="i" class="h-40 rounded-xl bg-slate-100 dark:bg-slate-800"></div>
        </div>
        <div class="h-80 rounded-xl bg-slate-100 dark:bg-slate-800"></div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error && !data" class="py-8 text-center">
      <p class="text-sm text-red-500">{{ error }}</p>
      <button @click="$emit('retry')" class="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">Retry</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!courses.length" class="py-8 text-center text-xs text-slate-400">
      No classes with enrolled students yet.
    </div>

    <template v-else>
      <!-- Overall status bar -->
      <div>
        <div class="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          <div
            v-for="s in overallSegments"
            :key="s.key"
            :class="s.bar"
            :style="{ width: s.pct + '%' }"
            :title="`${s.label}: ${s.count}`"
          ></div>
        </div>
        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <span v-for="s in STATUS" :key="s.key" class="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span :class="['w-2 h-2 rounded-full', s.dot]"></span>
            {{ s.label }} <b class="text-slate-800 dark:text-slate-200">{{ num(totals[s.key]) }}</b>
          </span>
          <span class="text-[11px] text-slate-400">· {{ num(totals.enrollments) }} enrollments, {{ num(totals.students) }} students</span>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Course cards -->
        <div class="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
          <button
            v-for="c in courses"
            :key="c.course.id"
            type="button"
            @click="openCourse(c.course.id)"
            class="text-left p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-400/60 dark:hover:border-emerald-700 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition cursor-pointer min-w-0"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                :style="{ backgroundColor: (c.course.color || '#006A3A') + '22', color: c.course.color || '#006A3A' }"
              >{{ c.course.icon || '📘' }}</span>
              <p class="text-sm font-bold text-slate-900 dark:text-white truncate flex-1">{{ c.course.title || 'Untitled class' }}</p>
              <span class="text-[11px] text-slate-400 shrink-0">{{ num(c.students) }} 👤</span>
            </div>

            <!-- Avg progress -->
            <div class="mt-3 flex items-center gap-2">
              <div class="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div class="h-full rounded-full bg-[#006A3A] dark:bg-emerald-500" :style="{ width: Math.min(100, num(c.avg_progress)) + '%' }"></div>
              </div>
              <span class="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-9 text-right">{{ num(c.avg_progress) }}%</span>
            </div>

            <!-- Chapter histogram: how many students are on each chapter -->
            <div class="mt-3 flex items-end gap-0.5 h-14" aria-hidden="true">
              <div
                v-for="b in chapterBars(c)"
                :key="b.key"
                class="flex-1 min-w-[3px] h-full flex items-end"
                :title="b.title"
              >
                <div
                  :class="[
                    'w-full rounded-t-sm',
                    b.count === 0 ? 'bg-slate-100 dark:bg-slate-800 h-[3px]' : b.done ? 'bg-indigo-500' : 'bg-emerald-500/80',
                  ]"
                  :style="b.count ? { height: b.height + '%' } : null"
                ></div>
              </div>
            </div>
            <div class="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>Ch 1</span>
              <span>Finished</span>
            </div>

            <!-- Status mini bar + caption -->
            <div class="mt-2 flex h-1.5 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
              <div v-for="s in segments(c.status_counts)" :key="s.key" :class="s.bar" :style="{ width: s.pct + '%' }" :title="`${s.label}: ${s.count}`"></div>
            </div>
            <p class="mt-2 text-[11px] text-slate-500 dark:text-slate-400 truncate">
              <template v-if="busiestChapter(c)">
                Most are on <b class="text-slate-700 dark:text-slate-200">Ch {{ busiestChapter(c).index }} · {{ busiestChapter(c).title }}</b>
              </template>
              <template v-else-if="num(c.finished)">Everyone has finished 🎉</template>
              <template v-else>No progress yet</template>
            </p>
          </button>
        </div>

        <!-- Right column -->
        <div class="space-y-4 min-w-0">
          <!-- Daily active students -->
          <div class="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div class="flex items-baseline justify-between">
              <p class="text-xs font-bold text-slate-900 dark:text-white">Daily active students</p>
              <p class="text-[11px] text-slate-400">last {{ dailyActive.length }} days</p>
            </div>
            <div class="mt-1 flex items-baseline gap-3 text-[11px] text-slate-400">
              <span><b class="text-lg text-slate-900 dark:text-white">{{ activeToday }}</b> today</span>
              <span>avg {{ avgDaily }}/day</span>
            </div>
            <div class="mt-3 flex items-end gap-[2px] h-20">
              <div
                v-for="d in dailyActive"
                :key="d.day"
                class="flex-1 h-full flex items-end"
                :title="`${dayLabel(d.day)}: ${num(d.students)} active`"
              >
                <div
                  :class="['w-full rounded-t-sm', num(d.students) ? 'bg-emerald-500' : 'bg-slate-100 dark:bg-slate-800 h-[3px]']"
                  :style="num(d.students) ? { height: Math.max(8, (num(d.students) / maxDaily) * 100) + '%' } : null"
                ></div>
              </div>
            </div>
            <div class="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>{{ dayLabel(dailyActive[0]?.day) }}</span>
              <span>Today</span>
            </div>
          </div>

          <!-- Top learners this week -->
          <div class="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <p class="text-xs font-bold text-slate-900 dark:text-white">🏆 Top learners this week</p>
            <p v-if="!topLearners.length" class="py-6 text-center text-[11px] text-slate-400">No XP earned this week yet.</p>
            <ol v-else class="mt-2 space-y-1">
              <li v-for="(s, i) in topLearners" :key="s.student_id">
                <button
                  type="button"
                  @click="openStudent(s.student_id)"
                  class="w-full flex items-center gap-2.5 p-1.5 -mx-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer text-left"
                >
                  <span class="w-4 text-[11px] font-bold text-slate-400 text-center">{{ i + 1 }}</span>
                  <span class="w-7 h-7 rounded-full bg-emerald-100 dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold flex items-center justify-center shrink-0 overflow-hidden">
                    <img v-if="s.avatar_url" :src="s.avatar_url" class="w-full h-full object-cover" alt="" />
                    <span v-else>{{ initials(s.name) }}</span>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{{ s.name || 'Student' }}</span>
                    <span class="block text-[10px] text-slate-400">Lv {{ num(s.level) || 1 }}</span>
                  </span>
                  <span class="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">+{{ num(s.xp_7d) }} XP</span>
                </button>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

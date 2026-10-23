<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

// Live class attendance: a line per class over its last held live classes, plus
// the students who missed the latest one(s). Data: insightsService.getLearningOverview()
// -> { attendance, missed, totals.attendance_rate }.
const props = defineProps({
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})
const router = useRouter()

const COLORS = ['#0B6B3A', '#5B5BD6', '#E0A100', '#E5484D', '#0891B2', '#C026D3']
const W = 600, H = 250
const X0 = 44, X1 = 580, Y0 = 205, Y1 = 20
const TARGET = 80

const series = computed(() =>
  (props.data?.attendance || [])
    .filter(a => a.sessions.length)
    .map((a, i) => ({ course: a.course, color: COLORS[i % COLORS.length], sessions: a.sessions })))

const hasData = computed(() => series.value.length > 0)

// X is proportional to time across every class's sessions.
const times = computed(() => series.value.flatMap(s => s.sessions.map(p => new Date(p.date).getTime())))
const tMin = computed(() => Math.min(...times.value))
const tMax = computed(() => Math.max(...times.value))
const xOf = (date) => {
  const t = new Date(date).getTime()
  if (tMax.value === tMin.value) return (X0 + X1) / 2
  return X0 + ((t - tMin.value) / (tMax.value - tMin.value)) * (X1 - X0)
}
const yOf = (rate) => Y0 - ((rate ?? 0) / 100) * (Y1 - Y0 > 0 ? (Y0 - Y1) : 1)

const lines = computed(() => series.value.map(s => {
  const pts = s.sessions.filter(p => p.rate != null).map(p => ({ x: xOf(p.date), y: yOf(p.rate), p }))
  return { ...s, pts, d: pts.map((q, i) => `${i ? 'L' : 'M'}${q.x} ${q.y}`).join(' ') }
}))
const grid = [0, 25, 50, 75, 100].map(v => ({ v, y: yOf(v) }))
const xLabels = computed(() => {
  const dates = [...new Set(series.value.flatMap(s => s.sessions.map(p => p.date)))].sort()
  const step = Math.ceil(dates.length / 8)
  return dates.filter((_, i) => i % step === 0).map(d => ({
    x: xOf(d),
    t: new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
  }))
})

const missed = computed(() => props.data?.missed?.students || [])
const missedTotal = computed(() => props.data?.missed?.total || 0)
const rate = computed(() => props.data?.totals?.attendance_rate)
const initials = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const tag = (m) => (m.missed_in_a_row > 1 ? `Missed ${m.missed_in_a_row} in a row` : 'Missed last class')
const tagCls = (m) => (m.missed_in_a_row >= 3
  ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
  : m.missed_in_a_row === 2
    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')
const lastJoined = (m) => (m.last_joined
  ? new Date(m.last_joined + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  : 'never')
</script>

<template>
  <section class="grid grid-cols-1 xl:grid-cols-2 gap-4" aria-label="Live class attendance">
    <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-extrabold text-slate-900 dark:text-white">Live class attendance</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Share of enrolled students who joined each of the last live classes</p>
        </div>
        <span v-if="rate != null" class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ rate }}%</span>
      </div>

      <div v-if="loading && !data" class="h-56 mt-4 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
      <div v-else-if="!hasData" class="mt-4 py-12 text-center text-sm text-slate-400">No live classes held yet.</div>
      <template v-else>
        <svg :viewBox="`0 0 ${W} ${H}`" class="w-full mt-3 text-slate-500 dark:text-slate-400" role="img" aria-label="Attendance rate per live class">
          <g v-for="g in grid" :key="g.v">
            <line :x1="X0" :x2="X1" :y1="g.y" :y2="g.y" stroke="currentColor" stroke-opacity="0.2" />
            <text :x="X0 - 8" :y="g.y + 3" text-anchor="end" font-size="10" fill="currentColor">{{ g.v }}%</text>
          </g>
          <line :x1="X0" :x2="X1" :y1="yOf(TARGET)" :y2="yOf(TARGET)" stroke="#E0A100" stroke-dasharray="5 4" />
          <text :x="X1" :y="yOf(TARGET) - 5" text-anchor="end" font-size="10" fill="#B7860B">Target {{ TARGET }}%</text>
          <g v-for="l in lines" :key="l.course.id">
            <path :d="l.d" fill="none" :stroke="l.color" stroke-width="2.5" stroke-linejoin="round" />
            <circle v-for="q in l.pts" :key="q.p.live_class_id" :cx="q.x" :cy="q.y" r="4" fill="#fff" :stroke="l.color" stroke-width="2">
              <title>{{ l.course.title }} · {{ q.p.title }} · {{ q.p.attended }} of {{ q.p.eligible }} joined ({{ q.p.rate }}%)</title>
            </circle>
          </g>
          <text v-for="x in xLabels" :key="x.t + x.x" :x="x.x" y="228" text-anchor="middle" font-size="10" fill="currentColor">{{ x.t }}</text>
        </svg>
        <div class="flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <span v-for="l in lines" :key="l.course.id" class="flex items-center gap-1.5">
            <span class="w-4 h-[3px] rounded" :style="{ background: l.color }"></span>{{ l.course.title }}
          </span>
        </div>
      </template>
    </div>

    <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0">
      <div class="flex items-center gap-2">
        <h2 class="text-base font-extrabold text-slate-900 dark:text-white">Missed class</h2>
        <span v-if="missedTotal" class="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-[11px] font-extrabold">{{ missedTotal }}</span>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-2">Students who did not join the latest live class, most missed in a row first</p>

      <div v-if="loading && !data" class="space-y-3 mt-3"><div v-for="n in 4" :key="n" class="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse"></div></div>
      <div v-else-if="!missed.length" class="py-10 text-center text-sm text-slate-400">
        {{ hasData ? 'Everyone joined the latest live class.' : 'No live classes held yet.' }}
      </div>
      <ul v-else>
        <li
          v-for="m in missed"
          :key="m.student_id + m.course_id"
          class="flex items-center justify-between gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800 cursor-pointer"
          @click="router.push({ name: 'StudentProfile', params: { id: m.student_id } })"
        >
          <div class="flex items-center gap-3 min-w-0">
            <img v-if="m.avatar_url" :src="m.avatar_url" alt="" class="w-9 h-9 rounded-full object-cover shrink-0" />
            <span v-else class="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-extrabold flex items-center justify-center shrink-0">{{ initials(m.name) }}</span>
            <div class="min-w-0">
              <p class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ m.name }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 truncate">{{ m.course_title }} · last joined {{ lastJoined(m) }}</p>
            </div>
          </div>
          <span class="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold" :class="tagCls(m)">{{ tag(m) }}</span>
        </li>
      </ul>
      <p v-if="missedTotal > missed.length" class="text-xs text-slate-500 dark:text-slate-400 mt-2">Showing {{ missed.length }} of {{ missedTotal }}</p>
    </div>
  </section>
</template>

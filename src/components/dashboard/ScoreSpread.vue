<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

// Quiz score spread: a histogram (students per 10-point score band, one class
// or all) and a box-plot comparison of the classes. Each student counts once,
// by the average of their best score per quiz.
// Data: insightsService.getLearningOverview() -> { classes[].scores, scores_all }.
const props = defineProps({
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})

const classes = computed(() => (props.data?.classes || []).filter(c => c.scores?.n > 0))
const tabs = computed(() => [
  ...classes.value.map(c => ({ id: c.course.id, label: c.course.title, scores: c.scores })),
  ...(classes.value.length > 1 ? [{ id: 'all', label: 'All', scores: props.data?.scores_all }] : []),
])
const selected = ref('')
watch(tabs, (list) => {
  if (!list.some(t => t.id === selected.value)) selected.value = list[0]?.id || ''
}, { immediate: true })
const scores = computed(() => tabs.value.find(t => t.id === selected.value)?.scores || null)

// ── Histogram ──
const HW = 600, HH = 260, HX0 = 44, HX1 = 590, HY0 = 205, HY1 = 24
const bucketW = (HX1 - HX0) / 10
const hMax = computed(() => {
  const m = Math.max(1, ...(scores.value?.buckets || [1]))
  return Math.max(5, Math.ceil(m / 5) * 5)
})
const hy = (v) => HY0 - (v / hMax.value) * (HY0 - HY1)
const hGrid = computed(() => Array.from({ length: 5 }, (_, i) => Math.round((hMax.value / 4) * i)).map(v => ({ v, y: hy(v) })))
const hBars = computed(() => (scores.value?.buckets || []).map((n, i) => ({
  n, i,
  x: HX0 + i * bucketW + 2,
  w: bucketW - 4,
  y: hy(n),
  h: HY0 - hy(n),
  cx: HX0 + i * bucketW + bucketW / 2,
  label: `${i * 10}–${i === 9 ? 100 : i * 10 + 10}`,
  low: i < 4,
})))
const medianX = computed(() => (scores.value?.box ? HX0 + (scores.value.box.median / 100) * (HX1 - HX0) : null))
const lowCount = computed(() => (scores.value?.buckets || []).slice(0, 4).reduce((a, b) => a + b, 0))
const topBand = computed(() => {
  const b = scores.value?.buckets || []
  let best = 0
  for (let i = 0; i < b.length - 1; i++) if (b[i] + b[i + 1] > b[best] + b[best + 1]) best = i
  return best
})

// ── Box plot ──
// One small chart per class, with the class name above it, a plain sentence
// under it, and the names of students far from the rest next to their dots.
const COLORS = ['#0B6B3A', '#5B5BD6', '#E0A100', '#E5484D', '#0891B2', '#C026D3']
const BX0 = 24, BX1 = 576
const bx = (v) => BX0 + (v / 100) * (BX1 - BX0)
const AXIS = [0, 25, 50, 75, 100].map(v => ({ v, x: bx(v) }))
const router = useRouter()
const shortName = (name) => {
  const t = String(name || '?').trim()
  return t.length > 13 ? t.slice(0, 12) + '…' : t
}
const fmt = (v) => `${Math.round(v)}%`

const panels = computed(() => classes.value.map((c, i) => {
  const b = c.scores.box
  const color = COLORS[i % COLORS.length]
  if (c.scores.n < 4 || !b) return { id: c.course.id, title: c.course.title, n: c.scores.n, color, box: null }

  // Label each outlier above its dot; labels that would collide go one line higher.
  const placed = []
  const dots = b.outliers.map((o) => {
    const x = bx(o.score)
    let level = 0
    while (placed.some(p => p.level === level && Math.abs(p.x - x) < 78)) level += 1
    placed.push({ x, level })
    // Near the edges the label grows inward so it is never cut off.
    const anchor = x < 80 ? 'start' : x > 520 ? 'end' : 'middle'
    const labelX = anchor === 'start' ? Math.max(x - 6, 4) : anchor === 'end' ? Math.min(x + 6, 596) : x
    return { ...o, x, level: Math.min(level, 2), labelX, anchor, label: shortName(o.name), low: o.score < b.q1 }
  })
  const low = dots.filter(d => d.low)
  const high = dots.filter(d => !d.low)
  return {
    id: c.course.id, title: c.course.title, n: c.scores.n, color, box: b, dots, low, high,
    q1x: bx(b.q1), q3x: bx(b.q3), medx: bx(b.median), minx: bx(b.min), maxx: bx(b.max),
    boxW: Math.max(3, bx(b.q3) - bx(b.q1)),
    sentence: `Half of the students score between ${fmt(b.q1)} and ${fmt(b.q3)}. The middle student scored ${fmt(b.median)}.`,
  }
}))
const openStudent = (id) => router.push({ name: 'StudentProfile', params: { id } })
</script>

<template>
  <section class="grid grid-cols-1 xl:grid-cols-2 gap-4" aria-label="Quiz score spread">
    <!-- Histogram -->
    <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-extrabold text-slate-900 dark:text-white">How are quiz scores spread out?</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Students by average quiz score (each student counted once)</p>
        </div>
        <div v-if="tabs.length > 1" role="tablist" aria-label="Class" class="flex flex-wrap p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 gap-0.5">
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            role="tab"
            :aria-selected="t.id === selected"
            @click="selected = t.id"
            class="h-8 px-3 rounded-lg text-xs font-bold cursor-pointer transition"
            :class="t.id === selected ? 'bg-white dark:bg-slate-700 text-[#006A3A] dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'"
          >{{ t.label }}</button>
        </div>
      </div>

      <div v-if="loading && !data" class="h-56 mt-4 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
      <div v-else-if="!scores || !scores.n" class="mt-4 py-12 text-center text-sm text-slate-400">No quiz scores yet.</div>
      <template v-else>
        <svg :viewBox="`0 0 ${HW} ${HH}`" class="w-full mt-3 text-slate-500 dark:text-slate-400" role="img" aria-label="Histogram of average quiz scores">
          <g v-for="g in hGrid" :key="g.v">
            <line :x1="HX0" :x2="HX1" :y1="g.y" :y2="g.y" stroke="currentColor" stroke-opacity="0.2" />
            <text :x="HX0 - 8" :y="g.y + 3" text-anchor="end" font-size="10" fill="currentColor">{{ g.v }}</text>
          </g>
          <g v-for="b in hBars" :key="b.i">
            <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" :fill="b.low ? '#E5484D' : '#1FBF84'">
              <title>{{ b.label }}%: {{ b.n }} {{ b.n === 1 ? 'student' : 'students' }}</title>
            </rect>
            <text v-if="b.n" :x="b.cx" :y="b.y - 5" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor" class="text-slate-900 dark:text-white">{{ b.n }}</text>
            <text :x="b.cx" y="224" text-anchor="middle" font-size="10" fill="currentColor">{{ b.label }}</text>
          </g>
          <template v-if="medianX != null">
            <line :x1="medianX" :x2="medianX" :y1="HY1" :y2="HY0" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4" class="text-slate-900 dark:text-white" />
            <text :x="medianX" y="14" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor" class="text-slate-900 dark:text-white">Median {{ Math.round(scores.box.median) }}%</text>
          </template>
          <text :x="(HX0 + HX1) / 2" y="250" text-anchor="middle" font-size="10" fill="currentColor">Average quiz score (%)</text>
        </svg>
        <div class="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
          <b class="font-extrabold">How to read it:</b>
          most students score {{ topBand * 10 }}–{{ topBand * 10 + 20 }}%.
          <template v-if="lowCount">{{ lowCount }} {{ lowCount === 1 ? 'student is' : 'students are' }} below 40% and may need extra help.</template>
          <template v-else>Nobody is below 40%.</template>
        </div>
      </template>
    </div>

    <!-- Box plot -->
    <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0">
      <h2 class="text-base font-extrabold text-slate-900 dark:text-white">Class comparison</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Where most students score in each class, and who is far from the rest</p>

      <div v-if="loading && !data" class="h-56 mt-4 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
      <div v-else-if="!panels.length" class="mt-4 py-12 text-center text-sm text-slate-400">No quiz scores yet.</div>
      <div v-else class="mt-4 space-y-6">
        <div v-for="p in panels" :key="p.id">
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 class="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-3 h-3 rounded-sm" :style="{ background: p.color }"></span>{{ p.title }}
            </h3>
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ p.n }} students</span>
          </div>

          <p v-if="!p.box" class="mt-2 text-xs text-slate-500 dark:text-slate-400">Not enough scores yet (needs at least 4 students with a quiz score).</p>
          <template v-else>
            <p class="mt-1 text-xs text-slate-700 dark:text-slate-200">{{ p.sentence }}</p>
            <svg viewBox="0 0 600 124" class="w-full mt-1 text-slate-500 dark:text-slate-400" role="img" :aria-label="`Quiz scores for ${p.title}`">
              <g v-for="g in AXIS" :key="g.v">
                <line :x1="g.x" :x2="g.x" y1="44" y2="98" stroke="currentColor" stroke-opacity="0.2" />
                <text :x="g.x" y="114" text-anchor="middle" font-size="10" fill="currentColor">{{ g.v }}%</text>
              </g>
              <line :x1="p.minx" :x2="p.q1x" y1="71" y2="71" :stroke="p.color" stroke-width="2" />
              <line :x1="p.q3x" :x2="p.maxx" y1="71" y2="71" :stroke="p.color" stroke-width="2" />
              <line :x1="p.minx" :x2="p.minx" y1="62" y2="80" :stroke="p.color" stroke-width="2" />
              <line :x1="p.maxx" :x2="p.maxx" y1="62" y2="80" :stroke="p.color" stroke-width="2" />
              <rect :x="p.q1x" y="53" :width="p.boxW" height="36" :fill="p.color" fill-opacity="0.16" :stroke="p.color" stroke-width="2" rx="4" />
              <line :x1="p.medx" :x2="p.medx" y1="53" y2="89" :stroke="p.color" stroke-width="3" />
              <g v-for="d in p.dots" :key="d.student_id" class="cursor-pointer" @click="openStudent(d.student_id)">
                <circle :cx="d.x" cy="71" r="5" fill="#fff" :stroke="d.low ? '#E5484D' : '#16A34A'" stroke-width="2.5" />
                <text :x="d.labelX" :y="38 - d.level * 13" :text-anchor="d.anchor" font-size="11" font-weight="700" fill="currentColor" class="text-slate-900 dark:text-white">{{ d.label }} {{ fmt(d.score) }}</text>
                <title>{{ d.name }}: {{ fmt(d.score) }}</title>
              </g>
            </svg>

            <div v-if="p.dots.length" class="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span class="text-slate-600 dark:text-slate-300">
                {{ p.low.length ? `${p.low.length} ${p.low.length === 1 ? 'student scores' : 'students score'} far below the rest` : '' }}{{ p.low.length && p.high.length ? ', ' : '' }}{{ p.high.length ? `${p.high.length} far above` : '' }}:
              </span>
              <button
                v-for="d in p.dots"
                :key="d.student_id"
                type="button"
                @click="openStudent(d.student_id)"
                class="px-2.5 py-1 rounded-full font-bold cursor-pointer"
                :class="d.low ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'"
              >{{ d.name }} · {{ fmt(d.score) }}</button>
            </div>
            <p v-else class="mt-1 text-xs text-slate-500 dark:text-slate-400">No student is far from the rest.</p>
          </template>
        </div>

        <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
          <b class="font-extrabold">How to read it:</b>
          the <b>box</b> is where most students are (the middle half), the <b>thick line</b> is the middle student,
          the <b>thin lines</b> reach the lowest and highest typical scores, and each <b>circle</b> is one student far from the rest
          (red = far below, green = far above). Click a name to open that student.
        </div>
      </div>
    </div>
  </section>
</template>

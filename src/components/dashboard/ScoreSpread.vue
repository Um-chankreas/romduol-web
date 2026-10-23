<script setup>
import { computed, ref, watch } from 'vue'

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
const COLORS = ['#0B6B3A', '#5B5BD6', '#E0A100', '#E5484D', '#0891B2', '#C026D3']
const BX0 = 130, BX1 = 580, ROW_H = 80
const bx = (v) => BX0 + (v / 100) * (BX1 - BX0)
const boxHeight = computed(() => Math.max(1, classes.value.length) * ROW_H + 60)
const bGrid = [0, 20, 40, 60, 80, 100].map(v => ({ v, x: bx(v) }))
const boxes = computed(() => classes.value.map((c, i) => {
  const b = c.scores.box
  const cy = 36 + i * ROW_H + ROW_H / 2 - 10
  return { id: c.course.id, name: c.course.title, n: c.scores.n, cy, color: COLORS[i % COLORS.length], box: c.scores.n >= 4 ? b : null }
}))
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
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Quiz scores per class: the box is the middle half of students</p>

      <div v-if="loading && !data" class="h-56 mt-4 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
      <div v-else-if="!classes.length" class="mt-4 py-12 text-center text-sm text-slate-400">No quiz scores yet.</div>
      <template v-else>
        <svg :viewBox="`0 0 600 ${boxHeight}`" class="w-full mt-3 text-slate-500 dark:text-slate-400" role="img" aria-label="Box plot of quiz scores per class">
          <g v-for="g in bGrid" :key="g.v">
            <line :x1="g.x" :x2="g.x" y1="16" :y2="boxHeight - 40" stroke="currentColor" stroke-opacity="0.2" />
            <text :x="g.x" :y="boxHeight - 24" text-anchor="middle" font-size="10" fill="currentColor">{{ g.v }}%</text>
          </g>
          <g v-for="b in boxes" :key="b.id">
            <text x="6" :y="b.cy - 4" font-size="11" font-weight="700" fill="currentColor" class="text-slate-900 dark:text-white">{{ b.name.length > 16 ? b.name.slice(0, 15) + '…' : b.name }}</text>
            <text x="6" :y="b.cy + 12" font-size="10" fill="currentColor">{{ b.n }} students</text>
            <template v-if="b.box">
              <line :x1="bx(b.box.min)" :x2="bx(b.box.q1)" :y1="b.cy" :y2="b.cy" :stroke="b.color" stroke-width="2" />
              <line :x1="bx(b.box.q3)" :x2="bx(b.box.max)" :y1="b.cy" :y2="b.cy" :stroke="b.color" stroke-width="2" />
              <line :x1="bx(b.box.min)" :x2="bx(b.box.min)" :y1="b.cy - 8" :y2="b.cy + 8" :stroke="b.color" stroke-width="2" />
              <line :x1="bx(b.box.max)" :x2="bx(b.box.max)" :y1="b.cy - 8" :y2="b.cy + 8" :stroke="b.color" stroke-width="2" />
              <rect :x="bx(b.box.q1)" :y="b.cy - 20" :width="Math.max(2, bx(b.box.q3) - bx(b.box.q1))" height="40" :fill="b.color" fill-opacity="0.15" :stroke="b.color" stroke-width="2" rx="3" />
              <line :x1="bx(b.box.median)" :x2="bx(b.box.median)" :y1="b.cy - 20" :y2="b.cy + 20" :stroke="b.color" stroke-width="3" />
              <circle v-for="(o, i) in b.box.outliers" :key="i" :cx="bx(o)" :cy="b.cy" r="4" fill="#fff" :stroke="b.color" stroke-width="2"><title>{{ o }}%</title></circle>
              <text :x="bx(b.box.median)" :y="b.cy + 36" text-anchor="middle" font-size="10" font-weight="700" :fill="b.color">median {{ Math.round(b.box.median) }}%</text>
            </template>
            <text v-else :x="BX0" :y="b.cy + 4" font-size="11" fill="currentColor">Not enough scores yet (needs 4 students)</text>
          </g>
          <text :x="(BX0 + BX1) / 2" :y="boxHeight - 6" text-anchor="middle" font-size="10" fill="currentColor">Average quiz score</text>
        </svg>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          <span><b>Line in box</b> = median</span>
          <span><b>Box</b> = middle 50% of students</span>
          <span><b>Whiskers</b> = typical lowest and highest</span>
          <span><b>Dots</b> = outliers</span>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
} from 'chart.js'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip)

const props = defineProps({
  // quiz_history rows (any order): [{ quiz_id, title, course_title, score, passed, submitted_at }]
  quizzes: { type: Array, default: () => [] },
  dark: { type: Boolean, default: false },
})

// Oldest → newest, skipping anything without a score or a timestamp.
const points = computed(() =>
  (props.quizzes || [])
    .filter(q => q && q.score != null && q.submitted_at && !Number.isNaN(new Date(q.submitted_at).getTime()))
    .slice()
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))
)

const colors = computed(() => ({
  pass: props.dark ? '#34d399' : '#10b981',
  fail: props.dark ? '#f87171' : '#ef4444',
  surface: props.dark ? '#0f172a' : '#ffffff',
}))

const label = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const chartData = computed(() => {
  const c = colors.value
  const list = points.value
  return {
    labels: list.map(q => label(q.submitted_at)),
    datasets: [
      {
        label: 'Score',
        data: list.map(q => Math.max(0, Math.min(100, Number(q.score) || 0))),
        borderColor: props.dark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.5)',
        backgroundColor: props.dark ? 'rgba(52,211,153,0.08)' : 'rgba(15,122,78,0.07)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        // Pass/fail is carried by both color and shape (circle vs diamond).
        pointStyle: list.map(q => (q.passed ? 'circle' : 'rectRot')),
        pointBackgroundColor: list.map(q => (q.passed ? c.pass : c.fail)),
        pointBorderColor: c.surface,
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHitRadius: 10,
      },
    ],
  }
})

const chartOptions = computed(() => {
  const grid = props.dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.06)'
  const tick = props.dark ? '#94a3b8' : '#64748b'
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false, axis: 'x' },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: (items) => points.value[items[0].dataIndex]?.title || 'Quiz',
          label: (item) => {
            const q = points.value[item.dataIndex]
            return `Score ${item.raw}% · ${q?.passed ? 'Passed' : 'Not passed'}`
          },
          afterLabel: (item) => {
            const q = points.value[item.dataIndex]
            const when = q ? new Date(q.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
            return [q?.course_title, when].filter(Boolean).join(' · ')
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tick, maxRotation: 0, autoSkipPadding: 12 } },
      y: {
        min: 0,
        max: 100,
        grid: { color: grid },
        ticks: { color: tick, stepSize: 25, callback: (v) => `${v}%` },
      },
    },
  }
})
</script>

<template>
  <div>
    <div class="h-56">
      <Line v-if="points.length" :data="chartData" :options="chartOptions" />
      <div v-else class="h-full flex items-center justify-center text-xs text-slate-400">No quiz submissions yet</div>
    </div>
    <div v-if="points.length" class="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
      <span class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: colors.pass }"></span> Passed
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-2 h-2 rotate-45" :style="{ backgroundColor: colors.fail }"></span> Not passed
      </span>
    </div>
  </div>
</template>

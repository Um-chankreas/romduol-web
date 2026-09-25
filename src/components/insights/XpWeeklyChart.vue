<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

const props = defineProps({
  // [{ week: 'YYYY-MM-DD' (UTC Monday), xp }] — oldest first, last = this week
  weeks: { type: Array, default: () => [] },
  dark: { type: Boolean, default: false },
})

const label = (iso) => {
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z')
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const rows = computed(() => (props.weeks || []).filter(w => w?.week))
const hasXp = computed(() => rows.value.some(w => (Number(w.xp) || 0) > 0))

const chartData = computed(() => {
  const last = rows.value.length - 1
  // This week is drawn in the darker brand shade so "now" stands out.
  const current = props.dark ? '#6ee7b7' : '#0f7a4e'
  return {
    labels: rows.value.map(w => label(w.week)),
    datasets: [
      {
        label: 'XP earned',
        data: rows.value.map(w => Number(w.xp) || 0),
        backgroundColor: rows.value.map((_, i) => (i === last ? current : '#34d399')),
        borderRadius: 6,
        maxBarThickness: 26,
      },
    ],
  }
})

const chartOptions = computed(() => {
  const grid = props.dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.06)'
  const tick = props.dark ? '#94a3b8' : '#64748b'
  const last = rows.value.length - 1
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => `Week of ${items[0].label}${items[0].dataIndex === last ? ' (this week)' : ''}`,
          label: (item) => ` ${Number(item.raw || 0).toLocaleString('en-US')} XP`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tick, maxRotation: 0, autoSkipPadding: 12 } },
      y: {
        beginAtZero: true,
        grid: { color: grid },
        ticks: { color: tick, precision: 0 },
      },
    },
  }
})
</script>

<template>
  <div class="h-56">
    <Bar v-if="hasXp" :data="chartData" :options="chartOptions" />
    <div v-else class="h-full flex items-center justify-center text-xs text-slate-400">No XP earned in the last 12 weeks</div>
  </div>
</template>

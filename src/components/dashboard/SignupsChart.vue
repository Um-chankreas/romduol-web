<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend)

const props = defineProps({
  // [{ week: 'YYYY-MM-DD', count, cumulative }]
  weeks: { type: Array, default: () => [] },
  dark: { type: Boolean, default: false },
})

const label = (iso) => {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const chartData = computed(() => ({
  labels: props.weeks.map(w => label(w.week)),
  datasets: [
    {
      type: 'line',
      label: 'Total students',
      data: props.weeks.map(w => w.cumulative),
      borderColor: '#0f7a4e',
      backgroundColor: 'rgba(15,122,78,0.12)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.35,
      fill: true,
      yAxisID: 'yTotal',
      order: 0,
    },
    {
      type: 'bar',
      label: 'New sign-ups',
      data: props.weeks.map(w => w.count),
      backgroundColor: '#34d399',
      borderRadius: 6,
      maxBarThickness: 26,
      yAxisID: 'yNew',
      order: 1,
    },
  ],
}))

const chartOptions = computed(() => {
  const grid = props.dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.06)'
  const tick = props.dark ? '#94a3b8' : '#64748b'
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { color: tick, boxWidth: 12, boxHeight: 12, usePointStyle: true } },
      tooltip: {
        callbacks: {
          title: (items) => `Week of ${items[0].label}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tick, maxRotation: 0, autoSkipPadding: 12 } },
      yNew: {
        position: 'left',
        beginAtZero: true,
        grid: { color: grid },
        ticks: { color: tick, precision: 0 },
        title: { display: false },
      },
      yTotal: {
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        ticks: { color: tick, precision: 0 },
      },
    },
  }
})
</script>

<template>
  <div class="h-64">
    <Bar v-if="weeks.length" :data="chartData" :options="chartOptions" />
    <div v-else class="h-full flex items-center justify-center text-xs text-slate-400">No sign-up data yet</div>
  </div>
</template>

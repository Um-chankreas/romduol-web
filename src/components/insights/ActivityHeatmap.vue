<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  // [{ day: 'YYYY-MM-DD' (UTC), minutes, active }] — consecutive days, oldest first, ending today
  days: { type: Array, default: () => [] },
})

const DAY_MS = 86400000
const WEEKS = 12
const TOTAL = WEEKS * 7

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10)
const toMs = (key) => Date.parse(`${key}T00:00:00Z`)
const todayKey = () => ymd(Date.now())

// Always a full 12 x 7 grid: keep the newest 84 days and fill any missing
// ones, so a short or empty payload still draws a calendar ending today.
const cells = computed(() => {
  const list = (props.days || []).filter(d => d?.day).slice(-TOTAL)
  const byDay = new Map(list.map(d => [String(d.day).slice(0, 10), d]))
  const lastKey = list.length ? String(list[list.length - 1].day).slice(0, 10) : todayKey()
  const end = toMs(lastKey)
  const today = todayKey()
  const out = []
  for (let i = TOTAL - 1; i >= 0; i--) {
    const key = ymd(end - i * DAY_MS)
    const d = byDay.get(key)
    out.push({
      day: key,
      minutes: Math.max(0, Math.round(Number(d?.minutes) || 0)),
      active: !!d?.active,
      today: key === today,
    })
  }
  return out
})

// Column w = seven consecutive days, so every row is the same weekday across
// the grid and the newest day (today) lands bottom-right.
const weeks = computed(() => {
  const out = []
  for (let w = 0; w < WEEKS; w++) out.push(cells.value.slice(w * 7, w * 7 + 7))
  return out
})

const fmtDay = (key, opts) => new Date(toMs(key)).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts })

const rowLabels = computed(() => (weeks.value[0] || []).map(c => fmtDay(c.day, { weekday: 'short' })))

// Month name above the first column of each month (GitHub style). The very
// first column is skipped when the next one already starts a new month, so
// two labels never collide.
const monthLabels = computed(() => weeks.value.map((week, w) => {
  const month = fmtDay(week[0].day, { month: 'short' })
  if (w === 0) {
    const next = weeks.value[1]?.[0]
    return next && fmtDay(next.day, { month: 'short' }) !== month ? '' : month
  }
  return fmtDay(weeks.value[w - 1][0].day, { month: 'short' }) !== month ? month : ''
}))

// Sequential emerald ramp: light → dark in light mode, dim → bright in dark.
const LEVELS = [
  'bg-slate-100 dark:bg-slate-800',
  'bg-emerald-50 ring-1 ring-inset ring-emerald-300 dark:bg-slate-800 dark:ring-emerald-600',
  'bg-emerald-200 dark:bg-emerald-800',
  'bg-emerald-400 dark:bg-emerald-600',
  'bg-emerald-600 dark:bg-emerald-400',
  'bg-[#006A3A] dark:bg-emerald-200',
]

// 0 = nothing, 1 = active but no study time logged, 2..5 = minute buckets.
const levelOf = (c) => {
  if (c.minutes >= 60) return 5
  if (c.minutes >= 30) return 4
  if (c.minutes >= 15) return 3
  if (c.minutes > 0) return 2
  return c.active ? 1 : 0
}

const fmtMinutes = (m) => {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

const describe = (c) => {
  const date = fmtDay(c.day, { weekday: 'short', month: 'short', day: 'numeric' })
  if (c.minutes > 0) return `${date} · ${fmtMinutes(c.minutes)} studied`
  if (c.active) return `${date} · active, no study time logged`
  return `${date} · no activity`
}

const totals = computed(() => {
  let minutes = 0
  let active = 0
  cells.value.forEach(c => {
    minutes += c.minutes
    if (c.active || c.minutes > 0) active += 1
  })
  return { minutes, active }
})

// Hover (or tap, on phones) a day to read it in the caption below the grid.
const selected = ref(null)
</script>

<template>
  <div class="w-full max-w-[460px]" @mouseleave="selected = null">
    <!-- Month labels -->
    <div class="grid gap-[3px] mb-1" style="grid-template-columns: 1.75rem repeat(12, minmax(0, 1fr))">
      <span></span>
      <span
        v-for="(m, w) in monthLabels"
        :key="w"
        class="text-[9px] leading-none font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap"
      >{{ m }}</span>
    </div>

    <div class="grid gap-[3px]" style="grid-template-columns: 1.75rem repeat(12, minmax(0, 1fr))">
      <!-- Weekday labels -->
      <div class="grid grid-rows-7 gap-[3px]">
        <span
          v-for="(label, r) in rowLabels"
          :key="r"
          class="flex items-center text-[9px] leading-none text-slate-400 dark:text-slate-500"
        >{{ label }}</span>
      </div>

      <div v-for="(week, w) in weeks" :key="w" class="grid grid-rows-7 gap-[3px]">
        <button
          v-for="cell in week"
          :key="cell.day"
          type="button"
          :title="describe(cell)"
          :aria-label="describe(cell)"
          @mouseenter="selected = cell"
          @focus="selected = cell"
          @click="selected = cell"
          :class="[
            'block w-full aspect-square rounded-[3px] cursor-default transition-transform hover:scale-110 focus:outline-none',
            LEVELS[levelOf(cell)],
            cell.today ? 'outline-2 outline-offset-1 outline-slate-400 dark:outline-slate-400' : '',
            selected && selected.day === cell.day ? 'scale-110' : '',
          ]"
        ></button>
      </div>
    </div>

    <p class="mt-2 min-h-[1rem] text-[11px] text-slate-500 dark:text-slate-400">
      <template v-if="selected">{{ describe(selected) }}</template>
      <template v-else>
        {{ totals.active }} active day{{ totals.active === 1 ? '' : 's' }} · {{ fmtMinutes(totals.minutes) }} studied in the last 12 weeks
      </template>
    </p>

    <!-- Legend -->
    <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-400 dark:text-slate-500">
      <div class="flex items-center gap-1">
        <span>Less</span>
        <span v-for="lvl in [0, 2, 3, 4, 5]" :key="lvl" :class="['w-2.5 h-2.5 rounded-[2px]', LEVELS[lvl]]"></span>
        <span>More</span>
      </div>
      <div class="flex items-center gap-1">
        <span :class="['w-2.5 h-2.5 rounded-[2px]', LEVELS[1]]"></span>
        <span>Active, no study time</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="w-2.5 h-2.5 rounded-[2px] bg-slate-100 dark:bg-slate-800 outline-2 outline-offset-1 outline-slate-400"></span>
        <span>Today</span>
      </div>
    </div>
    <p class="mt-1 text-[10px] text-slate-400 dark:text-slate-500">Shades: 1–14 min · 15–29 · 30–59 · 60+ min per day (UTC days)</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

// "Your classes": one card per class — students, lessons, next live class,
// progress, attendance, quiz average, inactive count and a status split.
// Data: insightsService.getLearningOverview() -> { totals, classes }.
const props = defineProps({
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['retry'])
const router = useRouter()

const classes = computed(() => props.data?.classes || [])
const totals = computed(() => props.data?.totals || {})

const FLAG_CLS = {
  on_track: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  needs_attention: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  low_attendance: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
}
const SEGMENTS = [
  { key: 'on_track', label: 'On track', color: '#1FBF84' },
  { key: 'behind', label: 'Behind', color: '#E0A100' },
  { key: 'inactive', label: 'Inactive', color: '#E5484D' },
  { key: 'not_started', label: 'Not started', color: '#C5CDD6' },
  { key: 'completed', label: 'Completed', color: '#5B5BD6' },
]
const pctText = (v) => (v == null ? '—' : `${v}%`)
const nextLive = (iso) => {
  if (!iso) return 'none scheduled'
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}
const open = (c) => router.push(`/courses/${c.course.id}`)
</script>

<template>
  <section class="space-y-3" aria-label="Your classes">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 class="text-base font-extrabold text-slate-900 dark:text-white">
        Your classes
        <span v-if="data" class="text-xs font-semibold text-slate-500 dark:text-slate-400">
          · {{ totals.classes }} {{ totals.classes === 1 ? 'class' : 'classes' }}, {{ totals.enrolments }} enrolments
        </span>
      </h2>
      <button type="button" @click="router.push('/class')" class="text-xs font-bold text-[#006A3A] dark:text-emerald-400 cursor-pointer">Manage classes →</button>
    </div>

    <div v-if="error" class="p-4 rounded-xl bg-red-500/10 text-red-500 text-sm flex items-center justify-between gap-3">
      <span>{{ error }}</span>
      <button type="button" @click="emit('retry')" class="font-bold underline cursor-pointer">Retry</button>
    </div>

    <div v-else-if="loading && !data" class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div v-for="n in 2" :key="n" class="h-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 animate-pulse"></div>
    </div>

    <div v-else-if="!classes.length" class="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-sm text-slate-500 dark:text-slate-400">
      No classes yet.
    </div>

    <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <article
        v-for="c in classes"
        :key="c.course.id"
        class="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-4 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition"
        @click="open(c)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="text-base font-extrabold text-slate-900 dark:text-white truncate">{{ c.course.title }}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {{ c.students }} students · {{ c.lessons }} lessons · next live class: {{ nextLive(c.next_live_at) }}
            </p>
          </div>
          <span class="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold" :class="FLAG_CLS[c.flag.key]">{{ c.flag.label }}</span>
        </div>

        <dl class="grid grid-cols-4 gap-3">
          <div>
            <dt class="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400">PROGRESS</dt>
            <dd class="text-xl font-extrabold text-slate-900 dark:text-white">{{ pctText(c.avg_progress) }}</dd>
          </div>
          <div>
            <dt class="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400">ATTENDANCE</dt>
            <dd class="text-xl font-extrabold text-slate-900 dark:text-white">{{ pctText(c.attendance_rate) }}</dd>
          </div>
          <div>
            <dt class="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400">AVG QUIZ</dt>
            <dd class="text-xl font-extrabold text-slate-900 dark:text-white">{{ pctText(c.avg_quiz) }}</dd>
          </div>
          <div>
            <dt class="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400">INACTIVE</dt>
            <dd class="text-xl font-extrabold" :class="c.inactive ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'">{{ c.inactive }}</dd>
          </div>
        </dl>

        <div class="flex h-2.5 rounded-full overflow-hidden gap-0.5" role="img" :aria-label="`Student status for ${c.course.title}`">
          <template v-for="s in SEGMENTS" :key="s.key">
            <div v-if="c.status_counts[s.key]" :style="{ flex: c.status_counts[s.key] + ' 1 0', background: s.color }"></div>
          </template>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          <span v-for="s in SEGMENTS" :key="s.key" class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :style="{ background: s.color }"></span>{{ s.label }} {{ c.status_counts[s.key] }}
          </span>
        </div>
      </article>
    </div>
  </section>
</template>

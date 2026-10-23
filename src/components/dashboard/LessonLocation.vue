<script setup>
import { computed, ref, watch } from 'vue'

// "Where students are in the lessons": for one class at a time, how many
// students are currently on each lesson (their first unfinished chapter), plus
// those who haven't started and those who finished. A tall bar early on means
// students are stuck there. Data: insightsService.getLearningOverview().classes.
const props = defineProps({
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})

const BOTTLENECK_SHARE = 0.25

const classes = computed(() => (props.data?.classes || []).filter(c => c.lessons > 0))
const selectedId = ref('')
watch(classes, (list) => {
  if (!list.some(c => c.course.id === selectedId.value)) selectedId.value = list[0]?.course.id || ''
}, { immediate: true })
const current = computed(() => classes.value.find(c => c.course.id === selectedId.value) || null)

const rows = computed(() => {
  const c = current.value
  if (!c) return []
  const lessonRows = c.lesson_distribution.map(l => ({
    key: l.lesson_id,
    name: `Ch ${l.index} · ${l.title}`,
    n: l.students_here,
    kind: c.students && l.students_here / c.students > BOTTLENECK_SHARE ? 'bottleneck' : 'lesson',
  }))
  return [
    { key: 'not-started', name: 'Not started', n: c.not_started, kind: 'idle' },
    ...lessonRows,
    { key: 'finished', name: 'Finished the course', n: c.finished, kind: 'done' },
  ]
})
const maxN = computed(() => Math.max(1, ...rows.value.map(r => r.n)))
const COLOR = { lesson: '#1FBF84', bottleneck: '#E0A100', idle: '#C5CDD6', done: '#5B5BD6' }
const share = (n) => (current.value?.students ? Math.round((n / current.value.students) * 100) : 0)

const bottleneck = computed(() => {
  const list = rows.value.filter(r => r.kind === 'bottleneck')
  return list.length ? list.reduce((a, b) => (b.n > a.n ? b : a)) : null
})
</script>

<template>
  <section class="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-4" aria-label="Where students are in the lessons">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-extrabold text-slate-900 dark:text-white">Where students are in the lessons</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">How many students are on each lesson right now. A tall bar early in the course means students are stuck there.</p>
      </div>
      <div v-if="classes.length > 1" role="tablist" aria-label="Class" class="flex flex-wrap p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 gap-0.5">
        <button
          v-for="c in classes"
          :key="c.course.id"
          type="button"
          role="tab"
          :aria-selected="c.course.id === selectedId"
          @click="selectedId = c.course.id"
          class="h-8 px-3 rounded-lg text-xs font-bold cursor-pointer transition"
          :class="c.course.id === selectedId ? 'bg-white dark:bg-slate-700 text-[#006A3A] dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'"
        >{{ c.course.title }}</button>
      </div>
    </div>

    <div v-if="loading && !data" class="h-48 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
    <div v-else-if="!current" class="py-10 text-center text-sm text-slate-400">No class with lessons yet.</div>
    <template v-else>
      <div v-if="bottleneck" class="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        <b class="font-extrabold">Bottleneck:</b>
        {{ bottleneck.n }} of {{ current.students }} students ({{ share(bottleneck.n) }}%) are on {{ bottleneck.name }}.
      </div>
      <div v-else class="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
        No single lesson is holding students back.
      </div>

      <ul class="space-y-2 max-h-[26rem] overflow-y-auto pr-1">
        <li v-for="r in rows" :key="r.key" class="grid grid-cols-[minmax(110px,230px)_1fr_80px] items-center gap-3 text-sm">
          <span class="truncate font-semibold text-slate-800 dark:text-slate-100" :title="r.name">{{ r.name }}</span>
          <div class="h-5 rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div class="h-full rounded-md" :style="{ width: (r.n / maxN) * 100 + '%', background: COLOR[r.kind], minWidth: r.n ? '4px' : '0' }"></div>
          </div>
          <span class="text-right font-extrabold text-slate-900 dark:text-white">{{ r.n }} <span class="font-medium text-slate-500 dark:text-slate-400">({{ share(r.n) }}%)</span></span>
        </li>
      </ul>

      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm" :style="{ background: COLOR.lesson }"></span>Students on this lesson</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm" :style="{ background: COLOR.bottleneck }"></span>Bottleneck (over {{ BOTTLENECK_SHARE * 100 }}% of the class)</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm" :style="{ background: COLOR.done }"></span>Finished</span>
      </div>
    </template>
  </section>
</template>

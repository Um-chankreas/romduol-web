<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  // progress.path — [{ lesson_id, title, done, units_done, units_total }] in playback order
  path: { type: Array, default: () => [] },
  // progress.current — { lesson_id, ... }, or null once every chapter is done
  current: { type: Object, default: null },
})

const STATE_LABEL = {
  done: 'Completed',
  current: 'Current chapter',
  partial: 'Started',
  upcoming: 'Not started',
}

const segments = computed(() => (props.path || []).map((ch, i) => {
  const total = Math.max(0, Number(ch?.units_total) || 0)
  const unitsDone = Math.min(Math.max(0, Number(ch?.units_done) || 0), total)
  const isCurrent = !!props.current && !!ch?.lesson_id && props.current.lesson_id === ch.lesson_id
  const state = ch?.done ? 'done' : isCurrent ? 'current' : unitsDone > 0 ? 'partial' : 'upcoming'
  const fill = ch?.done ? 100 : total > 0 ? Math.round((unitsDone / total) * 100) : 0
  const title = ch?.title || 'Untitled chapter'
  return {
    key: ch?.lesson_id || i,
    index: i + 1,
    state,
    fill,
    tip: `Chapter ${i + 1}: ${title} — ${STATE_LABEL[state]} (${unitsDone}/${total} unit${total === 1 ? '' : 's'})`,
  }
}))

const doneCount = computed(() => segments.value.filter(s => s.state === 'done').length)

// Hover (or tap, on phones) a chapter to read it in the caption.
const selected = ref(null)
</script>

<template>
  <div @mouseleave="selected = null">
    <p v-if="!segments.length" class="text-[11px] text-slate-400">No chapters yet</p>
    <template v-else>
      <!-- auto-fit: a few chapters stretch full width, many wrap onto more rows -->
      <div
        class="grid gap-x-1 gap-y-1.5"
        style="grid-template-columns: repeat(auto-fit, minmax(14px, 1fr))"
      >
        <button
          v-for="seg in segments"
          :key="seg.key"
          type="button"
          :title="seg.tip"
          :aria-label="seg.tip"
          @mouseenter="selected = seg"
          @focus="selected = seg"
          @click="selected = seg"
          class="py-1.5 cursor-default focus:outline-none group"
        >
          <span
            :class="[
              'relative block h-2.5 rounded-full overflow-hidden transition',
              seg.state === 'done' ? 'bg-[#006A3A] dark:bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700',
              seg.state === 'current' ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-emerald-400 dark:ring-offset-slate-900' : '',
              selected && selected.key === seg.key ? 'opacity-80' : 'group-hover:opacity-80',
            ]"
          >
            <span
              v-if="seg.state !== 'done' && seg.fill > 0"
              class="absolute inset-y-0 left-0 bg-emerald-400 dark:bg-emerald-600"
              :style="{ width: `${seg.fill}%` }"
            ></span>
          </span>
        </button>
      </div>
      <p class="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
        <template v-if="selected">{{ selected.tip }}</template>
        <template v-else>{{ doneCount }} of {{ segments.length }} chapter{{ segments.length === 1 ? '' : 's' }} complete</template>
      </p>
    </template>
  </div>
</template>

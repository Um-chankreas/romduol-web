<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    @click.self="$emit('close')"
  >
    <div class="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl">
      <div class="shrink-0 p-6 sm:p-8 pb-4 text-left">
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-1">
          Submissions — {{ assignment?.title }}
        </h2>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {{ submittedCount }} of {{ roster.length }} student{{ roster.length === 1 ? '' : 's' }} submitted
        </p>
      </div>

      <div class="flex-1 overflow-y-auto px-6 sm:px-8 pb-2">
        <p v-if="loading" class="text-xs text-slate-500 dark:text-slate-400">Loading…</p>
        <p v-else-if="error" class="text-xs text-red-600">{{ error }}</p>
        <p v-else-if="roster.length === 0" class="text-xs text-slate-500 dark:text-slate-400">No students enrolled in this course yet.</p>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th class="px-4 py-3 font-bold">Student</th>
                <th class="px-4 py-3 font-bold">Status</th>
                <th class="px-4 py-3 font-bold">Submitted</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="row in roster" :key="row.student?.id" class="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <img
                      v-if="row.student?.avatar_url"
                      :src="row.student.avatar_url"
                      class="h-9 w-9 rounded-full object-cover shrink-0"
                      alt=""
                    />
                    <div v-else class="h-9 w-9 rounded-full bg-[#016a36] text-white flex items-center justify-center text-xs font-bold shrink-0 select-none">
                      {{ initialOf(row.student?.name) }}
                    </div>
                    <div class="min-w-0">
                      <p class="font-semibold text-slate-900 dark:text-white truncate">{{ row.student?.name || 'Unknown' }}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400 truncate">{{ row.student?.email || '—' }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span
                    :class="[
                      'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide whitespace-nowrap',
                      statusOf(row).cls
                    ]"
                  >
                    {{ statusOf(row).label }}
                  </span>
                </td>
                <td class="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {{ row.submission?.submitted_at ? formatDate(row.submission.submitted_at) : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="shrink-0 p-6 sm:p-8 pt-4 flex justify-end">
        <button
          @click="$emit('close')"
          class="px-5 py-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-sm font-semibold transition"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { assignmentService } from '@/services/assignmentService'

const props = defineProps({
  assignmentId: { type: String, required: true },
})
defineEmits(['close'])

const assignment = ref(null)
const loading = ref(true)
const error = ref(null)

const roster = computed(() => assignment.value?.roster || [])
const submittedCount = computed(() => roster.value.filter(r => r.submission).length)

const isPastDue = computed(() =>
  !!assignment.value?.due_date && new Date(assignment.value.due_date) < new Date()
)

const load = async () => {
  loading.value = true
  error.value = null
  try {
    assignment.value = await assignmentService.getAssignment(props.assignmentId)
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to load submissions'
  } finally {
    loading.value = false
  }
}
watch(() => props.assignmentId, load, { immediate: true })

// Auto-graded quiz score (0-100) → a /10 score and a qualitative band, same
// convention as the mobile app: <5 Failed · 5-6.9 Passed · 7-8.9 Good · >=9 Excellent.
const BAND_LABEL = { failed: 'Failed', passed: 'Passed', good: 'Good', excellent: 'Excellent' }
const BAND_CLASS = {
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  passed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  good: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  excellent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}
const gradeBandOf = (percentage) => {
  const score10 = Math.round(percentage) / 10
  const band = score10 < 5 ? 'failed' : score10 < 7 ? 'passed' : score10 < 9 ? 'good' : 'excellent'
  return { score10, band }
}

const statusOf = (row) => {
  if (row.submission) {
    const { score10, band } = gradeBandOf(row.submission.score ?? row.submission.grade ?? 0)
    return {
      label: `Submitted — ${score10.toFixed(1)} · ${BAND_LABEL[band]}`,
      cls: BAND_CLASS[band],
    }
  }
  if (isPastDue.value) {
    return { label: 'Overdue, not submitted', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' }
  }
  return { label: 'Not submitted', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' }
}

const initialOf = (name) => (name || '?').trim().charAt(0).toUpperCase()
const formatDate = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

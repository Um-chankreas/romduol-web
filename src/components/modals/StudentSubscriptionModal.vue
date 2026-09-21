<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    @click.self="!anyBusy && $emit('close')"
  >
    <div class="w-full max-w-xl rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white text-left">
        Course subscriptions
      </h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 text-left">
        {{ student?.name }} — $5 / week per course. A subscription only unlocks that course's live classes.
      </p>

      <div v-if="loading" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</div>

      <template v-else>
        <p v-if="rows.length" class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 text-left">
          {{ activeCount }} of {{ rows.length }} course{{ rows.length === 1 ? '' : 's' }} active
        </p>

        <div v-if="rows.length === 0" class="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Not enrolled in any course yet.
        </div>

        <!-- One subscription per course -->
        <div class="space-y-3">
          <div
            v-for="row in rows"
            :key="row.course.id"
            :class="[
              'rounded-2xl border p-4 text-left',
              row.subscription.is_active
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/10'
                : 'border-slate-200 dark:border-slate-800'
            ]"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {{ row.course.title || 'Course' }}
                </p>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  <template v-if="row.subscription.is_active">Access until {{ formatDate(row.subscription.expiry_date) }}</template>
                  <template v-else-if="row.subscription.expiry_date">Expired {{ formatDate(row.subscription.expiry_date) }}</template>
                  <template v-else>Not subscribed</template>
                  <template v-if="row.subscription.last_updated"> · last updated {{ formatDate(row.subscription.last_updated) }}</template>
                </p>
              </div>
              <div class="flex flex-col items-end gap-1 shrink-0">
                <span
                  :class="[
                    'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide',
                    row.subscription.is_active
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  ]"
                >
                  {{ row.subscription.is_active ? 'Active' : 'Inactive' }}
                </span>
                <span
                  v-if="row.course.live_enabled === false"
                  class="text-[10px] font-semibold text-red-500"
                  title="Live classes are switched off for this course (Course Live Access tab) — nobody can join, even with a subscription."
                >
                  🚫 Live off for course
                </span>
              </div>
            </div>

            <div class="mt-3 space-y-3">
              <div>
                <span class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">Add weeks</span>
                <div class="flex items-center gap-2">
                  <button
                    v-for="n in [1, 2, 4]"
                    :key="n"
                    @click="addWeeks(row, n)"
                    :disabled="row.busy"
                    class="px-3 py-1.5 rounded-lg bg-[#006A3A] hover:bg-[#005A31] text-white text-xs font-bold transition cursor-pointer disabled:opacity-40"
                  >
                    +{{ n }} week{{ n === 1 ? '' : 's' }}
                  </button>
                </div>
              </div>

              <div>
                <span class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">Or set an expiry date</span>
                <div class="flex items-center gap-2">
                  <input
                    type="date"
                    v-model="row.date"
                    :disabled="row.busy"
                    class="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-2.5 py-1.5"
                  />
                  <button
                    @click="setDate(row)"
                    :disabled="row.busy || !row.date"
                    class="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer disabled:opacity-40"
                  >
                    Set
                  </button>
                </div>
              </div>

              <button
                v-if="row.subscription.expiry_date"
                @click="revoke(row)"
                :disabled="row.busy"
                class="text-xs font-bold text-red-600 hover:underline cursor-pointer disabled:opacity-40"
              >
                Revoke access
              </button>

              <p v-if="row.error" class="text-xs text-red-600">{{ row.error }}</p>
            </div>
          </div>
        </div>

        <p v-if="localError" class="text-xs text-red-600 mt-3 text-left">{{ localError }}</p>
      </template>

      <div class="flex items-center justify-end mt-6">
        <button
          @click="$emit('close')"
          :disabled="anyBusy"
          class="px-5 py-2 rounded-full bg-[#006A3A] hover:bg-[#005A31] text-white text-sm font-bold transition cursor-pointer disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { studentService } from '../../services/studentService'

const props = defineProps({
  student: { type: Object, required: true },
})
const emit = defineEmits(['close', 'changed'])

const loading = ref(true)
const localError = ref('')
// [{ course, enrolled_at, subscription: { is_active, expiry_date, last_updated }, date, busy, error }]
const rows = ref([])

const activeCount = computed(() => rows.value.filter((r) => r.subscription.is_active).length)
const anyBusy = computed(() => rows.value.some((r) => r.busy))

const formatDate = (d) => {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return d }
}
const ymd = (d) => (d ? String(d).slice(0, 10) : '')

const load = async () => {
  loading.value = true
  localError.value = ''
  try {
    const { enrolled_courses } = await studentService.getStudent(props.student.id)
    rows.value = (enrolled_courses || []).map((ec) => ({
      ...ec,
      subscription: ec.subscription || { is_active: false, expiry_date: null, last_updated: null },
      date: ymd(ec.subscription?.expiry_date),
      busy: false,
      error: '',
    }))
  } catch (err) {
    localError.value = err.response?.data?.error || err.message || 'Failed to load subscriptions.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

// What the student list shows in its Subscription column: "active / enrolled".
const summary = () => ({
  enrolled: rows.value.length,
  active: activeCount.value,
  active_courses: rows.value
    .filter((r) => r.subscription.is_active)
    .map((r) => ({ course_id: r.course.id, title: r.course.title || 'Course', expiry_date: r.subscription.expiry_date })),
})

const apply = async (row, fn) => {
  row.busy = true
  row.error = ''
  try {
    const updated = await fn()
    row.subscription = {
      is_active: !!updated?.is_active,
      expiry_date: updated?.expiry_date || null,
      last_updated: updated?.last_updated || null,
    }
    row.date = ymd(updated?.expiry_date)
    emit('changed', summary())
  } catch (err) {
    row.error = err.response?.data?.error || err.message || 'Could not update subscription.'
  } finally {
    row.busy = false
  }
}

const addWeeks = (row, n) => apply(row, () => studentService.addWeeks(props.student.id, row.course.id, n))
const setDate = (row) => apply(row, () => studentService.setCourseSubscription(props.student.id, row.course.id, { expiry_date: row.date }))
const revoke = (row) => apply(row, () => studentService.revokeSubscription(props.student.id, row.course.id))
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    @click.self="!busy && $emit('close')"
  >
    <div class="w-full max-w-md rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white text-left">
        Weekly subscription
      </h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 text-left">
        {{ student?.name }} — $5 / week to join every course's live classes.
      </p>

      <div v-if="loading" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</div>

      <template v-else>
        <!-- Current status -->
        <div
          :class="[
            'rounded-xl border px-4 py-3 mb-4 text-left',
            sub && sub.is_paid
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/20'
              : 'border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/20'
          ]"
        >
          <p class="text-sm font-bold" :class="sub && sub.is_paid ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'">
            {{ sub && sub.is_paid ? 'Active' : 'Not subscribed' }}
          </p>
          <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            <template v-if="sub && sub.paid_until">Access until {{ formatDate(sub.paid_until) }}</template>
            <template v-else>No active access</template>
            <template v-if="sub && sub.last_paid_at"> · last updated {{ formatDate(sub.last_paid_at) }}</template>
          </p>
        </div>

        <!-- Extend -->
        <div class="space-y-3 text-left">
          <div>
            <span class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Add weeks</span>
            <div class="flex items-center gap-2">
              <button
                v-for="n in [1, 2, 4]"
                :key="n"
                @click="addWeeks(n)"
                :disabled="busy"
                class="px-3 py-1.5 rounded-lg bg-[#006A3A] hover:bg-[#005A31] text-white text-xs font-bold transition cursor-pointer disabled:opacity-40"
              >
                +{{ n }} week{{ n === 1 ? '' : 's' }}
              </button>
            </div>
          </div>

          <div>
            <span class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Or set an expiry date</span>
            <div class="flex items-center gap-2">
              <input
                type="date"
                v-model="explicitDate"
                :disabled="busy"
                class="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-2.5 py-1.5"
              />
              <button
                @click="setDate"
                :disabled="busy || !explicitDate"
                class="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer disabled:opacity-40"
              >
                Set
              </button>
            </div>
          </div>

          <button
            v-if="sub && sub.paid_until"
            @click="revoke"
            :disabled="busy"
            class="text-xs font-bold text-red-600 hover:underline cursor-pointer disabled:opacity-40"
          >
            Revoke access now
          </button>
        </div>

        <!-- Enrolled courses (info only) -->
        <div v-if="enrolledCourses.length" class="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-left">
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Enrolled courses</p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="ec in enrolledCourses"
              :key="ec.course?.id"
              class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300"
            >
              {{ ec.course?.title || 'Course' }}
              <span v-if="ec.course?.live_enabled === false" class="text-red-500" title="Live classes off">🚫</span>
            </span>
          </div>
        </div>

        <p v-if="localError" class="text-xs text-red-600 mt-3 text-left">{{ localError }}</p>
      </template>

      <div class="flex items-center justify-end mt-6">
        <button
          @click="$emit('close')"
          :disabled="busy"
          class="px-5 py-2 rounded-full bg-[#006A3A] hover:bg-[#005A31] text-white text-sm font-bold transition cursor-pointer disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { studentService } from '../../services/studentService'

const props = defineProps({
  student: { type: Object, required: true },
})
const emit = defineEmits(['close', 'changed'])

const loading = ref(true)
const busy = ref(false)
const localError = ref('')
const sub = ref(null)
const enrolledCourses = ref([])
const explicitDate = ref('')

const formatDate = (d) => {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return d }
}

const load = async () => {
  loading.value = true
  localError.value = ''
  try {
    const { subscription, enrolled_courses } = await studentService.getStudent(props.student.id)
    sub.value = subscription
    enrolledCourses.value = enrolled_courses || []
    explicitDate.value = subscription?.paid_until ? String(subscription.paid_until).slice(0, 10) : ''
  } catch (err) {
    localError.value = err.response?.data?.error || err.message || 'Failed to load subscription.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const apply = async (fn) => {
  busy.value = true
  localError.value = ''
  try {
    const updated = await fn()
    sub.value = { ...sub.value, ...updated }
    explicitDate.value = updated?.paid_until ? String(updated.paid_until).slice(0, 10) : ''
    emit('changed', updated)
  } catch (err) {
    localError.value = err.response?.data?.error || err.message || 'Could not update subscription.'
  } finally {
    busy.value = false
  }
}

const addWeeks = (n) => apply(() => studentService.addWeeks(props.student.id, n))
const setDate = () => apply(() => studentService.setSubscription(props.student.id, { paid_until: explicitDate.value }))
const revoke = () => apply(() => studentService.revokeSubscription(props.student.id))
</script>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { classScheduleService } from '@/services/classScheduleService'

const props = defineProps({
  courseId: { type: String, required: true }
})

// Fires after a slot is created/updated/removed, so a parent view holding
// its own summary of this course's schedule (e.g. ScheduleView's subject
// picker, ClassesView's card badge) knows to re-fetch.
const emit = defineEmits(['changed'])

// UI shows Mon..Sun (how teachers think about a week); the API stores
// days_of_week using JS Date#getDay() convention (0=Sun..6=Sat) so the
// backend cron can test membership with no conversion. DAY_OPTIONS maps
// between the two.
const DAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' }
]
const DAY_LABEL = Object.fromEntries(DAY_OPTIONS.map(d => [d.value, d.label]))

const schedules = ref([])
const loading = ref(true)
const loadError = ref('')

const fetchSchedules = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await classScheduleService.getCourseSchedules(props.courseId)
    schedules.value = res.data?.schedules || []
  } catch (err) {
    loadError.value = err.response?.data?.error || err.message || 'Failed to load schedule.'
  } finally {
    loading.value = false
  }
}
onMounted(fetchSchedules)

const formatTime = (hhmm) => {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

const orderedDays = (days) => (days || []).slice().sort((a, b) => {
  // Sort Mon(1)..Sun(0) for display, not the raw 0..6 storage order.
  const rank = (d) => (d === 0 ? 7 : d)
  return rank(a) - rank(b)
})

const scheduleSummary = (schedule) =>
  `${orderedDays(schedule.days_of_week).map(d => DAY_LABEL[d]).join(', ')} · ${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`

// ── Add / edit form ─────────────────────────────────────────────────────
const showForm = ref(false)
const editingId = ref(null)
const formDays = ref(new Set())
const formStart = ref('15:00')
const formEnd = ref('16:30')
const saving = ref(false)
const formError = ref('')

const toggleDay = (value) => {
  const next = new Set(formDays.value)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  formDays.value = next
}

const openCreateForm = () => {
  editingId.value = null
  formDays.value = new Set()
  formStart.value = '15:00'
  formEnd.value = '16:30'
  formError.value = ''
  showForm.value = true
}

const openEditForm = (schedule) => {
  editingId.value = schedule.id
  formDays.value = new Set(schedule.days_of_week)
  formStart.value = schedule.start_time?.slice(0, 5) || '15:00'
  formEnd.value = schedule.end_time?.slice(0, 5) || '16:30'
  formError.value = ''
  showForm.value = true
}

const closeForm = () => {
  if (saving.value) return
  showForm.value = false
}

const isValid = computed(() => formDays.value.size > 0 && formStart.value < formEnd.value)

const handleSave = async () => {
  if (!isValid.value) {
    formError.value = formDays.value.size === 0
      ? 'Pick at least one day.'
      : 'Start time must be before end time.'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    const payload = {
      course_id: props.courseId,
      days_of_week: [...formDays.value],
      start_time: formStart.value,
      end_time: formEnd.value
    }
    if (editingId.value) {
      const res = await classScheduleService.updateSchedule(editingId.value, payload)
      const updated = res.data?.schedule
      const idx = schedules.value.findIndex(s => s.id === editingId.value)
      if (idx !== -1 && updated) schedules.value[idx] = updated
    } else {
      const res = await classScheduleService.createSchedule(payload)
      if (res.data?.schedule) schedules.value.push(res.data.schedule)
    }
    showForm.value = false
    emit('changed')
  } catch (err) {
    formError.value = err.response?.data?.error || err.message || 'Failed to save schedule.'
  } finally {
    saving.value = false
  }
}

// ── Delete ───────────────────────────────────────────────────────────────
const deletingId = ref(null)
const deleteError = ref('')

const handleDelete = async (schedule) => {
  if (!window.confirm(`Remove the ${scheduleSummary(schedule)} schedule?`)) return
  deletingId.value = schedule.id
  deleteError.value = ''
  try {
    await classScheduleService.deleteSchedule(schedule.id)
    schedules.value = schedules.value.filter(s => s.id !== schedule.id)
    emit('changed')
  } catch (err) {
    deleteError.value = err.response?.data?.error || err.message || 'Failed to remove schedule.'
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">Recurring schedule</h3>
        <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          Students get a reminder notification shortly before each scheduled session.
        </p>
      </div>
      <button
        @click="openCreateForm"
        class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#006A3A] hover:bg-[#005A31] text-white font-bold text-xs shadow-sm transition cursor-pointer active:scale-95 shrink-0"
      >
        <span class="text-sm font-normal leading-none">+</span> Add Time Slot
      </button>
    </div>

    <p v-if="deleteError" class="text-xs text-red-600">{{ deleteError }}</p>

    <div v-if="loading" class="text-center py-6 text-slate-500 text-xs">Loading schedule...</div>
    <p v-else-if="loadError" class="text-xs text-red-600">{{ loadError }}</p>

    <div v-else-if="schedules.length === 0" class="w-full border-2 border-dashed border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/30 p-6 text-center">
      <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">No recurring schedule set</p>
      <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Add a time slot so students know when this class meets.</p>
    </div>

    <div v-else class="space-y-2.5">
      <div
        v-for="schedule in schedules"
        :key="schedule.id"
        class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-slate-800 text-[#006A3A] dark:text-emerald-400 flex items-center justify-center text-sm shrink-0">
            📅
          </div>
          <div class="min-w-0">
            <p class="text-xs font-bold text-slate-900 dark:text-white truncate">{{ scheduleSummary(schedule) }}</p>
            <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {{ schedule.is_active ? 'Active' : 'Paused — no reminders sent' }} · {{ schedule.timezone }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            @click="openEditForm(schedule)"
            class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Edit
          </button>
          <button
            @click="handleDelete(schedule)"
            :disabled="deletingId === schedule.id"
            class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer disabled:opacity-50"
          >
            {{ deletingId === schedule.id ? 'Removing...' : 'Remove' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ADD / EDIT FORM MODAL -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      @click.self="closeForm"
    >
      <div class="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-1">
          {{ editingId ? 'Edit time slot' : 'Add a time slot' }}
        </h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Pick the days this class repeats on and its start/end time.
        </p>

        <label class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2">Days</label>
        <div class="flex items-center gap-1.5 flex-wrap mb-5">
          <button
            v-for="day in DAY_OPTIONS"
            :key="day.value"
            type="button"
            @click="toggleDay(day.value)"
            :class="[
              'w-11 h-11 rounded-xl text-xs font-bold transition cursor-pointer',
              formDays.has(day.value)
                ? 'bg-[#006A3A] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            ]"
          >
            {{ day.label }}
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">Start time</label>
            <input
              v-model="formStart"
              type="time"
              class="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">End time</label>
            <input
              v-model="formEnd"
              type="time"
              class="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <p v-if="formError" class="text-xs text-red-600 mb-3">{{ formError }}</p>

        <div class="flex justify-end gap-3 mt-5">
          <button
            @click="closeForm"
            :disabled="saving"
            class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="handleSave"
            :disabled="saving"
            class="px-5 py-2.5 rounded-xl bg-[#006A3A] text-white font-semibold text-sm hover:bg-[#005A31] disabled:opacity-50 cursor-pointer"
          >
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

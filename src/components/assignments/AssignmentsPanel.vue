<template>
  <div class="max-w-[1200px] text-left">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-start justify-between gap-4 mb-5">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="f in FILTERS"
          :key="f.id"
          type="button"
          @click="filter = f.id"
          :class="[
            'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer border',
            filter === f.id
              ? 'bg-emerald-50 text-[#006A3A] border-emerald-200 dark:bg-emerald-50 dark:text-[#006A3A]'
              : 'bg-white dark:bg-[#111A28] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          ]"
        >
          {{ f.label }}
          <span :class="['px-1.5 rounded-full text-[10px]', filter === f.id ? 'bg-emerald-100' : 'bg-slate-100 dark:bg-slate-800']">{{ counts[f.id] }}</span>
        </button>
      </div>
      <div class="flex flex-col items-end gap-3 w-full sm:w-auto">
        <input
          v-model="query"
          type="search"
          placeholder="Search assignments"
          class="w-full sm:w-80 px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-[#111A28] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006A3A]/30"
        />
        <button
          v-if="canManage"
          type="button"
          @click="$emit('create')"
          class="px-5 py-2.5 rounded-xl bg-[#0f7a45] hover:bg-[#0c6a3c] text-white text-sm font-bold transition cursor-pointer shadow-[0_3px_0_#0a5530]"
        >
          + New assignment
        </button>
      </div>
    </div>

    <!-- Loading: grey placeholder cards -->
    <div v-if="loading" class="space-y-3">
      <div v-for="n in 3" :key="n" class="animate-pulse rounded-2xl p-5 bg-white dark:bg-[#111A28] border border-slate-200/80 dark:border-slate-800">
        <div class="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700 mb-3"></div>
        <div class="h-3 w-1/4 rounded bg-slate-100 dark:bg-slate-800 mb-5"></div>
        <div class="h-2 w-full rounded bg-slate-100 dark:bg-slate-800"></div>
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="assignments.length === 0"
      class="rounded-2xl border-2 border-dashed border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/30 p-10 text-center"
    >
      <div class="w-12 h-12 rounded-full bg-emerald-50 dark:bg-slate-800 flex items-center justify-center mb-3 mx-auto">
        <BrandIcon name="assignment" :set="lightSet" :size="28" />
      </div>
      <h3 class="text-base font-bold text-slate-900 dark:text-white">No assignments yet</h3>
      <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 mb-4">Create one for students to submit work.</p>
      <button
        v-if="canManage"
        type="button"
        @click="$emit('create')"
        class="px-5 py-2 rounded-xl bg-[#0f7a45] hover:bg-[#0c6a3c] text-white text-sm font-bold transition cursor-pointer"
      >
        New assignment
      </button>
    </div>

    <div
      v-else-if="visible.length === 0"
      class="flex flex-col items-center gap-2 py-14 px-6 rounded-2xl border border-dashed border-slate-300 dark:border-[#2E3D58] text-center"
    >
      <BrandIcon name="assignment" :set="lightSet" :size="40" />
      <p class="text-base font-semibold text-slate-900 dark:text-white">No assignments here</p>
      <p class="text-sm text-slate-500 dark:text-slate-400">Try another filter, or create a new assignment.</p>
    </div>

    <!-- Cards -->
    <div v-else class="flex flex-col gap-3">
      <article
        v-for="a in visible"
        :key="a.id"
        :class="[
          'rounded-2xl p-5 bg-white dark:bg-[#111A28] border hover:shadow-md transition',
          statusOf(a) === 'due-soon' ? 'border-amber-300/70 dark:border-[#5A4615]' : statusOf(a) === 'closed' ? 'border-slate-200/80 dark:border-[#1C2840]' : 'border-slate-200/80 dark:border-[#22304A]'
        ]"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 space-y-1.5">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h4 class="text-lg font-extrabold text-slate-900 dark:text-white">{{ a.title }}</h4>
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300">
                {{ a.type === 'quiz' ? 'Quiz' : 'Homework' }}
              </span>
              <span :class="['px-2.5 py-0.5 rounded-full text-[11px] font-bold', STATUS_CLASS[statusOf(a)], statusOf(a) === 'draft' ? 'border border-dashed border-slate-400/60' : '']">
                {{ STATUS_LABEL[statusOf(a)] }}
              </span>
            </div>
            <p class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <BrandIcon name="lesson" :set="lightSet" :size="14" />
              <span>{{ summaryOf(a) }}</span>
            </p>
            <p :class="['flex items-center gap-2 text-xs font-bold', DUE_CLASS[statusOf(a)]]">
              <BrandIcon name="study-time" :set="lightSet" :size="14" />
              <span>{{ dueText(a) }}</span>
            </p>
            <p v-if="a.stats?.missing_explanations > 0 && statusOf(a) === 'draft'" class="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
              <span aria-hidden="true">⚠</span>
              {{ a.stats.missing_explanations }} question{{ a.stats.missing_explanations === 1 ? '' : 's' }} {{ a.stats.missing_explanations === 1 ? 'has' : 'have' }} no explanation for students
            </p>
          </div>

          <div v-if="canManage" class="flex items-center gap-2 shrink-0">
            <button
              v-if="statusOf(a) === 'draft'"
              type="button"
              @click="$emit('edit', a.id)"
              class="px-4 py-2 rounded-xl border border-emerald-600/70 text-[#006A3A] dark:text-emerald-300 text-sm font-bold hover:bg-emerald-50 dark:hover:bg-emerald-400/10 transition cursor-pointer"
            >Continue editing</button>
            <button
              v-else-if="statusOf(a) === 'scheduled'"
              type="button"
              @click="$emit('edit', a.id)"
              class="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >Edit</button>
            <button
              v-else
              type="button"
              @click="$emit('results', a.id)"
              class="px-5 py-2 rounded-xl bg-[#0f7a45] hover:bg-[#0c6a3c] text-white text-sm font-bold transition cursor-pointer shadow-[0_3px_0_#0a5530]"
            >View results</button>
            <div class="relative">
              <button
                type="button"
                class="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg leading-none cursor-pointer"
                aria-label="More actions"
                @click.stop="menuFor = menuFor === a.id ? null : a.id"
              >⋮</button>
              <div
                v-if="menuFor === a.id"
                class="absolute right-0 top-11 z-20 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1 text-xs font-semibold"
              >
                <button class="menu-item" @click="act(() => $emit('edit', a.id))">Edit</button>
                <button class="menu-item" @click="act(() => openDuplicate(a))">Duplicate to another class</button>
                <button v-if="a.status === 'published'" class="menu-item" @click="act(() => openExtend(a))">Extend due date…</button>
                <button v-if="a.status === 'published' && !a.closed_at" class="menu-item" @click="act(() => setClosed(a, true))">Close now</button>
                <button v-if="a.closed_at" class="menu-item" @click="act(() => setClosed(a, false))">Reopen</button>
                <div class="my-1 border-t border-slate-100 dark:border-slate-800"></div>
                <button class="menu-item menu-danger" @click="act(() => openDelete(a))">Delete…</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Progress -->
        <div v-if="a.stats && a.status === 'published' && statusOf(a) !== 'scheduled'" class="mt-4 flex items-center gap-5">
          <div class="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div :class="['h-full rounded-full', statusOf(a) === 'closed' ? 'bg-slate-400 dark:bg-slate-500' : 'bg-emerald-500']" :style="{ width: percentSubmitted(a) + '%' }"></div>
          </div>
          <span class="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <strong class="text-slate-900 dark:text-white">{{ a.stats.submitted }}</strong> / {{ a.stats.enrolled }} submitted
          </span>
          <span v-if="a.stats.average_percent !== null" class="text-xs font-bold text-amber-600 dark:text-amber-300 whitespace-nowrap">
            Avg {{ Math.round(a.stats.average_percent / 100 * (a.points || 100)) }}/{{ a.points || 100 }}
          </span>
        </div>
      </article>
    </div>

    <!-- Extend due date -->
    <div v-if="dialog?.kind === 'extend'" class="dialog-backdrop" @click.self="closeDialog">
      <div class="dialog">
        <h3 class="dialog-title">Extend due date</h3>
        <p class="dialog-text">{{ dialog.a.title }}</p>
        <input v-model="dialog.value" type="datetime-local" class="dialog-input" />
        <p v-if="dialog.error" class="text-xs text-red-600 mt-2">{{ dialog.error }}</p>
        <div class="dialog-actions">
          <button class="btn-ghost" @click="closeDialog">Cancel</button>
          <button class="btn-primary" :disabled="busy || !dialog.value" @click="submitExtend">{{ busy ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
    </div>

    <!-- Duplicate -->
    <div v-if="dialog?.kind === 'duplicate'" class="dialog-backdrop" @click.self="closeDialog">
      <div class="dialog">
        <h3 class="dialog-title">Duplicate assignment</h3>
        <p class="dialog-text">Copies “{{ dialog.a.title }}” (and its questions) as a draft into:</p>
        <select v-model="dialog.courseId" class="dialog-input">
          <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}{{ c.id === courseId ? ' (this class)' : '' }}</option>
        </select>
        <p v-if="dialog.error" class="text-xs text-red-600 mt-2">{{ dialog.error }}</p>
        <div class="dialog-actions">
          <button class="btn-ghost" @click="closeDialog">Cancel</button>
          <button class="btn-primary" :disabled="busy || !dialog.courseId" @click="submitDuplicate">{{ busy ? 'Copying…' : 'Duplicate' }}</button>
        </div>
      </div>
    </div>

    <!-- Delete: type the title -->
    <div v-if="dialog?.kind === 'delete'" class="dialog-backdrop" @click.self="closeDialog">
      <div class="dialog">
        <h3 class="dialog-title">Delete assignment?</h3>
        <p class="dialog-text">
          This removes the assignment{{ dialog.a.stats?.submitted ? ` and ${dialog.a.stats.submitted} submission${dialog.a.stats.submitted === 1 ? '' : 's'}` : '' }}. It cannot be undone.
          Type <strong class="text-slate-900 dark:text-white">{{ dialog.a.title }}</strong> to confirm.
        </p>
        <input v-model="dialog.value" type="text" class="dialog-input" :placeholder="dialog.a.title" />
        <p v-if="dialog.error" class="text-xs text-red-600 mt-2">{{ dialog.error }}</p>
        <div class="dialog-actions">
          <button class="btn-ghost" @click="closeDialog">Cancel</button>
          <button class="btn-danger" :disabled="busy || dialog.value.trim() !== dialog.a.title.trim()" @click="submitDelete">{{ busy ? 'Deleting…' : 'Delete' }}</button>
        </div>
      </div>
    </div>

    <p v-if="toast" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold shadow-lg">{{ toast }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import BrandIcon from '@/components/ui/BrandIcon.vue'
import { useTheme } from '@/composables/useTheme.js'
import { assignmentService } from '@/services/assignmentService'
import { courseService } from '@/services/courseService'
import { formatDate, formatShort } from '@/utils/dateFormat'
import { statusOf, STATUS_LABEL, STATUS_CLASS, relativeTime } from '@/utils/assignmentStatus'

const props = defineProps({
  assignments: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  courseId: { type: String, required: true },
  canManage: { type: Boolean, default: false },
})
const emit = defineEmits(['create', 'edit', 'results', 'changed'])

const { isDark } = useTheme()
const lightSet = computed(() => (isDark.value ? 'darkmode-line' : 'line-light'))

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'due-soon', label: 'Due soon' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'draft', label: 'Drafts' },
  { id: 'closed', label: 'Closed' },
]
// "Open" includes the ones that are due soon.
const matches = (a, id) => id === 'all' || (id === 'open' ? ['open', 'due-soon'].includes(statusOf(a)) : statusOf(a) === id)
const counts = computed(() => Object.fromEntries(FILTERS.map(f => [f.id, props.assignments.filter(a => matches(a, f.id)).length])))

const DUE_CLASS = {
  draft: 'text-slate-500 dark:text-slate-400',
  scheduled: 'text-sky-600 dark:text-sky-300',
  open: 'text-slate-800 dark:text-slate-100',
  'due-soon': 'text-amber-600 dark:text-amber-300',
  closed: 'text-slate-500 dark:text-slate-400',
}
const summaryOf = (a) => {
  const n = a.stats?.question_count
  return [a.type === 'quiz' && n !== undefined ? `${n} question${n === 1 ? '' : 's'}` : null, `${a.points || 100} points`].filter(Boolean).join(' · ')
}
// "today" / "tomorrow" when it is, else just the date.
const dayWord = (iso) => {
  const day = formatDate(iso)
  if (day === formatDate(new Date())) return 'today'
  if (day === formatDate(new Date(Date.now() + 24 * 3600e3))) return 'tomorrow'
  return ''
}
const dueText = (a) => {
  const st = statusOf(a)
  const due = a.due_date ? formatShort(a.due_date) : ''
  if (st === 'draft') return `Not published · ${a.due_date ? `due ${due}` : 'no due date yet'}`
  if (st === 'scheduled') return `Opens ${formatShort(a.opens_at)}${a.due_date ? ` · due ${due}` : ''}`
  if (st === 'closed') return a.due_date && !a.closed_at ? `Closed ${due}` : `Closed ${formatShort(a.closed_at || a.due_date)}`
  if (!a.due_date) return 'No due date'
  const word = dayWord(a.due_date)
  return `Due ${word ? word + ' ' : ''}${formatShort(a.due_date).replace(' · ', ' · ')} · ${relativeTime(a.due_date)}`
}
const filter = ref('all')
const query = ref('')

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.assignments.filter((a) => {
    if (!matches(a, filter.value)) return false
    return !q || (a.title || '').toLowerCase().includes(q)
  })
})

const percentSubmitted = (a) =>
  a.stats?.enrolled ? Math.min(100, Math.round((a.stats.submitted / a.stats.enrolled) * 100)) : 0

// ⋯ menu
const menuFor = ref(null)
const closeMenu = () => { menuFor.value = null }
onMounted(() => document.addEventListener('click', closeMenu))
onBeforeUnmount(() => document.removeEventListener('click', closeMenu))
const act = (fn) => { menuFor.value = null; fn() }

const toast = ref('')
let toastTimer
const showToast = (msg) => {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2500)
}
const errorText = (err) => err.response?.data?.error || err.message || 'Something went wrong'

const dialog = ref(null)
const busy = ref(false)
const closeDialog = () => { if (!busy.value) dialog.value = null }

// Close / reopen
const setClosed = async (a, closed) => {
  try {
    await assignmentService.setClosed(a.id, closed)
    showToast(closed ? 'Assignment closed' : 'Assignment reopened')
    emit('changed')
  } catch (err) { showToast(errorText(err)) }
}

// Extend
const toLocalInput = (iso) => {
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const openExtend = (a) => { dialog.value = { kind: 'extend', a, value: toLocalInput(a.due_date), error: '' } }
const submitExtend = async () => {
  busy.value = true
  try {
    // Extending a closed assignment past now should also let students in again.
    const due = new Date(dialog.value.value)
    await assignmentService.updateAssignment(dialog.value.a.id, {
      due_date: due.toISOString(),
      ...(dialog.value.a.closed_at && due.getTime() > Date.now() ? { closed: false } : {}),
    })
    busy.value = false
    dialog.value = null
    showToast('Due date updated')
    emit('changed')
  } catch (err) { dialog.value.error = errorText(err); busy.value = false }
}

// Duplicate
const courses = ref([])
const openDuplicate = async (a) => {
  dialog.value = { kind: 'duplicate', a, courseId: props.courseId, error: '' }
  if (courses.value.length === 0) {
    try {
      const res = await courseService.getCourses()
      courses.value = res.data?.courses || res.data || []
    } catch { courses.value = [] }
  }
}
const submitDuplicate = async () => {
  busy.value = true
  try {
    await assignmentService.duplicateAssignment(dialog.value.a.id, dialog.value.courseId)
    const sameClass = dialog.value.courseId === props.courseId
    busy.value = false
    dialog.value = null
    showToast(sameClass ? 'Copied as a draft' : 'Copied to the other class as a draft')
    if (sameClass) emit('changed')
  } catch (err) { dialog.value.error = errorText(err); busy.value = false }
}

// Delete
const openDelete = (a) => { dialog.value = { kind: 'delete', a, value: '', error: '' } }
const submitDelete = async () => {
  busy.value = true
  try {
    await assignmentService.deleteAssignment(dialog.value.a.id)
    busy.value = false
    dialog.value = null
    showToast('Assignment deleted')
    emit('changed')
  } catch (err) { dialog.value.error = errorText(err); busy.value = false }
}
</script>

<style scoped>
.menu-item { display: block; width: 100%; text-align: left; padding: 0.5rem 0.9rem; cursor: pointer; color: rgb(51 65 85); }
.menu-item:hover { background: rgb(241 245 249); }
.menu-danger { color: rgb(185 28 28); }
:global(.dark) .menu-danger { color: #FCA5A5; }
:global(.dark) .menu-item { color: rgb(226 232 240); }
:global(.dark) .menu-danger { color: #FCA5A5; }
:global(.dark) .menu-item:hover { background: rgb(30 41 59); }
.dialog-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgb(0 0 0 / 0.4); backdrop-filter: blur(4px); }
.dialog { width: 100%; max-width: 26rem; border-radius: 1.5rem; padding: 1.5rem; background: white; border: 1px solid rgb(226 232 240); box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25); }
:global(.dark) .dialog { background: rgb(15 23 42); border-color: rgb(30 41 59); }
.dialog-title { font-size: 1.05rem; font-weight: 700; margin-bottom: 0.4rem; color: rgb(15 23 42); }
:global(.dark) .dialog-title { color: white; }
.dialog-text { font-size: 0.8rem; line-height: 1.5; margin-bottom: 0.9rem; color: rgb(71 85 105); }
:global(.dark) .dialog-text { color: rgb(148 163 184); }
.dialog-input { width: 100%; padding: 0.55rem 0.8rem; border-radius: 0.75rem; font-size: 0.85rem; background: transparent; border: 1px solid rgb(203 213 225); color: inherit; }
:global(.dark) .dialog-input { border-color: rgb(51 65 85); color: white; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.1rem; }
.btn-ghost, .btn-primary, .btn-danger { padding: 0.45rem 1.1rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
.btn-ghost { color: rgb(71 85 105); }
.btn-ghost:hover { background: rgb(226 232 240 / 0.6); }
.btn-primary { background: #006a3a; color: white; }
.btn-danger { background: #b91c1c; color: white; }
.btn-primary:disabled, .btn-danger:disabled { opacity: 0.45; cursor: not-allowed; }
</style>

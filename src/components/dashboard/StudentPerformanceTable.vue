<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { insightsService } from '../../services/insightsService.js'

// Dashboard "Student performance" table: one row per student per class, with
// server-side search / status filter / sorting / paging. The class filter comes
// from the dashboard's filter bar.
const props = defineProps({
  // Class chosen in the dashboard's filter bar (the table starts from it, and
  // follows it when it changes) and the classes available to pick from.
  courseId: { type: String, default: '' },
  courses: { type: Array, default: () => [] },
})

const router = useRouter()
const PAGE_SIZE = 10

const rows = ref([])
const pagination = ref({ page: 1, limit: PAGE_SIZE, total: 0, total_pages: 1 })
const statusCounts = ref({})
const loading = ref(false)
const error = ref('')

const classId = ref(props.courseId || '')
const search = ref('')
const status = ref('')
const sort = ref('progress')
const dir = ref('desc')
const page = ref(1)

const STATUS_META = {
  on_track: { label: 'On track', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  behind: { label: 'Behind', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  inactive: { label: 'Inactive', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
  not_started: { label: 'Not started', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  completed: { label: 'Completed', cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300' },
}
const STATUS_ORDER = ['on_track', 'behind', 'inactive', 'not_started', 'completed']

const COLUMNS = [
  { key: 'name', label: 'Student', cls: 'min-w-[200px]' },
  { key: 'course', label: 'Class', cls: 'min-w-[150px]' },
  { key: 'progress', label: 'Progress', cls: 'min-w-[170px]' },
  { key: 'avg_quiz', label: 'Avg quiz', cls: 'min-w-[90px]' },
  { key: 'quizzes', label: 'Quizzes', cls: 'min-w-[80px]' },
  { key: 'last_active', label: 'Last active', cls: 'min-w-[110px]' },
  { key: 'status', label: 'Status', cls: 'min-w-[110px]' },
]

// Date filter = when the student was last active (UTC days). "Any time" keeps
// everyone, including students who have never been active.
const DATE_PRESETS = [
  { key: 'any', label: 'Any time' },
  { key: '7', label: '7d' },
  { key: '30', label: '30d' },
  { key: '90', label: '90d' },
  { key: 'custom', label: 'Custom' },
]
const datePreset = ref('any')
const customFrom = ref('')
const customTo = ref('')
const todayYmd = () => new Date().toISOString().slice(0, 10)
const daysAgoYmd = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
const activeRange = computed(() => {
  if (datePreset.value === 'any') return { activeFrom: null, activeTo: null }
  if (datePreset.value === 'custom') {
    const ok = customFrom.value && customTo.value && customFrom.value > customTo.value
    return ok ? { activeFrom: null, activeTo: null } : { activeFrom: customFrom.value || null, activeTo: customTo.value || null }
  }
  return { activeFrom: daysAgoYmd(Number(datePreset.value) - 1), activeTo: todayYmd() }
})
const customInvalid = computed(() => datePreset.value === 'custom' && customFrom.value && customTo.value && customFrom.value > customTo.value)
const pickPreset = (key) => {
  datePreset.value = key
  if (key === 'custom') {
    if (!customTo.value) customTo.value = todayYmd()
    if (!customFrom.value) customFrom.value = daysAgoYmd(29)
  }
}
const filtersActive = computed(() => !!(status.value || search.value.trim() || datePreset.value !== 'any' || classId.value))
const resetFilters = () => {
  status.value = ''; search.value = ''; datePreset.value = 'any'; customFrom.value = ''; customTo.value = ''; classId.value = props.courseId || ''
}

const filters = computed(() => ({
  courseId: classId.value || null,
  ...activeRange.value,
  status: status.value || null,
  q: search.value.trim() || null,
  sort: sort.value,
  dir: dir.value,
  page: page.value,
  limit: PAGE_SIZE,
}))

// Only the latest request may update the table (typing/sorting fast fires many).
let controller = null
const load = async ({ fresh = false } = {}) => {
  controller?.abort()
  controller = new AbortController()
  const mine = controller
  loading.value = true
  error.value = ''
  try {
    const data = await insightsService.getStudentsTable({ ...filters.value, fresh }, { signal: mine.signal })
    if (mine.signal.aborted) return
    rows.value = data.rows || []
    pagination.value = data.pagination || pagination.value
    statusCounts.value = data.status_counts || {}
    // The server clamps the page (e.g. after a filter shrinks the result).
    if (pagination.value.page !== page.value) page.value = pagination.value.page
  } catch (err) {
    if (mine.signal.aborted || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
    error.value = err.response?.data?.error || err.message || 'Failed to load students.'
  } finally {
    if (controller === mine) loading.value = false
  }
}

let searchTimer = null
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; load() }, 300)
})
watch(() => props.courseId, (id) => { classId.value = id || '' })
watch(() => [classId.value, status.value, activeRange.value.activeFrom, activeRange.value.activeTo], () => { page.value = 1; load() })
watch([sort, dir, page], () => load())
onBeforeUnmount(() => { clearTimeout(searchTimer); controller?.abort() })

const sortBy = (key) => {
  if (sort.value === key) dir.value = dir.value === 'asc' ? 'desc' : 'asc'
  else { sort.value = key; dir.value = key === 'name' || key === 'course' ? 'asc' : 'desc' }
  page.value = 1
}
const ariaSort = (key) => (sort.value === key ? (dir.value === 'asc' ? 'ascending' : 'descending') : 'none')

const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const lastActiveText = (r) => {
  if (r.days_inactive == null) return '—'
  if (r.days_inactive === 0) return 'Today'
  if (r.days_inactive === 1) return 'Yesterday'
  return `${r.days_inactive} days ago`
}
const openStudent = (r) => router.push({ name: 'StudentProfile', params: { id: r.student_id } })

const from = computed(() => (pagination.value.total ? (pagination.value.page - 1) * pagination.value.limit + 1 : 0))
const to = computed(() => Math.min(pagination.value.page * pagination.value.limit, pagination.value.total))
// Up to 5 page buttons around the current page.
const pageButtons = computed(() => {
  const { page: p, total_pages: n } = pagination.value
  const start = Math.max(1, Math.min(p - 2, n - 4))
  return Array.from({ length: Math.min(5, n) }, (_, i) => start + i)
})

// ── Export dialog ────────────────────────────────────────────────────────
const FORMATS = [
  { key: 'xlsx', label: 'Excel', ext: '.xlsx' },
  { key: 'csv', label: 'CSV', ext: '.csv' },
  { key: 'pdf', label: 'PDF', ext: '.pdf' },
]
const showExport = ref(false)
const exportClass = ref('')
const exportFormat = ref('xlsx')
const exportContacts = ref(false)
const exporting = ref(false)
const exportError = ref('')

const openExport = () => {
  exportClass.value = classId.value
  exportError.value = ''
  showExport.value = true
}
const closeExport = () => { if (!exporting.value) showExport.value = false }
const exportClassName = computed(() => props.courses.find(c => c.id === exportClass.value)?.title || '')
const exportWhat = computed(() => {
  const all = !exportClass.value
  if (exportFormat.value === 'xlsx') return all ? `One workbook: an “All classes” sheet, then a sheet for each class (${props.courses.length}).` : `One workbook with a single sheet for “${exportClassName.value}”.`
  if (exportFormat.value === 'csv') return all ? `A .zip with “All classes.csv” plus one CSV for each class (${props.courses.length}).` : `One CSV file for “${exportClassName.value}”.`
  return all ? 'One PDF: an “All classes” section, then a section for each class.' : `One PDF for “${exportClassName.value}”.`
})
const appliedFilterText = computed(() => {
  const parts = []
  if (status.value) parts.push(STATUS_META[status.value].label)
  if (search.value.trim()) parts.push(`search “${search.value.trim()}”`)
  const { activeFrom, activeTo } = activeRange.value
  if (activeFrom || activeTo) parts.push(`last active ${activeFrom || '…'} → ${activeTo || '…'}`)
  return parts.join(' · ')
})
const runExport = async () => {
  exporting.value = true
  exportError.value = ''
  try {
    await insightsService.downloadStudentsTable(
      { ...filters.value, courseId: exportClass.value || null, page: null, limit: null },
      { format: exportFormat.value, includeContacts: exportContacts.value },
    )
    showExport.value = false
  } catch (err) {
    let msg = err.message || 'Failed to export.'
    try { msg = JSON.parse(await err.response.data.text()).error || msg } catch { /* keep msg */ }
    exportError.value = msg
  } finally {
    exporting.value = false
  }
}
const onKeydown = (e) => { if (e.key === 'Escape' && showExport.value) closeExport() }
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

load()
defineExpose({ reload: () => load({ fresh: true }) })
</script>

<template>
  <section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-extrabold text-slate-900 dark:text-white">Student performance</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {{ pagination.total }} {{ pagination.total === 1 ? 'row' : 'rows' }} match your filters · sort, search and export exactly what you see
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-[220px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="text-slate-400" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            v-model="search"
            type="text"
            placeholder="Search name, email or phone"
            aria-label="Search students"
            class="w-full bg-transparent outline-none text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
          />
        </label>
        <button
          type="button"
          @click="openExport"
          class="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#006A3A] text-white font-bold text-xs hover:bg-[#005A31] transition cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" /></svg>
          Export…
        </button>
      </div>
    </div>

    <!-- Class + last-active date filters -->
    <div class="flex flex-wrap items-end gap-4">
      <label class="flex flex-col gap-1.5">
        <span class="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400">CLASS</span>
        <select
          v-model="classId"
          class="h-9 min-w-[200px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100"
        >
          <option value="">All classes ({{ courses.length }})</option>
          <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option>
        </select>
      </label>
      <div class="flex flex-col gap-1.5">
        <span class="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400">LAST ACTIVE</span>
        <div class="flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800" role="group" aria-label="Last active date range">
          <button
            v-for="p in DATE_PRESETS"
            :key="p.key"
            type="button"
            @click="pickPreset(p.key)"
            :aria-pressed="datePreset === p.key"
            class="h-8 px-3 rounded-lg text-xs font-bold cursor-pointer transition"
            :class="datePreset === p.key ? 'bg-white dark:bg-slate-700 text-[#006A3A] dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'"
          >{{ p.label }}</button>
        </div>
      </div>
      <div v-if="datePreset === 'custom'" class="flex items-end gap-2">
        <label class="flex flex-col gap-1.5">
          <span class="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400">FROM</span>
          <input v-model="customFrom" type="date" :max="customTo || todayYmd()" class="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400">TO</span>
          <input v-model="customTo" type="date" :min="customFrom" :max="todayYmd()" class="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100" />
        </label>
        <span v-if="customInvalid" class="pb-2 text-xs font-semibold text-red-500">“From” must be before “To”</span>
      </div>
      <button v-if="filtersActive" type="button" @click="resetFilters" class="h-9 text-xs font-bold text-[#006A3A] dark:text-emerald-400 cursor-pointer">Reset filters</button>
    </div>

    <!-- Status filter -->
    <div class="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
      <button
        type="button"
        @click="status = ''"
        :aria-pressed="!status"
        class="h-8 px-3 rounded-full border text-xs font-semibold cursor-pointer transition"
        :class="!status ? 'border-[#006A3A] bg-emerald-50 dark:bg-emerald-500/10 text-[#006A3A] dark:text-emerald-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'"
      >All</button>
      <button
        v-for="s in STATUS_ORDER"
        :key="s"
        type="button"
        @click="status = status === s ? '' : s"
        :aria-pressed="status === s"
        class="h-8 px-3 rounded-full border text-xs font-semibold cursor-pointer transition"
        :class="status === s ? 'border-[#006A3A] bg-emerald-50 dark:bg-emerald-500/10 text-[#006A3A] dark:text-emerald-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'"
      >{{ STATUS_META[s].label }} <b class="font-extrabold">{{ statusCounts[s] ?? 0 }}</b></button>
    </div>

    <div v-if="error" class="p-3 rounded-xl bg-red-500/10 text-red-500 text-xs">{{ error }}</div>

    <div class="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800" :aria-busy="loading">
      <table class="w-full text-sm" :class="loading ? 'opacity-60 transition-opacity' : ''">
        <thead>
          <tr class="bg-slate-50 dark:bg-slate-800/60 text-left">
            <th
              v-for="c in COLUMNS"
              :key="c.key"
              scope="col"
              :aria-sort="ariaSort(c.key)"
              class="px-4 py-3 text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap"
              :class="c.cls"
            >
              <button type="button" @click="sortBy(c.key)" class="flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-slate-800 dark:hover:text-white">
                {{ c.label }}
                <span aria-hidden="true" :class="sort === c.key ? 'text-[#006A3A] dark:text-emerald-400' : 'opacity-30'">{{ sort === c.key && dir === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading && !rows.length">
            <tr v-for="n in 5" :key="'sk' + n" class="border-t border-slate-100 dark:border-slate-800">
              <td v-for="c in COLUMNS" :key="c.key" class="px-4 py-4"><div class="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse"></div></td>
            </tr>
          </template>
          <tr v-else-if="!rows.length">
            <td :colspan="COLUMNS.length" class="px-4 py-10 text-center text-xs text-slate-400">
              {{ search || status ? 'No students match these filters.' : 'No enrolled students yet.' }}
            </td>
          </tr>
          <tr
            v-for="r in rows"
            :key="r.student_id + r.course_id"
            @click="openStudent(r)"
            class="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-3 min-w-0">
                <img v-if="r.avatar_url" :src="r.avatar_url" alt="" class="w-8 h-8 rounded-full object-cover shrink-0" />
                <span v-else class="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold flex items-center justify-center shrink-0">{{ initials(r.name) }}</span>
                <span class="font-bold text-slate-900 dark:text-white truncate">{{ r.name || '—' }}</span>
              </div>
            </td>
            <td class="px-4 py-3 text-slate-600 dark:text-slate-300">{{ r.course_title || '—' }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <div class="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="h-full bg-[#006A3A]" :style="{ width: r.progress + '%' }"></div></div>
                <span class="w-10 text-right text-xs font-bold text-slate-800 dark:text-slate-100">{{ r.progress }}%</span>
              </div>
            </td>
            <td class="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{{ r.avg_quiz != null ? r.avg_quiz + '%' : '—' }}</td>
            <td class="px-4 py-3 text-slate-600 dark:text-slate-300">{{ r.quizzes_attempted }}/{{ r.quizzes_total }}</td>
            <td class="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{{ lastActiveText(r) }}</td>
            <td class="px-4 py-3">
              <span class="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold" :class="STATUS_META[r.status]?.cls">{{ STATUS_META[r.status]?.label || r.status }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
      <span>Showing {{ from }}–{{ to }} of {{ pagination.total }}</span>
      <div class="flex gap-1.5" role="navigation" aria-label="Pages">
        <button type="button" aria-label="Previous page" :disabled="pagination.page <= 1" @click="page = pagination.page - 1" class="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">‹</button>
        <button
          v-for="n in pageButtons"
          :key="n"
          type="button"
          @click="page = n"
          :aria-current="n === pagination.page ? 'page' : undefined"
          class="w-8 h-8 rounded-lg font-bold cursor-pointer"
          :class="n === pagination.page ? 'bg-[#006A3A] text-white' : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'"
        >{{ n }}</button>
        <button type="button" aria-label="Next page" :disabled="pagination.page >= pagination.total_pages" @click="page = pagination.page + 1" class="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">›</button>
      </div>
    </div>

    <!-- Export dialog -->
    <div v-if="showExport" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" @click.self="closeExport">
      <div role="dialog" aria-modal="true" aria-labelledby="export-title" class="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 id="export-title" class="text-lg font-extrabold text-slate-900 dark:text-white">Export student table</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Choose which class to export and the file type.</p>
          </div>
          <button type="button" aria-label="Close" @click="closeExport" class="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 cursor-pointer">×</button>
        </div>

        <label class="flex flex-col gap-1.5">
          <span class="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400">WHICH CLASS</span>
          <select v-model="exportClass" class="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <option value="">All classes ({{ courses.length }})</option>
            <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option>
          </select>
        </label>

        <div class="flex flex-col gap-1.5">
          <span class="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400">FILE TYPE</span>
          <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="File type">
            <button
              v-for="f in FORMATS"
              :key="f.key"
              type="button"
              role="radio"
              :aria-checked="exportFormat === f.key"
              @click="exportFormat = f.key"
              class="h-14 rounded-xl border-2 text-left px-3 cursor-pointer transition"
              :class="exportFormat === f.key ? 'border-[#006A3A] bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700'"
            >
              <span class="block text-sm font-extrabold text-slate-900 dark:text-white">{{ f.label }}</span>
              <span class="block text-[11px] text-slate-500 dark:text-slate-400">{{ f.ext }}</span>
            </button>
          </div>
        </div>

        <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-700 dark:text-slate-200 space-y-1.5">
          <p><b>You will get:</b> {{ exportWhat }}</p>
          <p v-if="appliedFilterText"><b>Filters applied:</b> {{ appliedFilterText }}</p>
          <p v-else class="text-slate-500 dark:text-slate-400">No search, status or date filters applied — every student is included.</p>
        </div>

        <label class="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <input v-model="exportContacts" type="checkbox" class="w-4 h-4 accent-[#006A3A]" />
          Include email and phone <span class="text-slate-500 dark:text-slate-400 font-normal">(personal data)</span>
        </label>

        <div v-if="exportError" class="p-3 rounded-xl bg-red-500/10 text-red-500 text-xs">{{ exportError }}</div>

        <div class="flex justify-end gap-2 pt-1">
          <button type="button" @click="closeExport" :disabled="exporting" class="h-10 px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">Cancel</button>
          <button type="button" @click="runExport" :disabled="exporting" class="h-10 px-5 rounded-xl bg-[#006A3A] text-white text-sm font-bold hover:bg-[#005A31] cursor-pointer disabled:opacity-60 disabled:cursor-wait">
            {{ exporting ? 'Preparing…' : `Download ${FORMATS.find(f => f.key === exportFormat).label}` }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

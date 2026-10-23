<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { insightsService } from '../../services/insightsService.js'

// Dashboard "Student performance" table: one row per student per class, with
// server-side search / status filter / sorting / paging. The class filter comes
// from the dashboard's filter bar.
const props = defineProps({
  courseId: { type: String, default: '' },
})

const router = useRouter()
const PAGE_SIZE = 10

const rows = ref([])
const pagination = ref({ page: 1, limit: PAGE_SIZE, total: 0, total_pages: 1 })
const statusCounts = ref({})
const loading = ref(false)
const error = ref('')
const exporting = ref(false)

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

const filters = computed(() => ({
  courseId: props.courseId || null,
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
watch(() => [props.courseId, status.value], () => { page.value = 1; load() })
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

const exportTable = async () => {
  exporting.value = true
  try {
    await insightsService.downloadStudentsTable({ ...filters.value, page: null, limit: null })
  } catch (err) {
    let msg = err.message || 'Failed to export.'
    try { msg = JSON.parse(await err.response.data.text()).error || msg } catch { /* keep msg */ }
    error.value = msg
  } finally {
    exporting.value = false
  }
}

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
          @click="exportTable"
          :disabled="exporting || !pagination.total"
          class="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#006A3A] text-white font-bold text-xs hover:bg-[#005A31] transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" /></svg>
          {{ exporting ? 'Preparing…' : 'Export table to Excel' }}
        </button>
      </div>
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
  </section>
</template>

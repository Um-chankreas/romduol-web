<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { courseService } from '@/services/courseService'

// Search students by name / email / phone and add them to one class.
// Students already in the class never show up in the results.
const props = defineProps({ courseId: { type: String, required: true } })
const emit = defineEmits(['close', 'added'])

const query = ref('')
const results = ref([])
const picked = ref([])            // [{ id, name, email, phone }] — kept across searches
const searching = ref(false)
const saving = ref(false)
const error = ref('')

const pickedIds = computed(() => new Set(picked.value.map((s) => s.id)))
const toggle = (s) => {
  picked.value = pickedIds.value.has(s.id) ? picked.value.filter((p) => p.id !== s.id) : [...picked.value, s]
}

let timer = null
let seq = 0
watch(query, (q) => {
  clearTimeout(timer)
  if (q.trim().length < 2) { results.value = []; return }
  timer = setTimeout(async () => {
    const mine = ++seq
    searching.value = true
    try {
      const found = await courseService.searchStudentCandidates(props.courseId, q.trim())
      if (mine === seq) results.value = found
    } catch (e) {
      if (mine === seq) error.value = e.response?.data?.error || 'Could not search students.'
    } finally {
      if (mine === seq) searching.value = false
    }
  }, 300)
})
onBeforeUnmount(() => clearTimeout(timer))

const save = async () => {
  if (!picked.value.length) return
  saving.value = true
  error.value = ''
  try {
    await courseService.addStudents(props.courseId, picked.value.map((s) => s.id))
    emit('added')
  } catch (e) {
    error.value = e.response?.data?.error || 'Could not add students.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @click.self="!saving && emit('close')">
    <div class="w-full max-w-lg rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xl text-left">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white">Add students to this class</h2>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Search by name, email or phone number.</p>

      <input
        v-model="query"
        type="text"
        autofocus
        placeholder="Type at least 2 letters…"
        class="mt-4 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
      />

      <ul class="mt-3 max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        <li v-for="s in results" :key="s.id">
          <label class="flex items-center gap-3 py-2 cursor-pointer">
            <input type="checkbox" :checked="pickedIds.has(s.id)" @change="toggle(s)" class="w-4 h-4 accent-emerald-600" />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-slate-900 dark:text-white truncate">{{ s.name }}</span>
              <span class="block text-xs text-slate-500 dark:text-slate-400 truncate">{{ s.email || s.phone || '—' }}</span>
            </span>
          </label>
        </li>
        <li v-if="searching" class="py-3 text-xs text-slate-400">Searching…</li>
        <li v-else-if="query.trim().length >= 2 && !results.length" class="py-3 text-xs text-slate-400">
          No matching students outside this class.
        </li>
      </ul>

      <div v-if="picked.length" class="mt-3 flex flex-wrap gap-1.5">
        <button
          v-for="s in picked" :key="s.id" type="button" @click="toggle(s)"
          class="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 text-xs px-2.5 py-1"
        >{{ s.name }} <span aria-hidden="true">×</span></button>
      </div>

      <p v-if="error" class="mt-3 text-xs text-red-600">{{ error }}</p>

      <div class="mt-5 flex items-center justify-end gap-3">
        <button type="button" :disabled="saving" @click="emit('close')"
          class="px-5 py-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-sm font-semibold cursor-pointer disabled:opacity-50">Cancel</button>
        <button type="button" :disabled="saving || !picked.length" @click="save"
          class="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">
          {{ saving ? 'Adding…' : `Add ${picked.length || ''} student${picked.length === 1 ? '' : 's'}` }}
        </button>
      </div>
    </div>
  </div>
</template>

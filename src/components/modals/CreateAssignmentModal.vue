<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    @click.self="!saving && $emit('close')"
  >
    <div class="w-full max-w-lg rounded-[28px] bg-[#f8fafd] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-1 text-left">
        {{ assignment ? 'Edit assignment' : 'New assignment' }}
      </h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-5 text-left">
        Students submit text and/or a file; you grade each submission afterwards.
      </p>

      <div class="space-y-4 text-left">
        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-1.5">Title *</label>
          <input
            v-model="title"
            type="text"
            placeholder="e.g. Essay: French colonial administration"
            :disabled="saving"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-1.5">Instructions</label>
          <textarea
            v-model="description"
            rows="4"
            placeholder="What should students do? Length, format, what to submit…"
            :disabled="saving"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 resize-y"
          ></textarea>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-1.5">
            Due date <span class="font-medium text-slate-400">(optional)</span>
          </label>
          <input
            v-model="dueDate"
            type="datetime-local"
            :disabled="saving"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          />
        </div>
      </div>

      <p v-if="error" class="text-xs text-red-600 mt-4 text-left">{{ error }}</p>

      <div class="flex items-center justify-end gap-3 mt-6">
        <button
          @click="$emit('close')"
          :disabled="saving"
          class="px-5 py-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-sm font-semibold transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          @click="submit"
          :disabled="saving || !title.trim()"
          class="px-5 py-2 rounded-full bg-[#034d31] hover:bg-[#023824] text-white text-sm font-bold transition disabled:opacity-50"
        >
          {{ saving ? 'Saving…' : (assignment ? 'Save' : 'Create assignment') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  saving: { type: Boolean, default: false },
  error: { type: String, default: '' },
  assignment: { type: Object, default: null },
})

const emit = defineEmits(['close', 'create'])

const title = ref('')
const description = ref('')
const dueDate = ref('')

// `datetime-local` wants "YYYY-MM-DDTHH:mm" in local time.
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

watch(
  () => props.assignment,
  (a) => {
    title.value = a?.title || ''
    description.value = a?.description || ''
    dueDate.value = toLocalInput(a?.due_date)
  },
  { immediate: true },
)

const submit = () => {
  if (!title.value.trim()) return
  emit('create', {
    title: title.value.trim(),
    description: description.value.trim(),
    // Send an ISO string (or null) so the server stores an absolute instant.
    due_date: dueDate.value ? new Date(dueDate.value).toISOString() : null,
  })
}
</script>

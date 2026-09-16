<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    @click.self="!busy && $emit('close')"
  >
    <div class="w-full max-w-md rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-5 text-left">
        {{ isEdit ? 'Edit teacher' : 'Add teacher' }}
      </h2>

      <div class="space-y-4 text-left">
        <div>
          <label class="block text-xs font-medium text-slate-800 dark:text-slate-300 mb-1.5">
            Full name <span class="text-red-500">*</span>
          </label>
          <input
            v-model="name"
            type="text"
            placeholder="e.g. Dara Sok"
            :disabled="busy"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-800 dark:text-slate-300 mb-1.5">
            Email <span class="text-red-500">*</span>
          </label>
          <input
            v-model="email"
            type="email"
            placeholder="teacher@example.com"
            :disabled="busy"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm"
          />
          <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">The teacher signs in with this email.</p>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-800 dark:text-slate-300 mb-1.5">
            Phone
          </label>
          <input
            v-model="phone"
            type="tel"
            placeholder="0XX XXX XXX"
            :disabled="busy"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-800 dark:text-slate-300 mb-1.5">
            {{ isEdit ? 'New password' : 'Password' }}
            <span v-if="!isEdit" class="text-red-500">*</span>
            <span v-else class="font-normal text-slate-400">(leave blank to keep current)</span>
          </label>
          <input
            v-model="password"
            type="text"
            :placeholder="isEdit ? '••••••••' : 'At least 6 characters'"
            :disabled="busy"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm"
          />
        </div>
      </div>

      <p v-if="localError || error" class="text-xs text-red-600 mt-4 text-left">
        {{ localError || error }}
      </p>

      <div class="flex items-center justify-end gap-3 mt-6">
        <button
          @click="$emit('close')"
          :disabled="busy"
          class="px-5 py-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          @click="submit"
          :disabled="busy || !canSubmit"
          class="px-5 py-2 rounded-full bg-[#006A3A] hover:bg-[#005A31] text-white text-sm font-bold transition cursor-pointer disabled:opacity-50"
        >
          {{ busy ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Teacher') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  // When provided the modal is in edit mode.
  teacher: { type: Object, default: null },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['close', 'submit'])

const isEdit = computed(() => !!props.teacher)

const name = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const localError = ref('')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

watch(
  () => props.teacher,
  (t) => {
    name.value = t?.name || ''
    email.value = t?.email || ''
    phone.value = t?.phone || ''
    password.value = ''
    localError.value = ''
  },
  { immediate: true },
)

const canSubmit = computed(() => {
  if (!name.value.trim()) return false
  if (!EMAIL_RE.test(email.value.trim())) return false
  if (!isEdit.value && password.value.trim().length < 6) return false
  return true
})

const submit = () => {
  localError.value = ''
  if (!name.value.trim()) {
    localError.value = 'Name is required.'
    return
  }
  if (!EMAIL_RE.test(email.value.trim())) {
    localError.value = 'A valid email is required.'
    return
  }
  if (!isEdit.value && password.value.trim().length < 6) {
    localError.value = 'Password must be at least 6 characters.'
    return
  }

  const payload = { name: name.value.trim() }
  const emailVal = email.value.trim()
  const phoneVal = phone.value.trim()
  if (!isEdit.value || emailVal !== (props.teacher.email || '')) payload.email = emailVal
  if (!isEdit.value || phoneVal !== (props.teacher.phone || '')) payload.phone = phoneVal || null
  if (password.value.trim()) payload.password = password.value.trim()

  emit('submit', isEdit.value ? { id: props.teacher.id, ...payload } : payload)
}
</script>

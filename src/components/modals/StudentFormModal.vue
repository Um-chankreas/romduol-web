<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    @click.self="!busy && $emit('close')"
  >
    <div class="w-full max-w-md rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-5 text-left">
        {{ isEdit ? 'Edit student' : 'Add student' }}
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

        <p class="text-[11px] text-slate-500 dark:text-slate-400 -mt-1">
          Provide at least one of email or phone — the student signs in with it.
        </p>

        <div>
          <label class="block text-xs font-medium text-slate-800 dark:text-slate-300 mb-1.5">
            Email
          </label>
          <input
            v-model="email"
            type="email"
            placeholder="student@example.com"
            :disabled="busy"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm"
          />
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
          {{ busy ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Student') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  // When provided the modal is in edit mode.
  student: { type: Object, default: null },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['close', 'submit'])

const isEdit = computed(() => !!props.student)

const name = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const localError = ref('')

watch(
  () => props.student,
  (s) => {
    name.value = s?.name || ''
    email.value = s?.email || ''
    phone.value = s?.phone || ''
    password.value = ''
    localError.value = ''
  },
  { immediate: true },
)

const canSubmit = computed(() => {
  if (!name.value.trim()) return false
  if (!email.value.trim() && !phone.value.trim()) return false
  const pw = password.value.trim()
  // Create: password required, >= 6 chars. Edit: optional (blank = keep
  // current), but a non-empty one still has to clear the 6-char minimum —
  // the backend rejects a shorter one either way, so the button shouldn't
  // look submittable when it isn't.
  if (!isEdit.value && pw.length < 6) return false
  if (isEdit.value && pw.length > 0 && pw.length < 6) return false
  return true
})

const submit = () => {
  localError.value = ''
  if (!name.value.trim()) {
    localError.value = 'Name is required.'
    return
  }
  if (!email.value.trim() && !phone.value.trim()) {
    localError.value = 'Enter an email or a phone number.'
    return
  }
  const pwTrimmed = password.value.trim()
  if (!isEdit.value && pwTrimmed.length < 6) {
    localError.value = 'Password must be at least 6 characters.'
    return
  }
  if (isEdit.value && pwTrimmed.length > 0 && pwTrimmed.length < 6) {
    localError.value = 'Password must be at least 6 characters.'
    return
  }

  // On edit, send email/phone only when changed — PATCH treats '' as "clear".
  const payload = { name: name.value.trim() }
  const emailVal = email.value.trim()
  const phoneVal = phone.value.trim()
  if (!isEdit.value || emailVal !== (props.student.email || '')) payload.email = emailVal || null
  if (!isEdit.value || phoneVal !== (props.student.phone || '')) payload.phone = phoneVal || null
  if (pwTrimmed) payload.password = pwTrimmed

  emit('submit', isEdit.value ? { id: props.student.id, ...payload } : payload)
}
</script>

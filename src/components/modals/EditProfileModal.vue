<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    @click.self="!saving && $emit('close')"
  >
    <div class="w-full max-w-md rounded-[28px] bg-[#f8fafd] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 shadow-2xl transition-all text-left">
      <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-5">
        Edit Profile
      </h2>

      <!-- Avatar -->
      <div class="flex items-center gap-4 mb-6">
        <div class="relative shrink-0">
          <div class="w-16 h-16 rounded-full bg-[#034d31] text-white flex items-center justify-center font-bold text-lg overflow-hidden ring-2 ring-emerald-600/20">
            <img v-if="avatarUrl" :src="avatarUrl" alt="Avatar" class="w-full h-full object-cover" />
            <span v-else>{{ initials }}</span>
          </div>
          <div
            v-if="uploadingAvatar"
            class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center"
          >
            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          </div>
        </div>
        <div>
          <button
            type="button"
            @click="avatarInputRef?.click()"
            :disabled="uploadingAvatar || saving"
            class="px-3.5 py-2 rounded-full bg-slate-200/60 hover:bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            {{ uploadingAvatar ? 'Uploading...' : 'Change Photo' }}
          </button>
          <input
            ref="avatarInputRef"
            type="file"
            class="hidden"
            accept="image/jpeg,image/png,image/webp"
            @change="onAvatarPicked"
          />
          <p class="text-[10px] text-slate-400 mt-1.5">JPEG, PNG, or WEBP. Max 5MB.</p>
          <p v-if="avatarError" class="text-[11px] text-red-600 mt-1">{{ avatarError }}</p>
        </div>
      </div>

      <!-- Fields -->
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-1.5">Name</label>
          <input
            v-model="form.name"
            type="text"
            :disabled="saving"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm"
          />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-1.5">Email</label>
          <input
            v-model="form.email"
            type="email"
            :disabled="saving"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm"
          />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-1.5">Phone</label>
          <input
            v-model="form.phone"
            type="tel"
            placeholder="Optional"
            :disabled="saving"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm"
          />
        </div>
      </div>

      <p v-if="error" class="text-xs text-red-600 mt-4">{{ error }}</p>

      <div class="flex items-center justify-end gap-3 mt-6">
        <button
          @click="$emit('close')"
          :disabled="saving"
          class="px-5 py-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          @click="submit"
          :disabled="saving || !form.name.trim()"
          class="px-5 py-2 rounded-full bg-[#034d31] hover:bg-[#023824] text-white text-sm font-bold transition cursor-pointer disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { authService } from '@/services/authService'

const props = defineProps({
  user: { type: Object, default: () => ({}) },
  saving: { type: Boolean, default: false },
  error: { type: String, default: '' }
})

const emit = defineEmits(['close', 'save'])

const form = ref({
  name: props.user?.name || '',
  email: props.user?.email || '',
  phone: props.user?.phone || ''
})

const avatarUrl = ref(props.user?.avatar_url || null)
const avatarInputRef = ref(null)
const uploadingAvatar = ref(false)
const avatarError = ref('')

const initials = computed(() => (form.value.name || 'U').charAt(0).toUpperCase())

// Mirrors the backend's avatarUpload multer config (auth.routes.js):
// image/jpeg, image/png, image/webp only, 5MB max.
const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_MAX_BYTES = 5 * 1024 * 1024

const onAvatarPicked = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  avatarError.value = ''

  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    avatarError.value = 'Only JPEG, PNG, or WEBP images are allowed.'
    if (avatarInputRef.value) avatarInputRef.value.value = ''
    return
  }

  if (file.size > AVATAR_MAX_BYTES) {
    avatarError.value = 'Image must be 5MB or smaller.'
    if (avatarInputRef.value) avatarInputRef.value.value = ''
    return
  }

  uploadingAvatar.value = true
  try {
    const data = await authService.uploadAvatar(file)
    const updatedUser = data?.data?.user
    if (updatedUser?.avatar_url) {
      avatarUrl.value = updatedUser.avatar_url
    }
  } catch (err) {
    avatarError.value = err.response?.data?.error || err.response?.data?.message || 'Failed to upload photo.'
  } finally {
    uploadingAvatar.value = false
    if (avatarInputRef.value) avatarInputRef.value.value = ''
  }
}

const submit = () => {
  if (!form.value.name.trim()) return
  emit('save', {
    name: form.value.name.trim(),
    email: form.value.email.trim(),
    phone: form.value.phone.trim()
  })
}
</script>

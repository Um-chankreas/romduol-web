<template>
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    @click.self="$emit('close')"
  >
    <div class="w-full max-w-xl rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-2xl transition-all">
      <h2 class="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white mb-5 text-left">
        Customize appearance
      </h2>

      <!-- Banner Preview -->
      <div 
        class="relative w-full h-36 rounded-2xl overflow-hidden mb-6 shadow-sm transition-all border border-slate-200 dark:border-slate-800"
        :style="{ backgroundColor: color }"
      >
        <img v-if="coverImage" :src="coverImage" class="w-full h-full object-cover" alt="Header preview" />
      </div>

      <!-- File Picker -->
      <div class="flex items-center justify-between mb-8">
        <span class="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-300">
          Select stream header image
        </span>
        <button 
          @click="coverInputRef?.click()" 
          class="px-4 py-2 rounded-full bg-slate-200/60 hover:bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
        >
          Select photo
        </button>
        <input ref="coverInputRef" type="file" class="hidden" accept="image/*" @change="onImagePicked" />
      </div>

      <!-- Theme Colors -->
      <div class="space-y-3 mb-8 text-left">
        <label class="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-300">Select theme color</label>
        <div class="flex items-center justify-between gap-2 overflow-x-auto py-1">
          <button
            v-for="c in themeColors"
            :key="c.hex"
            @click="color = c.hex"
            :class="[
              'w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center shrink-0 cursor-pointer',
              color === c.hex ? 'border-amber-600 scale-105 shadow-sm' : 'border-slate-300 dark:border-slate-700 hover:scale-105'
            ]"
            :style="{ backgroundColor: c.bgHex || c.hex }"
          >
            <svg v-if="color === c.hex" class="w-5 h-5 text-amber-800 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>

      <p v-if="error" class="text-xs text-red-600 mb-4 text-left">{{ error }}</p>

      <div class="flex items-center justify-end gap-3">
        <button 
          @click="$emit('close')" 
          :disabled="saving"
          class="px-5 py-2 rounded-full text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button 
          @click="saveChanges" 
          :disabled="saving"
          class="px-5 py-2 rounded-full text-slate-500 dark:text-slate-400 text-sm font-semibold transition cursor-pointer disabled:opacity-50 !text-emerald-700 dark:!text-emerald-400 font-bold"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  initialColor: { type: String, default: '#006A3A' },
  initialCover: { type: String, default: null },
  saving: Boolean,
  error: String
})

const emit = defineEmits(['close', 'save'])

const color = ref(props.initialColor)
const coverImage = ref(props.initialCover)
const coverInputRef = ref(null)

const themeColors = [
  { hex: '#80B3FF', bgHex: '#D0E3FF' },
  { hex: '#4CAF50', bgHex: '#C8E6C9' },
  { hex: '#E91E63', bgHex: '#F8BBD0' },
  { hex: '#FF9800', bgHex: '#FFE0B2' },
  { hex: '#00BCD4', bgHex: '#B2EBF2' },
  { hex: '#9C27B0', bgHex: '#E1BEE7' },
  { hex: '#2196F3', bgHex: '#BBDEFB' },
  { hex: '#9E9E9E', bgHex: '#E0E0E0' }
]

watch(() => props.initialColor, (val) => color.value = val)
watch(() => props.initialCover, (val) => coverImage.value = val)

const onImagePicked = (e) => {
  const file = e.target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (ev) => coverImage.value = ev.target.result
    reader.readAsDataURL(file)
  }
}

const saveChanges = () => {
  emit('save', { color: color.value, cover_image: coverImage.value })
}
</script>
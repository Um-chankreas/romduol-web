<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    @click.self="!creating && $emit('close')"
  >
    <div class="w-full max-w-xl rounded-[32px] bg-[#f8fafd] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white mb-5 text-left">
        {{ isEdit ? 'Edit class' : 'Create a class' }}
      </h2>

      <!-- Preview Banner -->
      <div
        class="relative w-full h-24 rounded-2xl overflow-hidden mb-6 shadow-sm transition-all border border-slate-200 dark:border-slate-800 flex items-center px-5"
        :style="{ backgroundColor: color }"
      >
        <span class="text-3xl mr-3 drop-shadow">{{ icon }}</span>
        <span class="text-white font-bold text-lg truncate drop-shadow">
          {{ title || 'Class title' }}
        </span>
      </div>

      <div class="space-y-5 text-left">
        <!-- Title -->
        <div>
          <label class="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-300 mb-1.5">
            Class title <span class="text-red-500">*</span>
          </label>
          <input
            v-model="title"
            type="text"
            placeholder="e.g. Advanced Calculus"
            :disabled="creating"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm"
          />
        </div>

        <!-- Description -->
        <div>
          <label class="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-300 mb-1.5">
            Description
          </label>
          <textarea
            v-model="description"
            rows="2"
            placeholder="What will students learn in this class?"
            :disabled="creating"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm resize-none"
          ></textarea>
        </div>

        <!-- Category -->
        <div>
          <label class="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-300 mb-1.5">
            Category
          </label>
          <input
            v-model="category"
            type="text"
            placeholder="e.g. Mathematics, Grade 10"
            :disabled="creating"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm"
          />
        </div>

        <!-- Access: Free / Paid -->
        <div>
          <label class="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-300 mb-1.5">
            Access
          </label>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="isFree = false"
              :disabled="creating"
              :class="[
                'flex-1 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition cursor-pointer disabled:opacity-50',
                !isFree ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300' : 'border-slate-200 dark:border-slate-700 text-slate-500'
              ]"
            >
              💳 Paid
            </button>
            <button
              type="button"
              @click="isFree = true"
              :disabled="creating"
              :class="[
                'flex-1 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition cursor-pointer disabled:opacity-50',
                isFree ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300' : 'border-slate-200 dark:border-slate-700 text-slate-500'
              ]"
            >
              🎁 Free
            </button>
          </div>
        </div>

        <!-- Icon Picker -->
        <div>
          <label class="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-300 mb-1.5">
            Select icon
          </label>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              v-for="i in iconOptions"
              :key="i"
              type="button"
              @click="icon = i"
              :class="[
                'w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg transition cursor-pointer shrink-0',
                icon === i ? 'border-amber-600 scale-105 bg-amber-50 dark:bg-amber-900/20' : 'border-slate-200 dark:border-slate-700 hover:scale-105'
              ]"
            >
              {{ i }}
            </button>
          </div>
        </div>

        <!-- Theme Colors -->
        <div>
          <label class="block text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-300 mb-1.5">
            Select theme color
          </label>
          <div class="flex items-center gap-2 flex-wrap py-1">
            <button
              v-for="c in themeColors"
              :key="c.hex"
              type="button"
              @click="color = c.hex"
              :class="[
                'w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center shrink-0 cursor-pointer',
                color === c.hex ? 'border-amber-600 scale-105 shadow-sm' : 'border-slate-300 dark:border-slate-700 hover:scale-105'
              ]"
              :style="{ backgroundColor: c.hex }"
            >
              <svg v-if="color === c.hex" class="w-4 h-4 text-white stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <p v-if="error" class="text-xs text-red-600 mt-5 text-left">{{ error }}</p>

      <div class="flex items-center justify-end gap-3 mt-7">
        <button
          @click="$emit('close')"
          :disabled="creating"
          class="px-5 py-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          @click="submit"
          :disabled="creating || !title.trim()"
          class="px-5 py-2 rounded-full bg-[#034d31] hover:bg-[#023824] text-white text-sm font-bold transition cursor-pointer disabled:opacity-50"
        >
          {{ creating ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Class') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  creating: { type: Boolean, default: false },
  error: { type: String, default: '' },
  // When provided, the modal switches to edit mode and prefills these values.
  course: { type: Object, default: null }
})

const emit = defineEmits(['close', 'create', 'save'])

const isEdit = computed(() => !!props.course)

const title = ref('')
const description = ref('')
const category = ref('')
const icon = ref('📚')
const color = ref('#034d31')
const isFree = ref(false)

watch(
  () => props.course,
  (c) => {
    title.value = c?.title || ''
    description.value = c?.description || ''
    category.value = c?.category || ''
    icon.value = c?.icon || '📚'
    color.value = c?.color || '#034d31'
    isFree.value = !!c?.is_free
  },
  { immediate: true }
)

const iconOptions = ['📚', '🧮', '🔬', '🎨', '💻', '🌍', '📐', '✏️', '🎵', '⚗️']

const themeColors = [
  { hex: '#034d31' },
  { hex: '#80B3FF' },
  { hex: '#4CAF50' },
  { hex: '#E91E63' },
  { hex: '#FF9800' },
  { hex: '#00BCD4' },
  { hex: '#9C27B0' },
  { hex: '#2196F3' },
  { hex: '#9E9E9E' }
]

const submit = () => {
  if (!title.value.trim()) return
  const payload = {
    title: title.value.trim(),
    description: description.value.trim(),
    category: category.value.trim(),
    color: color.value,
    icon: icon.value,
    is_free: isFree.value
  }
  if (isEdit.value) {
    emit('save', { id: props.course.id, ...payload })
  } else {
    emit('create', payload)
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    @click.self="!saving && $emit('close')"
  >
    <div class="w-full max-w-xl rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white mb-5 text-left">
        Edit Chapter
      </h2>

      <div class="space-y-4 mb-6 text-left">
        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-2">Lesson Title *</label>
          <input
            v-model="form.title"
            type="text"
            placeholder="e.g., Chapter 1: Introduction"
            :disabled="saving"
            class="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-2">Description</label>
          <textarea
            v-model="form.description"
            rows="3"
            placeholder="Add details about this lesson..."
            :disabled="saving"
            class="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          ></textarea>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-2">Order Number</label>
          <input
            v-model.number="form.orderNumber"
            type="number"
            :disabled="saving"
            class="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          />
        </div>
      </div>

      <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 text-left">
        Edit the chapter's text units from
        <span class="font-semibold text-slate-700 dark:text-slate-300">Open chapter &amp; units → Manage units</span>.
      </p>

      <!-- MEDIA -->
      <div class="space-y-3 mb-6 text-left">
        <!-- Video -->
        <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-bold text-slate-800 dark:text-slate-300">Video (MP4 / MOV / WebM)</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                <template v-if="removeVideo">Will be removed on save</template>
                <template v-else-if="videoFile">New: {{ videoFile.name }}</template>
                <template v-else-if="lesson?.video_url">Current video attached</template>
                <template v-else>None</template>
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                :disabled="saving"
                class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50"
                @click="videoInputRef?.click()"
              >
                {{ (lesson?.video_url && !removeVideo) || videoFile ? 'Replace' : 'Add' }}
              </button>
              <button
                v-if="lesson?.video_url && !removeVideo && !videoFile"
                type="button"
                :disabled="saving"
                class="px-3 py-1.5 rounded-lg text-red-600 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
                @click="removeVideo = true"
              >
                Remove
              </button>
              <button
                v-if="videoFile || removeVideo"
                type="button"
                :disabled="saving"
                class="px-3 py-1.5 rounded-lg text-slate-500 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                @click="videoFile = null; removeVideo = false"
              >
                Undo
              </button>
            </div>
          </div>
          <input
            ref="videoInputRef"
            type="file"
            class="hidden"
            accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-matroska,.mp4,.mov,.webm,.m4v,.mkv"
            @change="pickVideo"
          />
          <div v-if="videoProgress !== null" class="mt-3">
            <div class="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
              <span>Uploading video…</span><span>{{ videoProgress }}%</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div class="h-full bg-emerald-600 transition-all" :style="{ width: videoProgress + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="localError || error" class="p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded-lg text-sm mb-6 text-left">
        {{ localError || error }}
      </div>

      <div class="flex items-center justify-end gap-3">
        <button
          @click="$emit('close')"
          :disabled="saving"
          class="px-5 py-2 rounded-full text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          @click="submit"
          :disabled="saving || !form.title"
          class="px-5 py-2 rounded-full bg-[#006A3A] hover:bg-[#005A31] disabled:bg-gray-400 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-50 active:scale-95"
        >
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { isVideoFile } from '@/services/lessonService'

const props = defineProps({
  lesson: { type: Object, default: null },
  saving: Boolean,
  error: String,
  videoProgress: { type: Number, default: null }
})

const emit = defineEmits(['close', 'save'])

const form = ref({ title: '', description: '', orderNumber: 0 })
const videoFile = ref(null)
const removeVideo = ref(false)
const localError = ref(null)
const videoInputRef = ref(null)

watch(
  () => props.lesson,
  (lesson) => {
    if (lesson) {
      form.value = {
        title: lesson.title || '',
        description: lesson.description || '',
        orderNumber: lesson.order_number ?? 0
      }
      videoFile.value = null
      removeVideo.value = false
      localError.value = null
    }
  },
  { immediate: true }
)

const pickVideo = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  if (!isVideoFile(file)) {
    localError.value = 'Unsupported video type (MP4, MOV, WebM, M4V, MKV).'
    return
  }
  localError.value = null
  videoFile.value = file
  removeVideo.value = false
}

const submit = () => {
  if (!form.value.title) return
  emit('save', {
    title: form.value.title,
    description: form.value.description,
    orderNumber: form.value.orderNumber,
    videoFile: videoFile.value,
    removeVideo: removeVideo.value
  })
}
</script>

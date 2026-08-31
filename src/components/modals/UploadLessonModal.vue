<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    @click.self="!busy && $emit('close')"
  >
    <div class="w-full max-w-xl rounded-[32px] bg-[#f8fafd] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white mb-1 text-left">
        Upload Lesson
      </h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-5 text-left">
        Add a reading (PDF / document) and/or a video. At least one is required.
      </p>

      <!-- PDF / Document slot -->
      <div
        @dragover.prevent="dragTarget = 'doc'"
        @dragleave.prevent="dragTarget = null"
        @drop.prevent="handleDrop('doc', $event)"
        :class="[
          'w-full border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center mb-4 transition cursor-pointer',
          dragTarget === 'doc'
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
        ]"
        @click="docInputRef?.click()"
      >
        <div class="text-2xl mb-1">{{ docFile ? '📄' : '📁' }}</div>
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">
          {{ docFile ? docFile.name : 'Reading — PDF / DOCX / PPTX' }}
        </h3>
        <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
          {{ docFile ? 'Click to change · ' : 'Click to browse · ' }}up to 50MB
        </p>
        <button
          v-if="docFile"
          type="button"
          class="mt-2 text-xs text-red-600 hover:underline"
          @click.stop="docFile = null"
        >
          Remove
        </button>
        <input
          ref="docInputRef"
          type="file"
          class="hidden"
          accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
          @change="handlePick('doc', $event)"
        />
      </div>

      <!-- Video slot -->
      <div
        @dragover.prevent="dragTarget = 'video'"
        @dragleave.prevent="dragTarget = null"
        @drop.prevent="handleDrop('video', $event)"
        :class="[
          'w-full border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center mb-6 transition cursor-pointer',
          dragTarget === 'video'
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
        ]"
        @click="videoInputRef?.click()"
      >
        <div class="text-2xl mb-1">{{ videoFile ? '🎬' : '🎥' }}</div>
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">
          {{ videoFile ? videoFile.name : 'Video — MP4 / MOV / WebM / MKV' }}
        </h3>
        <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
          {{ videoFile ? 'Click to change · ' : 'Click to browse · ' }}uploaded directly, no size limit
        </p>
        <button
          v-if="videoFile"
          type="button"
          class="mt-2 text-xs text-red-600 hover:underline"
          @click.stop="videoFile = null"
        >
          Remove
        </button>
        <input
          ref="videoInputRef"
          type="file"
          class="hidden"
          accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-matroska,.mp4,.mov,.webm,.m4v,.mkv"
          @change="handlePick('video', $event)"
        />
      </div>

      <!-- Form Inputs -->
      <div class="space-y-4 mb-6 text-left">
        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-2">Lesson Title *</label>
          <input
            v-model="form.title"
            type="text"
            placeholder="e.g., Chapter 1: Introduction"
            class="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-2">Description</label>
          <textarea
            v-model="form.description"
            rows="3"
            placeholder="Add details about this lesson..."
            class="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500"
          ></textarea>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-2">Order Number</label>
          <input
            v-model.number="form.orderNumber"
            type="number"
            class="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <!-- Video upload progress -->
      <div v-if="videoProgress !== null" class="mb-4 text-left">
        <div class="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
          <span>Uploading video…</span>
          <span>{{ videoProgress }}%</span>
        </div>
        <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div class="h-full bg-emerald-600 transition-all" :style="{ width: videoProgress + '%' }"></div>
        </div>
      </div>

      <div v-if="localError || error" class="p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded-lg text-sm mb-6 text-left">
        {{ localError || error }}
      </div>

      <div class="flex items-center justify-end gap-3">
        <button
          @click="$emit('close')"
          :disabled="busy"
          class="px-5 py-2 rounded-full text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          @click="submitUpload"
          :disabled="busy || !form.title || (!docFile && !videoFile)"
          class="px-5 py-2 rounded-full bg-[#033B26] hover:bg-[#022819] disabled:bg-gray-400 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-50 active:scale-95"
        >
          {{ busy ? 'Uploading...' : 'Upload Lesson' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { isVideoFile } from '@/services/lessonService'

const props = defineProps({
  uploading: Boolean,
  error: String,
  // null when idle, 0-100 while the video is uploading
  videoProgress: { type: Number, default: null }
})

const emit = defineEmits(['close', 'upload'])

const busy = computed(() => props.uploading)

const form = ref({ title: '', description: '', orderNumber: 0 })
const docFile = ref(null)
const videoFile = ref(null)
const dragTarget = ref(null)
const localError = ref(null)
const docInputRef = ref(null)
const videoInputRef = ref(null)

const assign = (slot, file) => {
  if (!file) return
  localError.value = null
  if (slot === 'video') {
    if (!isVideoFile(file)) {
      localError.value = 'That file is not a supported video (MP4, MOV, WebM, M4V, MKV).'
      return
    }
    videoFile.value = file
  } else {
    if (isVideoFile(file)) {
      localError.value = 'Put video files in the Video slot.'
      return
    }
    docFile.value = file
  }
}

const handlePick = (slot, e) => assign(slot, e.target.files?.[0])
const handleDrop = (slot, e) => {
  dragTarget.value = null
  assign(slot, e.dataTransfer.files?.[0])
}

const submitUpload = () => {
  if (!form.value.title || (!docFile.value && !videoFile.value)) return
  emit('upload', {
    title: form.value.title,
    description: form.value.description,
    orderNumber: form.value.orderNumber,
    file: docFile.value,
    videoFile: videoFile.value
  })
}
</script>

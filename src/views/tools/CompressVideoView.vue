<script setup>
import { ref, onBeforeUnmount } from 'vue'
import Sidebar from '../../components/layout/Sidebar.vue'
import Header from '../../components/layout/Header.vue'
import { videoToolsService } from '@/services/videoToolsService'
import { isSupportedVideoFile } from '@/services/lessonService'

defineOptions({ name: 'CompressVideoView' })

const MAX_BYTES = 3 * 1024 * 1024 * 1024 // matches the server's upload limit

const QUALITY_OPTIONS = [
  { value: 'high', label: 'High quality', hint: 'Smallest size drop — keeps full resolution. Good for lecture slides with fine text.' },
  { value: 'balanced', label: 'Balanced', hint: 'Recommended — caps at 1080p, visually near-identical to the source.' },
  { value: 'small', label: 'Smallest file', hint: 'Caps at 720p — biggest size drop, some softness on fast motion.' },
]

const fileInputRef = ref(null)
const dragging = ref(false)

const file = ref(null)
const previewUrl = ref('')
const quality = ref('balanced')

const busy = ref(false)
const stage = ref('') // 'uploading' | 'processing'
const uploadPct = ref(0)
const error = ref('')
const result = ref(null) // { url, name, originalSize, compressedSize }

const mb = (bytes) => (bytes / 1048576).toFixed(bytes > 104857600 ? 0 : 1)
const reduction = (orig, compressed) => Math.max(0, Math.round((1 - compressed / orig) * 100))

const releasePreview = () => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}
const releaseResult = () => {
  if (result.value) URL.revokeObjectURL(result.value.url)
  result.value = null
}
onBeforeUnmount(() => { releasePreview(); releaseResult() })

const chooseFile = (f) => {
  if (!f) return
  error.value = ''
  if (!isSupportedVideoFile(f)) {
    error.value = `“${f.name}” isn’t a supported video. Use MP4, MOV, WebM, M4V or MKV.`
    return
  }
  if (f.size > MAX_BYTES) {
    error.value = `That file is ${mb(f.size)} MB — the limit is ${mb(MAX_BYTES)} MB.`
    return
  }
  releasePreview()
  releaseResult()
  file.value = f
  previewUrl.value = URL.createObjectURL(f)
}

const onPick = (e) => {
  const f = e.target.files?.[0]
  e.target.value = ''
  chooseFile(f)
}
const onDrop = (e) => {
  dragging.value = false
  chooseFile(e.dataTransfer.files?.[0])
}

const downloadUrl = (url, name) => {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const stem = () => file.value.name.replace(/\.[^.]+$/, '')

const run = async () => {
  if (!file.value || busy.value) return
  busy.value = true
  stage.value = 'uploading'
  uploadPct.value = 0
  error.value = ''
  releaseResult()
  try {
    const { blob, originalSize, compressedSize } = await videoToolsService.compress(file.value, quality.value, {
      onUploadProgress: (e) => {
        if (!e.total) return
        uploadPct.value = Math.round((e.loaded / e.total) * 100)
        if (uploadPct.value >= 100) stage.value = 'processing'
      },
    })
    const name = `${stem()}-compressed.mp4`
    const url = URL.createObjectURL(blob)
    result.value = { url, name, originalSize, compressedSize }
    downloadUrl(url, name)
  } catch (err) {
    error.value = err.message || 'Could not compress that video.'
  } finally {
    busy.value = false
    stage.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header>
        <template #left>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white truncate">Compress Video</h1>
        </template>
      </Header>

      <main class="p-6 sm:p-8 flex-1 w-full space-y-6 max-w-4xl">
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Shrink a video's file size before uploading it to a lesson or unit — useful if it's close to or
          over the upload limit. Re-encoding is lossy, so pick "High quality" if the video has text or
          diagrams that need to stay sharp.
        </p>

        <input ref="fileInputRef" type="file" class="hidden" accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-matroska,.mp4,.mov,.webm,.m4v,.mkv" @change="onPick($event)" />

        <!-- 1. Pick the video -->
        <div
          v-if="!file"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop($event)"
          :class="[
            'w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition cursor-pointer',
            dragging
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
          ]"
          @click="fileInputRef?.click()"
        >
          <div class="text-2xl mb-1">🗜️</div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Click to browse or drop a video</h3>
          <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">MP4, MOV, WebM, M4V or MKV · up to {{ mb(MAX_BYTES) }} MB</p>
        </div>

        <template v-else>
          <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ file.name }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ mb(file.size) }} MB</p>
            </div>
            <button type="button" :disabled="busy" class="shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer" @click="fileInputRef?.click()">
              Change video
            </button>
          </div>

          <video :src="previewUrl" controls preload="metadata" class="w-full max-h-80 rounded-xl bg-black"></video>

          <!-- 2. Quality preset -->
          <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 class="text-sm font-bold text-slate-900 dark:text-white">Quality</h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                v-for="opt in QUALITY_OPTIONS"
                :key="opt.value"
                type="button"
                :disabled="busy"
                @click="quality = opt.value"
                :class="[
                  'text-left rounded-xl border-2 p-3.5 transition disabled:opacity-60 cursor-pointer',
                  quality === opt.value
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                ]"
              >
                <p class="text-xs font-bold text-slate-900 dark:text-white">{{ opt.label }}</p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{{ opt.hint }}</p>
              </button>
            </div>
          </section>

          <!-- 3. Run -->
          <div class="flex items-center gap-4">
            <button
              type="button"
              :disabled="busy"
              @click="run"
              class="px-5 py-2.5 rounded-xl bg-[#006A3A] hover:bg-[#005A31] text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer active:scale-95"
            >
              {{ busy ? 'Working…' : 'Compress & download' }}
            </button>
            <p v-if="stage === 'uploading'" class="text-xs text-slate-500 dark:text-slate-400">Uploading… {{ uploadPct }}%</p>
            <p v-else-if="stage === 'processing'" class="text-xs text-slate-500 dark:text-slate-400">Compressing… this can take a few minutes for long videos.</p>
          </div>

          <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>

          <!-- 4. Result -->
          <div v-if="result" class="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3.5 space-y-2">
            <p class="text-sm font-bold text-emerald-800 dark:text-emerald-300">
              Done — {{ mb(result.originalSize) }} MB → {{ mb(result.compressedSize) }} MB
              ({{ reduction(result.originalSize, result.compressedSize) }}% smaller)
            </p>
            <button type="button" class="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer" @click="downloadUrl(result.url, result.name)">
              Download again
            </button>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

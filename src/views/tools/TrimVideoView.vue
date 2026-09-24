<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import Sidebar from '../../components/layout/Sidebar.vue'
import Header from '../../components/layout/Header.vue'
import { videoToolsService } from '@/services/videoToolsService'
import { isSupportedVideoFile } from '@/services/lessonService'

defineOptions({ name: 'TrimVideoView' })

const MAX_BYTES = 3 * 1024 * 1024 * 1024 // matches the server's upload limit
const MAX_CLIPS = 20

const fileInputRef = ref(null)
const videoRef = ref(null)
const dragging = ref(false)

const file = ref(null)
const previewUrl = ref('')
const durationMin = ref(null) // source length in minutes, once the browser reads it

let nextId = 1
const newRow = (start = '0', end = '') => ({ id: nextId++, start: String(start), end: String(end) })
const rows = ref([newRow()])

const busy = ref(false)
const stage = ref('') // 'uploading' | 'processing'
const uploadPct = ref(0)
const error = ref('')
const result = ref(null) // { url, name, size } of the last download, for "Download again"

// ── formatting ───────────────────────────────────────────────────────────────
const clock = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) * 60))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
const mb = (bytes) => (bytes / 1048576).toFixed(bytes > 104857600 ? 0 : 1)

// ── validation ───────────────────────────────────────────────────────────────
const rowError = (r) => {
  if (r.start === '' || r.end === '') return 'Enter a start and an end.'
  const s = Number(r.start)
  const e = Number(r.end)
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 'Use numbers (minutes).'
  if (s < 0) return 'Start can’t be negative.'
  if (e <= s) return 'End must be after the start.'
  if (durationMin.value != null && e > durationMin.value + 0.01) {
    return `The video is only ${clock(durationMin.value)} long.`
  }
  return ''
}
const allValid = computed(() => rows.value.length > 0 && rows.value.every((r) => !rowError(r)))
const canRun = computed(() => !!file.value && allValid.value && !busy.value)

// ── file handling ────────────────────────────────────────────────────────────
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
  durationMin.value = null
  rows.value = [newRow()]
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

// Once the browser has read the length, fill the first clip with "the whole
// video" so the common case (just trim the tail) is a single edit.
const onMetadata = () => {
  const d = videoRef.value?.duration
  if (!Number.isFinite(d)) return
  durationMin.value = d / 60
  const first = rows.value[0]
  if (rows.value.length === 1 && first && first.end === '') first.end = (d / 60).toFixed(2)
}

// ── clips ────────────────────────────────────────────────────────────────────
const addClip = () => {
  if (rows.value.length >= MAX_CLIPS) return
  const last = rows.value[rows.value.length - 1]
  const start = last && Number.isFinite(Number(last.end)) && last.end !== '' ? last.end : '0'
  const end = durationMin.value != null ? durationMin.value.toFixed(2) : ''
  rows.value.push(newRow(start, end))
}
const removeClip = (id) => {
  rows.value = rows.value.filter((r) => r.id !== id)
}
const useCurrentTime = (row, which) => {
  const t = videoRef.value?.currentTime
  if (!Number.isFinite(t)) return
  row[which] = (t / 60).toFixed(2)
}
const clipLength = (r) => (rowError(r) ? '' : clock(Number(r.end) - Number(r.start)))

// ── run ──────────────────────────────────────────────────────────────────────
const downloadUrl = (url, name) => {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const stem = () => file.value.name.replace(/\.[^.]+$/, '')
const extOf = () => (file.value.name.match(/\.[^.]+$/)?.[0] || '.mp4').toLowerCase()
const minLabel = (v) => String(Number(Number(v).toFixed(2)))

const run = async () => {
  if (!canRun.value) return
  busy.value = true
  stage.value = 'uploading'
  uploadPct.value = 0
  error.value = ''
  releaseResult()
  try {
    const segments = rows.value.map((r) => ({ start: Number(r.start) * 60, end: Number(r.end) * 60 }))
    const { blob, isZip } = await videoToolsService.trim(file.value, segments, {
      onUploadProgress: (e) => {
        if (!e.total) return
        uploadPct.value = Math.round((e.loaded / e.total) * 100)
        if (uploadPct.value >= 100) stage.value = 'processing'
      },
    })
    const name = isZip
      ? `${stem()}_clips.zip`
      : `${stem()}_${minLabel(rows.value[0].start)}-${minLabel(rows.value[0].end)}min${extOf()}`
    const url = URL.createObjectURL(blob)
    result.value = { url, name, size: blob.size, clips: rows.value.length }
    downloadUrl(url, name)
  } catch (err) {
    error.value = err.message || 'Could not process that video.'
  } finally {
    busy.value = false
    stage.value = ''
  }
}

const inputCls =
  'w-24 px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm tabular-nums focus:outline-none focus:border-emerald-500 disabled:opacity-60'
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header>
        <template #left>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white truncate">Trim Video</h1>
        </template>
      </Header>

      <main class="p-6 sm:p-8 flex-1 w-full space-y-6 max-w-4xl">
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Cut a video down, or split it into several clips by minutes — for example 0–15 and 16–34.
          The cut is lossless (no re-encoding), so it’s fast and keeps the original quality.
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
          <div class="text-2xl mb-1">🎬</div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Click to browse or drop a video</h3>
          <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">MP4, MOV, WebM, M4V or MKV · up to {{ mb(MAX_BYTES) }} MB</p>
        </div>

        <template v-else>
          <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ file.name }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ mb(file.size) }} MB<template v-if="durationMin != null"> · {{ clock(durationMin) }} long</template>
              </p>
            </div>
            <button type="button" :disabled="busy" class="shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer" @click="fileInputRef?.click()">
              Change video
            </button>
          </div>

          <video
            ref="videoRef"
            :src="previewUrl"
            controls
            preload="metadata"
            class="w-full max-h-80 rounded-xl bg-black"
            @loadedmetadata="onMetadata"
          ></video>

          <!-- 2. The clips -->
          <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-sm font-bold text-slate-900 dark:text-white">Clips <span class="text-slate-400 font-medium">(minutes)</span></h2>
              <button
                type="button"
                :disabled="busy || rows.length >= MAX_CLIPS"
                class="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer"
                @click="addClip"
              >+ Add clip</button>
            </div>

            <div v-for="(r, i) in rows" :key="r.id" class="space-y-1">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span class="w-12 text-xs font-bold text-slate-500 dark:text-slate-400">Clip {{ i + 1 }}</span>

                <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  Start
                  <input v-model="r.start" type="number" min="0" step="0.01" inputmode="decimal" :disabled="busy" :class="inputCls" />
                  <button type="button" :disabled="busy" title="Use the player’s current time" class="text-slate-400 hover:text-emerald-600 disabled:opacity-50 cursor-pointer" @click="useCurrentTime(r, 'start')">⌖</button>
                </label>

                <label class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  End
                  <input v-model="r.end" type="number" min="0" step="0.01" inputmode="decimal" :disabled="busy" :class="inputCls" />
                  <button type="button" :disabled="busy" title="Use the player’s current time" class="text-slate-400 hover:text-emerald-600 disabled:opacity-50 cursor-pointer" @click="useCurrentTime(r, 'end')">⌖</button>
                </label>

                <span v-if="clipLength(r)" class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">= {{ clipLength(r) }}</span>

                <button
                  v-if="rows.length > 1"
                  type="button"
                  :disabled="busy"
                  class="ml-auto text-slate-400 hover:text-red-600 disabled:opacity-50 cursor-pointer"
                  aria-label="Remove clip"
                  @click="removeClip(r.id)"
                >✕</button>
              </div>
              <p v-if="rowError(r) && (r.start !== '' || r.end !== '')" class="pl-[3.75rem] text-[11px] text-red-600">{{ rowError(r) }}</p>
            </div>

            <p class="text-[11px] text-slate-500 dark:text-slate-400">
              Tip: play the video, pause where you want a cut, and click ⌖ to copy that time into Start or End.
              To keep speed and quality, cuts snap to the nearest keyframe, so a clip can start or end a few seconds off.
            </p>
          </section>

          <!-- 3. Go -->
          <div class="space-y-3">
            <button
              type="button"
              :disabled="!canRun"
              class="px-5 py-2.5 rounded-xl bg-[#006A3A] hover:bg-[#005A31] text-white text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              @click="run"
            >
              {{ busy ? 'Working…' : rows.length > 1 ? `Split into ${rows.length} clips & download` : 'Trim & download' }}
            </button>

            <div v-if="busy" class="space-y-1.5 max-w-md">
              <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  :class="['h-full bg-emerald-600 transition-all', stage === 'processing' ? 'animate-pulse' : '']"
                  :style="{ width: (stage === 'processing' ? 100 : uploadPct) + '%' }"
                ></div>
              </div>
              <p class="text-xs text-slate-600 dark:text-slate-400">
                {{ stage === 'processing' ? 'Cutting your clips…' : `Uploading… ${uploadPct}%` }}
              </p>
            </div>

            <p v-if="result" class="text-xs text-emerald-700 dark:text-emerald-400">
              ✓ Downloaded <strong>{{ result.name }}</strong> ({{ mb(result.size) }} MB).
              <button type="button" class="font-bold underline cursor-pointer" @click="downloadUrl(result.url, result.name)">Download again</button>
            </p>
          </div>
        </template>

        <p v-if="error" class="text-sm text-red-600" role="alert">{{ error }}</p>
      </main>
    </div>
  </div>
</template>

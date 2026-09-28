<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Clapperboard, Minimize2, Scissors, Check, Upload, Crosshair, X, Plus, ArrowRight, ArrowUp, ArrowDown, Combine, Film } from 'lucide-vue-next'
import Sidebar from '../../components/layout/Sidebar.vue'
import Header from '../../components/layout/Header.vue'
import SaveFileActions from '../../components/tools/SaveFileActions.vue'
import { videoToolsService } from '@/services/videoToolsService'
import { permissionsService } from '@/services/permissionsService'
import { isSupportedVideoFile } from '@/services/lessonService'

defineOptions({ name: 'VideoEditorView' })

// One page for the server-side video tools: upload → (merge) → compress → trim.
// Picking several files adds a merge step that joins them into one video
// first; everything after works on that single file. The trim step runs on
// the compressed file (when compression wasn't skipped), so its upload is
// smaller and the clips come out already shrunk. Each step is still gated by
// its own feature permission (compress_video / trim_video); merge rides on
// trim_video, same as the server's /merge route.

const MAX_BYTES = 8 * 1024 * 1024 * 1024 // matches the server's upload limit (videoTools.routes.js)
const MAX_CLIPS = 20
const MAX_MERGE_FILES = 10 // matches the server

const QUALITY_OPTIONS = [
  { value: 'high', label: 'High quality', hint: 'Keeps full resolution. Best for slides with fine text.' },
  { value: 'balanced', label: 'Balanced', hint: 'Recommended — caps at 1080p, near-identical to the source.' },
  { value: 'small', label: 'Smallest file', hint: 'Caps at 720p — biggest size drop, some softness on motion.' },
]

const permissions = ref({})
const canCompress = computed(() => !!permissions.value.compress_video)
const canTrim = computed(() => !!permissions.value.trim_video)
onMounted(async () => { permissions.value = await permissionsService.getPermissions() })

const fileInputRef = ref(null)
const videoRef = ref(null)
const dragging = ref(false)

const parts = ref([]) // files picked for merging, in order: [{ id, file }]
const original = ref(null) // the single source video (picked, or the merge result)
const working = ref(null) // what the trim step uses: the compressed file, or the original if skipped
const previewUrl = ref('') // object URL for `working`
const durationMin = ref(null)
const step = ref('upload') // 'upload' | 'merge' | 'compress' | 'trim'
const merged = ref(false) // whether `original` came from the merge step
const mode = ref('single') // upload choice: 'single' (edit one video) | 'merge' (join several)

const quality = ref('balanced')
const compressed = ref(null) // { url, name, originalSize, compressedSize }

let nextId = 1
const newRow = (start = '0:00', end = '') => ({ id: nextId++, start: String(start), end: String(end) })
const rows = ref([newRow()])
const trimmed = ref(null) // { url, name, size }

const busy = ref(false)
const stage = ref('') // 'uploading' | 'processing' | 'downloading'
const uploadPct = ref(0)
const processPct = ref(null) // server-side % (compress only); null = unknown, show a pulsing bar
const downloadPct = ref(0)
let processStartedAt = 0

// "about 6 min left", from how fast the percentage has moved so far.
const timeLeft = computed(() => {
  const pct = processPct.value
  if (pct == null || pct < 3 || !processStartedAt) return ''
  const elapsed = (Date.now() - processStartedAt) / 1000
  const left = (elapsed / pct) * (100 - pct)
  if (left < 60) return 'less than a minute left'
  return `about ${Math.round(left / 60)} min left`
})
const barWidth = computed(() => {
  if (stage.value === 'downloading') return downloadPct.value
  if (stage.value === 'processing') return processPct.value ?? 100
  return uploadPct.value
})
const error = ref('')

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
const reduction = (orig, comp) => Math.max(0, Math.round((1 - comp / orig) * 100))
const stem = () => original.value.name.replace(/\.[^.]+$/, '')
const extOf = (f) => (f.name.match(/\.[^.]+$/)?.[0] || '.mp4').toLowerCase()
// "30:15" → "30m15s", "1:05:30" → "1h05m30s" — ':' isn't allowed in filenames.
const fileTime = (v) => {
  const [a, b, c] = secClock(toSec(v)).split(':')
  return c !== undefined ? `${a}h${b}m${c}s` : `${a}m${b}s`
}

// ── steps ────────────────────────────────────────────────────────────────────
const steps = computed(() => [
  { key: 'upload', label: 'Upload', icon: Upload, show: true },
  { key: 'merge', label: 'Merge', icon: Combine, show: mode.value === 'merge' },
  // Merging is its own job — its result is just downloaded, not edited further.
  { key: 'compress', label: 'Compress', icon: Minimize2, show: canCompress.value && mode.value !== 'merge' },
  { key: 'trim', label: 'Trim', icon: Scissors, show: canTrim.value && mode.value !== 'merge' },
].filter(s => s.show))
// 'done' (after a merge) sits past the last step, so every step shows as done.
const stepIndex = (key) => (key === 'done' ? steps.value.length : steps.value.findIndex(s => s.key === key))
const isDone = (key) => stepIndex(key) < stepIndex(step.value)

// ── object URLs ──────────────────────────────────────────────────────────────
const setPreview = (f) => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = f ? URL.createObjectURL(f) : ''
  durationMin.value = null
}
const releaseCompressed = () => {
  if (compressed.value) URL.revokeObjectURL(compressed.value.url)
  compressed.value = null
}
const releaseTrimmed = () => {
  if (trimmed.value) URL.revokeObjectURL(trimmed.value.url)
  trimmed.value = null
}
onBeforeUnmount(() => { setPreview(null); releaseCompressed(); releaseTrimmed() })

// ── upload ───────────────────────────────────────────────────────────────────
const fileProblem = (f) => {
  if (!isSupportedVideoFile(f)) return `“${f.name}” isn’t a supported video. Use MP4, MOV, WebM, M4V or MKV.`
  if (f.size > MAX_BYTES) return `“${f.name}” is ${mb(f.size)} MB — the limit is ${mb(MAX_BYTES)} MB.`
  return ''
}

const useSingle = (f) => {
  original.value = f
  working.value = f
  rows.value = [newRow()]
  setPreview(f)
  step.value = canCompress.value ? 'compress' : 'trim'
}

// "Edit a video" takes one file straight to compress/trim. "Merge videos"
// collects files into the merge list (appending on "Add more"), even one at
// a time, until there are enough to merge.
let nextPartId = 1
const chooseFiles = (list) => {
  const files = Array.from(list || [])
  if (!files.length) return
  error.value = ''
  const problem = files.map(fileProblem).find(Boolean)
  if (problem) { error.value = problem; return }
  if (mode.value !== 'merge') {
    releaseCompressed()
    releaseTrimmed()
    merged.value = false
    useSingle(files[0])
    return
  }
  const all = [...parts.value.map(p => p.file), ...files]
  if (all.length > MAX_MERGE_FILES) {
    error.value = `You can merge up to ${MAX_MERGE_FILES} videos at a time.`
    return
  }
  parts.value = all.map(file => ({ id: nextPartId++, file }))
  step.value = 'merge'
}
const setMode = (m) => {
  mode.value = m
  error.value = ''
}
const onPick = (e) => {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  chooseFiles(files)
}
const onDrop = (e) => {
  dragging.value = false
  chooseFiles(e.dataTransfer.files)
}
const startOver = () => {
  if (busy.value) return
  parts.value = []
  merged.value = false
  original.value = null
  working.value = null
  setPreview(null)
  releaseCompressed()
  releaseTrimmed()
  error.value = ''
  step.value = 'upload'
}

// Once the browser has read the length, fill the first clip with "the whole
// video" so the common case (just trim the tail) is a single edit.
const onMetadata = () => {
  const d = videoRef.value?.duration
  if (!Number.isFinite(d)) return
  durationMin.value = d / 60
  const first = rows.value[0]
  if (rows.value.length === 1 && first && first.end === '') first.end = secClock(Math.floor(d))
}

// ── shared request runner ────────────────────────────────────────────────────
// Results aren't auto-downloaded: the user picks where to save each one with
// <SaveFileActions> (a folder picker needs a fresh click, which a download
// fired after a long server job wouldn't have).
const withProgress = async (fn, fallbackMsg) => {
  busy.value = true
  stage.value = 'uploading'
  uploadPct.value = 0
  processPct.value = null
  processStartedAt = 0
  downloadPct.value = 0
  error.value = ''
  try {
    await fn({
      onUploadProgress: (e) => {
        if (!e.total) return
        uploadPct.value = Math.round((e.loaded / e.total) * 100)
        if (uploadPct.value >= 100) stage.value = 'processing'
      },
      // Only compress reports these (it runs as a polled server job).
      onProcessProgress: (pct) => {
        stage.value = 'processing'
        if (!processStartedAt) processStartedAt = Date.now()
        processPct.value = pct
      },
      onDownloadProgress: (e) => {
        stage.value = 'downloading'
        if (e.total) downloadPct.value = Math.round((e.loaded / e.total) * 100)
      },
    })
  } catch (err) {
    // axios says just "Network Error" when the connection drops mid-upload —
    // typically the server rejecting an oversized file or restarting.
    error.value = err.message === 'Network Error'
      ? 'Lost the connection to the server. Check that it’s running (and was restarted after updates), then try again.'
      : err.message || fallbackMsg
  } finally {
    busy.value = false
    stage.value = ''
  }
}

// ── step: merge ──────────────────────────────────────────────────────────────
const movePart = (i, dir) => {
  const j = i + dir
  if (j < 0 || j >= parts.value.length) return
  const next = [...parts.value]
  ;[next[i], next[j]] = [next[j], next[i]]
  parts.value = next
}
const removePart = (id) => {
  parts.value = parts.value.filter(p => p.id !== id)
  if (!parts.value.length) step.value = 'upload'
}
const partsTotal = computed(() => parts.value.reduce((n, p) => n + p.file.size, 0))

const runMerge = () => withProgress(async (opts) => {
  const blob = await videoToolsService.merge(parts.value.map(p => p.file), opts)
  const firstStem = parts.value[0].file.name.replace(/\.[^.]+$/, '')
  const name = `${firstStem}-merged.mp4`
  merged.value = true
  original.value = new File([blob], name, { type: 'video/mp4' })
  working.value = original.value
  setPreview(original.value)
  step.value = 'done'
}, 'Could not merge those videos.')

// ── step 2: compress ─────────────────────────────────────────────────────────
const runCompress = () => withProgress(async (opts) => {
  releaseCompressed()
  const { blob, originalSize, compressedSize } = await videoToolsService.compress(original.value, quality.value, opts)
  const name = `${stem()}-compressed.mp4`
  compressed.value = { url: URL.createObjectURL(blob), name, originalSize, compressedSize }
  working.value = new File([blob], name, { type: 'video/mp4' })
  setPreview(working.value)
  rows.value = [newRow()]
  if (canTrim.value) step.value = 'trim'
}, 'Could not compress that video.')

const skipCompress = () => {
  releaseCompressed()
  if (working.value !== original.value) {
    working.value = original.value
    setPreview(original.value)
    rows.value = [newRow()]
  }
  step.value = 'trim'
}

// ── step 3: trim ─────────────────────────────────────────────────────────────
// Start/End are typed as a clock: "30:15" (m:ss) or "1:05:30" (h:mm:ss). A
// bare number still means minutes ("30" = 30:00, "2.5" = 2:30) so the old
// habit keeps working. Returns seconds, or NaN if it can't be read.
const toSec = (str) => {
  const v = String(str).trim()
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v) * 60
  const m = v.match(/^(?:(\d+):)?(\d+):(\d{1,2}(?:\.\d+)?)$/)
  if (!m) return NaN
  const [, h, min, s] = m
  if (Number(s) >= 60 || (h !== undefined && Number(min) >= 60)) return NaN
  return Number(h || 0) * 3600 + Number(min) * 60 + Number(s)
}
const secClock = (sec) => clock(sec / 60)

const rowError = (r) => {
  if (r.start === '' || r.end === '') return 'Enter a start and an end.'
  const s = toSec(r.start)
  const e = toSec(r.end)
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 'Use a time like 5:30 or 1:05:30.'
  if (e <= s) return 'End must be after the start.'
  if (durationMin.value != null && e > durationMin.value * 60 + 1) {
    return `The video is only ${clock(durationMin.value)} long.`
  }
  return ''
}
const allValid = computed(() => rows.value.length > 0 && rows.value.every((r) => !rowError(r)))
const canTrimRun = computed(() => !!working.value && allValid.value && !busy.value)

const addClip = () => {
  if (rows.value.length >= MAX_CLIPS) return
  const last = rows.value[rows.value.length - 1]
  const start = last && Number.isFinite(toSec(last.end)) ? last.end : '0:00'
  const end = durationMin.value != null ? secClock(Math.floor(durationMin.value * 60)) : ''
  rows.value.push(newRow(start, end))
}
const removeClip = (id) => { rows.value = rows.value.filter((r) => r.id !== id) }
const useCurrentTime = (row, which) => {
  const t = videoRef.value?.currentTime
  if (!Number.isFinite(t)) return
  row[which] = secClock(Math.floor(t))
}
const clipLength = (r) => (rowError(r) ? '' : secClock(toSec(r.end) - toSec(r.start)))

const runTrim = () => {
  if (!canTrimRun.value) return
  return withProgress(async (opts) => {
    releaseTrimmed()
    const segments = rows.value.map((r) => ({ start: toSec(r.start), end: toSec(r.end) }))
    const { blob, isZip } = await videoToolsService.trim(working.value, segments, opts)
    const suffix = compressed.value ? '-compressed' : ''
    const name = isZip
      ? `${stem()}${suffix}_clips.zip`
      : `${stem()}${suffix}_${fileTime(rows.value[0].start)}-${fileTime(rows.value[0].end)}${extOf(working.value)}`
    trimmed.value = { url: URL.createObjectURL(blob), name, size: blob.size }
  }, 'Could not trim that video.')
}

const cardCls = 'rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'
const primaryBtn = 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#006A3A] hover:bg-[#005A31] text-white text-sm font-bold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95'
const secondaryBtn = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer'
const inputCls = 'w-24 px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm tabular-nums focus:outline-none focus:border-emerald-500 disabled:opacity-60'
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header>
        <template #left>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white truncate">Video Editor</h1>
        </template>
      </Header>

      <main class="p-4 sm:p-8 flex-1 w-full max-w-4xl space-y-6">
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Upload a video, shrink it, then cut it into clips — all in one place.
        </p>

        <!-- Stepper -->
        <ol class="flex items-center gap-2 sm:gap-3">
          <template v-for="(s, i) in steps" :key="s.key">
            <li class="flex items-center gap-2 min-w-0">
              <span
                :class="[
                  'w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  isDone(s.key)
                    ? 'bg-[#006A3A] text-white'
                    : step === s.key
                      ? 'bg-emerald-50 text-[#006A3A] ring-2 ring-[#006A3A] dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
                ]"
              >
                <Check v-if="isDone(s.key)" class="w-4 h-4" />
                <component :is="s.icon" v-else class="w-4 h-4" />
              </span>
              <span
                :class="[
                  'text-sm font-semibold truncate',
                  step === s.key ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500',
                ]"
              >{{ s.label }}</span>
            </li>
            <li
              v-if="i < steps.length - 1"
              aria-hidden="true"
              :class="['flex-1 h-px min-w-4', isDone(s.key) ? 'bg-[#006A3A]' : 'bg-slate-200 dark:bg-slate-800']"
            />
          </template>
        </ol>

        <input ref="fileInputRef" type="file" :multiple="mode === 'merge'" class="hidden" accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-matroska,.mp4,.mov,.webm,.m4v,.mkv" @change="onPick($event)" />

        <!-- Edit one video vs. merge several (merge rides on trim_video) -->
        <div v-if="step === 'upload' && canTrim" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            v-for="opt in [
              { value: 'single', icon: Clapperboard, label: 'Edit a video', hint: 'Compress and trim one video.' },
              { value: 'merge', icon: Combine, label: 'Merge videos', hint: 'Join 2 or more videos into one, then edit.' },
            ]"
            :key="opt.value"
            type="button"
            @click="setMode(opt.value)"
            :class="[
              'flex items-start gap-3 text-left rounded-xl border-2 p-4 transition cursor-pointer',
              mode === opt.value
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600',
            ]"
          >
            <span
              :class="[
                'w-9 h-9 shrink-0 rounded-lg flex items-center justify-center',
                mode === opt.value ? 'bg-[#006A3A] text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
              ]"
            ><component :is="opt.icon" class="w-4 h-4" /></span>
            <span>
              <span class="block text-sm font-bold text-slate-900 dark:text-white">{{ opt.label }}</span>
              <span class="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ opt.hint }}</span>
            </span>
          </button>
        </div>

        <!-- 1. Upload -->
        <div
          v-if="step === 'upload'"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop($event)"
          @click="fileInputRef?.click()"
          :class="[
            'w-full border-2 border-dashed rounded-2xl px-6 py-14 flex flex-col items-center justify-center text-center transition cursor-pointer',
            dragging
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-700',
          ]"
        >
          <div class="w-12 h-12 mb-3 rounded-xl flex items-center justify-center bg-emerald-50 text-[#006A3A] dark:bg-emerald-500/10 dark:text-emerald-400">
            <Combine v-if="mode === 'merge'" class="w-6 h-6" />
            <Clapperboard v-else class="w-6 h-6" />
          </div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            {{ mode === 'merge' ? 'Click to browse or drop the videos to merge' : 'Click to browse or drop a video' }}
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            MP4, MOV, WebM, M4V or MKV · up to {{ mb(MAX_BYTES) }} MB{{ mode === 'merge' ? ` each · up to ${MAX_MERGE_FILES} videos` : '' }}
          </p>
        </div>

        <!-- Merge -->
        <section v-else-if="step === 'merge'" :class="[cardCls, 'p-5 space-y-4']">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-sm font-bold text-slate-900 dark:text-white">Merge videos</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                They’re joined top to bottom. Use the arrows to change the order.
              </p>
            </div>
            <button type="button" :disabled="busy" class="shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer" @click="startOver">
              Start over
            </button>
          </div>

          <ol class="space-y-2">
            <li
              v-for="(p, i) in parts"
              :key="p.id"
              class="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5"
            >
              <span class="w-6 h-6 shrink-0 rounded-full bg-white dark:bg-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-300 flex items-center justify-center">{{ i + 1 }}</span>
              <Film class="w-4 h-4 shrink-0 text-slate-400" />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ p.file.name }}</p>
                <p class="text-xs text-slate-400">{{ mb(p.file.size) }} MB</p>
              </div>
              <div class="flex items-center gap-0.5 shrink-0">
                <button type="button" :disabled="busy || i === 0" aria-label="Move up" class="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white dark:hover:bg-slate-700 dark:hover:text-white disabled:opacity-30 cursor-pointer" @click="movePart(i, -1)"><ArrowUp class="w-4 h-4" /></button>
                <button type="button" :disabled="busy || i === parts.length - 1" aria-label="Move down" class="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white dark:hover:bg-slate-700 dark:hover:text-white disabled:opacity-30 cursor-pointer" @click="movePart(i, 1)"><ArrowDown class="w-4 h-4" /></button>
                <button type="button" :disabled="busy" aria-label="Remove" class="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer" @click="removePart(p.id)"><X class="w-4 h-4" /></button>
              </div>
            </li>
          </ol>

          <button
            type="button"
            :disabled="busy || parts.length >= MAX_MERGE_FILES"
            class="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer"
            @click="fileInputRef?.click()"
          ><Plus class="w-3.5 h-3.5" /> Add more videos</button>

          <p class="text-[11px] text-slate-500 dark:text-slate-400">
            Parts of the same recording join in seconds with no quality loss. Videos with different sizes or
            formats are re-encoded to match the first one, which takes longer.
          </p>

          <div class="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" :disabled="busy || parts.length < 2" :class="primaryBtn" @click="runMerge">
              <Combine class="w-4 h-4" />
              {{ busy ? 'Merging…' : parts.length < 2 ? 'Merge videos' : `Merge ${parts.length} videos` }}
            </button>
            <span v-if="parts.length < 2" class="text-xs text-amber-600 dark:text-amber-400">Add at least one more video to merge.</span>
            <span v-else class="text-xs text-slate-400">{{ mb(partsTotal) }} MB total</span>
          </div>

          <div v-if="busy" class="space-y-1.5 max-w-md">
            <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                :class="['h-full bg-emerald-600 transition-all', stage === 'processing' ? 'animate-pulse' : '']"
                :style="{ width: (stage === 'processing' ? 100 : uploadPct) + '%' }"
              ></div>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-400">
              {{ stage === 'processing' ? 'Joining your videos…' : `Uploading… ${uploadPct}%` }}
            </p>
          </div>
        </section>

        <template v-else>
          <!-- File bar + preview -->
          <div :class="[cardCls, 'overflow-hidden']">
            <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ working?.name }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ mb(working.size) }} MB<template v-if="durationMin != null"> · {{ clock(durationMin) }} long</template>
                  <template v-if="compressed">
                    · <span class="text-emerald-700 dark:text-emerald-400 font-semibold">{{ reduction(compressed.originalSize, compressed.compressedSize) }}% smaller than original</span>
                  </template>
                </p>
              </div>
              <button type="button" :disabled="busy" class="shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer" @click="startOver">
                Start over
              </button>
            </div>
            <video
              ref="videoRef"
              :key="previewUrl"
              :src="previewUrl"
              controls
              preload="metadata"
              class="w-full max-h-96 bg-black"
              @loadedmetadata="onMetadata"
            ></video>
          </div>

          <!-- 2. Compress -->
          <section v-if="step === 'compress'" :class="[cardCls, 'p-5 space-y-4']">
            <div>
              <h2 class="text-sm font-bold text-slate-900 dark:text-white">Compress</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Re-encodes to a smaller file. Pick “High quality” if the video has text that must stay sharp.
              </p>
            </div>
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
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                ]"
              >
                <p class="text-xs font-bold text-slate-900 dark:text-white">{{ opt.label }}</p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{{ opt.hint }}</p>
              </button>
            </div>
            <div class="flex flex-wrap items-center gap-3 pt-1">
              <button type="button" :disabled="busy" :class="primaryBtn" @click="runCompress">
                <Minimize2 class="w-4 h-4" />
                {{ busy ? 'Compressing…' : canTrim ? 'Compress & continue' : 'Compress' }}
              </button>
              <button v-if="canTrim" type="button" :disabled="busy" :class="secondaryBtn" @click="skipCompress">
                Skip to trim <ArrowRight class="w-4 h-4" />
              </button>
            </div>
          </section>

          <div
            v-if="step === 'done'"
            class="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3.5"
          >
            <Check class="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <span class="flex-1 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Done — {{ parts.length }} videos merged into one ({{ mb(original.size) }} MB).
            </span>
            <SaveFileActions :key="previewUrl" :url="previewUrl" :name="original.name" />
            <button
              type="button"
              class="text-xs font-bold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
              @click="startOver"
            >Merge more videos</button>
          </div>

          <!-- Compressed result (shown once compression ran) -->
          <div
            v-if="compressed"
            class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3"
          >
            <p class="text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Check class="w-4 h-4" />
              Compressed {{ mb(compressed.originalSize) }} MB → {{ mb(compressed.compressedSize) }} MB
            </p>
            <div class="flex items-center gap-3">
              <button
                v-if="step === 'trim' && canCompress"
                type="button"
                :disabled="busy"
                class="text-xs font-bold text-slate-600 dark:text-slate-300 hover:underline disabled:opacity-50 cursor-pointer"
                @click="step = 'compress'"
              >Change quality</button>
              <SaveFileActions :key="compressed.url" :url="compressed.url" :name="compressed.name" />
            </div>
          </div>

          <!-- 3. Trim -->
          <section v-if="step === 'trim'" :class="[cardCls, 'p-5 space-y-4']">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-sm font-bold text-slate-900 dark:text-white">Trim <span class="text-slate-400 font-medium">(m:ss or h:mm:ss)</span></h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cut one clip, or split into several — e.g. 0:00–15:30 and 15:30–34:00. Lossless, so it’s fast.
                </p>
              </div>
              <button
                v-if="!compressed && canCompress"
                type="button"
                :disabled="busy"
                class="shrink-0 text-xs font-bold text-slate-600 dark:text-slate-300 hover:underline disabled:opacity-50 cursor-pointer"
                @click="step = 'compress'"
              >Back to compress</button>
            </div>

            <div class="space-y-2">
              <div
                v-for="(r, i) in rows"
                :key="r.id"
                class="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5"
              >
                <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span class="w-12 text-xs font-bold text-slate-500 dark:text-slate-400">Clip {{ i + 1 }}</span>
                  <label v-for="which in ['start', 'end']" :key="which" class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 capitalize">
                    {{ which }}
                    <input v-model.trim="r[which]" type="text" :placeholder="which === 'start' ? '0:00' : '30:15'" inputmode="numeric" autocomplete="off" spellcheck="false" :disabled="busy" :class="inputCls" />
                    <button
                      type="button"
                      :disabled="busy"
                      title="Use the player’s current time"
                      :aria-label="`Set ${which} to the player’s current time`"
                      class="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
                      @click="useCurrentTime(r, which)"
                    ><Crosshair class="w-3.5 h-3.5" /></button>
                  </label>
                  <span v-if="clipLength(r)" class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">= {{ clipLength(r) }}</span>
                  <button
                    v-if="rows.length > 1"
                    type="button"
                    :disabled="busy"
                    class="ml-auto p-1 rounded-md text-slate-400 hover:text-red-600 disabled:opacity-50 cursor-pointer"
                    aria-label="Remove clip"
                    @click="removeClip(r.id)"
                  ><X class="w-4 h-4" /></button>
                </div>
                <p v-if="rowError(r) && (r.start !== '' || r.end !== '')" class="pl-16 mt-1 text-[11px] text-red-600">{{ rowError(r) }}</p>
              </div>
            </div>

            <button
              type="button"
              :disabled="busy || rows.length >= MAX_CLIPS"
              class="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer"
              @click="addClip"
            ><Plus class="w-3.5 h-3.5" /> Add clip</button>

            <p class="text-[11px] text-slate-500 dark:text-slate-400">
              Tip: pause the player where you want a cut and click the target icon to copy that time.
              Cuts snap to the nearest keyframe, so a clip can start or end a few seconds off.
            </p>

            <div class="pt-1">
              <button type="button" :disabled="!canTrimRun" :class="primaryBtn" @click="runTrim">
                <Scissors class="w-4 h-4" />
                {{ busy ? 'Working…' : rows.length > 1 ? `Split into ${rows.length} clips` : 'Trim' }}
              </button>
            </div>

            <div
              v-if="trimmed"
              class="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3"
            >
              <p class="flex-1 min-w-0 text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Check class="w-4 h-4 shrink-0" />
                <span class="truncate">Ready: {{ trimmed.name }} ({{ mb(trimmed.size) }} MB)</span>
              </p>
              <SaveFileActions :key="trimmed.url" :url="trimmed.url" :name="trimmed.name" />
            </div>
          </section>

          <!-- Progress -->
          <div v-if="busy" class="space-y-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5">
            <div class="flex items-baseline justify-between gap-3 text-xs">
              <span class="font-semibold text-slate-700 dark:text-slate-200">
                <template v-if="stage === 'uploading'">Step 1 of {{ step === 'compress' ? 3 : 2 }} · Uploading</template>
                <template v-else-if="stage === 'processing'">
                  Step 2 of {{ step === 'compress' ? 3 : 2 }} · {{ step === 'compress' ? 'Compressing' : 'Cutting your clips' }}
                </template>
                <template v-else>Step 3 of 3 · Fetching the result</template>
              </span>
              <span class="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                <template v-if="stage === 'processing' && processPct == null">Working…</template>
                <template v-else>{{ barWidth }}%</template>
              </span>
            </div>
            <div class="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                :class="['h-full bg-emerald-600 transition-all duration-500', stage === 'processing' && processPct == null ? 'animate-pulse' : '']"
                :style="{ width: barWidth + '%' }"
              ></div>
            </div>
            <p v-if="stage === 'processing' && step === 'compress'" class="text-[11px] text-slate-500 dark:text-slate-400">
              {{ timeLeft || 'Estimating time left…' }} · you can keep this tab open in the background.
            </p>
          </div>
        </template>

        <p v-if="error" class="text-sm text-red-600 dark:text-red-400" role="alert">{{ error }}</p>
      </main>
    </div>
  </div>
</template>

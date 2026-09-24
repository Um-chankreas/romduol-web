<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { unitService } from '@/services/unitService'
import { isSupportedVideoFile } from '@/services/lessonService'
import { isLatexDocument, latexToMarkdown, renderPendingFigures } from '@/utils/latexToMarkdown'
import MarkdownContent from '@/components/ui/MarkdownContent.vue'

const props = defineProps({
  lessonId: { type: String, required: true },
  // null → creating a new unit; an existing unit object → editing it.
  unit: { type: Object, default: null },
})
const emit = defineEmits(['saved', 'cancel'])

const busy = ref(false)
const error = ref(null)
const showPreview = ref(false)

const form = ref({ title: '', content: '', is_free: false })
const resetFromUnit = () => {
  form.value = props.unit
    ? { title: props.unit.title, content: props.unit.content || '', is_free: !!props.unit.is_free }
    : { title: '', content: '', is_free: false }
  showPreview.value = false
  error.value = null
}
watch(() => props.unit?.id, resetFromUnit, { immediate: true })

// ── Unit video ────────────────────────────────────────────────────────────
// A single optional video for this unit (separate from the chapter's own
// intro video). Needs the unit to already exist — a brand-new, unsaved unit
// has nowhere to attach the video to yet.
const unitVideo = ref({ url: null, duration: null })
watch(() => props.unit, (u) => {
  unitVideo.value = { url: u?.video_url || null, duration: u?.duration_seconds || null }
}, { immediate: true })

const videoFileRef = ref(null)
const videoDragging = ref(false)
const videoUploading = ref(false)
const videoProgress = ref(0)
const videoError = ref('')

const pickVideo = () => videoFileRef.value?.click()

const uploadVideo = async (file) => {
  videoError.value = null
  if (!isSupportedVideoFile(file)) {
    videoError.value = 'Unsupported video type. Use MP4, MOV, WebM, M4V or MKV.'
    return
  }
  videoUploading.value = true
  videoProgress.value = 0
  try {
    const res = await unitService.uploadUnitVideo(props.unit.id, file, {
      onProgress: (p) => { videoProgress.value = p }
    })
    const updated = res?.data?.unit
    unitVideo.value = { url: updated?.video_url || null, duration: updated?.duration_seconds || null }
  } catch (err) {
    videoError.value = err.response?.data?.error || err.message || 'Failed to upload video'
  } finally {
    videoUploading.value = false
  }
}

const handleVideoFile = (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) uploadVideo(file)
}
const handleVideoDrop = (e) => {
  videoDragging.value = false
  const file = e.dataTransfer.files?.[0]
  if (file) uploadVideo(file)
}

const removingVideo = ref(false)
const removeVideo = async () => {
  if (!confirm('Remove this unit\'s video?')) return
  removingVideo.value = true
  videoError.value = null
  try {
    await unitService.removeUnitVideo(props.unit.id)
    unitVideo.value = { url: null, duration: null }
  } catch (err) {
    videoError.value = err.response?.data?.error || err.message || 'Failed to remove video'
  } finally {
    removingVideo.value = false
  }
}

// Auto-grow the content textarea to fit whatever's typed or pasted in —
// capped (see the CSS max-height) so a huge document scrolls instead of
// pushing the page endlessly tall. Watching form.content (not @input) means
// this also fires for programmatic changes: LaTeX conversion, figure/image
// insertion, and loading a different unit into the form.
const contentRef = ref(null)
const autoGrowContent = () => {
  const el = contentRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
watch(() => form.value.content, () => nextTick(autoGrowContent), { immediate: true })

// ── LaTeX → Markdown ──────────────────────────────────────────────────────
// A whole `\documentclass … \end{document}` paste is converted to the
// Markdown the LMS stores. Fires on blur, or from the "Upload .tex" button.
// Any TikZ figure it finds is then auto-rendered to a real diagram (below).
const texNote = ref('')
const renderingFigures = ref(0) // >0 while a TikZ figure is being rendered

const convertField = async (obj, key) => {
  if (!isLatexDocument(obj[key])) return
  const { markdown, warnings } = latexToMarkdown(obj[key])
  obj[key] = markdown
  texNote.value = warnings.length
    ? `Converted from LaTeX — ${warnings.join(' ')}`
    : 'Converted from LaTeX to Markdown.'
  showPreview.value = true
  setTimeout(() => { texNote.value = '' }, 8000)
  await renderFigures(obj, key)
}

// Turns every `figure-tikz` placeholder convertField() just produced into a
// real rendered diagram (node-tikzjax, server-side — see units.routes.js).
// A figure it can't render falls back to the manual "Upload image" slot.
const renderFigures = async (obj, key) => {
  if (!/```figure-tikz\b/.test(obj[key])) return
  renderingFigures.value++
  try {
    const { markdown, rendered, failed } = await renderPendingFigures(
      obj[key],
      (source) => unitService.renderTikzFigure(source).then((r) => r.data.dataUrl),
    )
    obj[key] = markdown
    if (failed) {
      texNote.value = rendered
        ? `${rendered} diagram(s) rendered. ${failed} couldn't be auto-rendered — upload an image for ${failed === 1 ? 'it' : 'them'} below.`
        : `Couldn't auto-render ${failed === 1 ? 'this diagram' : 'these diagrams'} — upload an image below.`
    } else if (rendered) {
      texNote.value = `${rendered} diagram${rendered > 1 ? 's' : ''} rendered automatically.`
    }
    if (texNote.value) setTimeout(() => { texNote.value = '' }, 8000)
  } finally {
    renderingFigures.value--
  }
}

// ── Upload a .tex file ────────────────────────────────────────────────────
const texFileRef = ref(null)
const pickTex = () => texFileRef.value?.click()

const handleTexFile = async (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    const text = await file.text()
    form.value.content = text
    if (isLatexDocument(text)) {
      await convertField(form.value, 'content')
    } else {
      texNote.value = 'Loaded — this file was not a LaTeX document, inserted as-is.'
      showPreview.value = true
      setTimeout(() => { texNote.value = '' }, 8000)
    }
  } catch {
    error.value = 'Could not read that file.'
  }
}

// ── Figure placeholders → uploaded images ────────────────────────────────
// A `\includegraphics`, or a TikZ figure that couldn't be auto-rendered,
// leaves a ```figure … ``` block (never ```figure-tikz — that's a pending
// render, listed separately while renderingFigures > 0).
const FIGURE_RE = /```figure\n([\s\S]*?)\n```/g
const figuresIn = (text) => {
  const out = []
  const re = new RegExp(FIGURE_RE.source, 'g')
  let m
  while ((m = re.exec(text || '')) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, caption: (m[1].split('\n')[0] || '').trim() })
  }
  return out
}
const formFigures = computed(() => figuresIn(form.value.content))

const figFileRef = ref(null)
const figIndex = ref(-1)
const figureBusy = ref(-1)
const pickFigure = (index) => { figIndex.value = index; figFileRef.value?.click() }

const handleFigureFile = async (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  const index = figIndex.value
  figIndex.value = -1
  if (!file || index < 0) return
  figureBusy.value = index
  error.value = null
  try {
    const res = await unitService.uploadFigureImage(props.lessonId, file)
    const url = res.data?.url
    if (!url) throw new Error('No URL returned by the server.')
    const fig = figuresIn(form.value.content)[index]
    if (!fig) throw new Error('That placeholder is no longer there — check the content.')
    const alt = (fig.caption || 'Figure').replace(/[[\]]/g, '').split('—')[0].trim() || 'Figure'
    form.value.content = form.value.content.slice(0, fig.start) + `![${alt}](${url})` + form.value.content.slice(fig.end)
    showPreview.value = true
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to upload image'
  } finally {
    figureBusy.value = -1
  }
}

const save = async () => {
  if (!form.value.title.trim()) return
  busy.value = true
  error.value = null
  try {
    const payload = {
      title: form.value.title.trim(),
      content: form.value.content,
      is_free: form.value.is_free,
    }
    const res = props.unit
      ? await unitService.updateUnit(props.unit.id, payload)
      : await unitService.createUnit({ lesson_id: props.lessonId, ...payload })
    emit('saved', res?.data?.unit || null)
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to save unit'
  } finally {
    busy.value = false
  }
}

const inputCls =
  'w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500'
</script>

<template>
  <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
    <input ref="texFileRef" type="file" class="hidden" accept=".md,text/markdown,.tex,text/x-tex,application/x-tex" @change="handleTexFile($event)" />
    <input ref="figFileRef" type="file" class="hidden" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg" @change="handleFigureFile($event)" />

    <div class="flex items-center justify-between gap-3">
      <p class="text-xs font-bold uppercase tracking-wide text-slate-500">
        {{ unit ? 'Edit unit' : 'Add unit' }}
      </p>
      <div class="flex items-center gap-3">
        <button type="button" class="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline" @click="pickTex">⬆ Upload .md / .tex</button>
        <button type="button" class="text-xs text-slate-500 hover:underline" @click="emit('cancel')">Cancel</button>
      </div>
    </div>

    <p v-if="error" class="text-xs text-red-600">{{ error }}</p>

    <input v-model="form.title" type="text" placeholder="Unit title" :class="inputCls" />

    <textarea
      ref="contentRef"
      v-model="form.content"
      rows="10"
      placeholder="Markdown content, or paste / “Upload .tex” a LaTeX document (converted automatically). History → plain prose. Maths → $x^2$ inline or $$…$$ display."
      :class="[inputCls, 'font-mono text-xs resize-none overflow-y-auto max-h-[70vh]']"
      @blur="convertField(form, 'content')"
    ></textarea>
    <p v-if="isLatexDocument(form.content)" class="text-[11px] text-amber-700 dark:text-amber-300">
      Looks like LaTeX —
      <button type="button" class="font-semibold hover:underline" @click="convertField(form, 'content')">convert to Markdown</button>
    </p>
    <p v-if="texNote" class="text-[11px] text-amber-700 dark:text-amber-300">{{ texNote }}</p>
    <p v-if="renderingFigures > 0" class="text-[11px] text-emerald-700 dark:text-emerald-400">Rendering diagram(s)…</p>

    <!-- Figure placeholders left by the .tex import -->
    <div v-if="formFigures.length" class="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/15 p-3 space-y-2">
      <p class="text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
        {{ formFigures.length }} figure placeholder{{ formFigures.length > 1 ? 's' : '' }} — upload an image for each
      </p>
      <div v-for="(fig, idx) in formFigures" :key="idx" class="flex items-center justify-between gap-3">
        <span class="text-xs text-slate-700 dark:text-slate-300 truncate">📊 {{ fig.caption || ('Figure ' + (idx + 1)) }}</span>
        <button
          type="button"
          :disabled="figureBusy === idx"
          class="shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50"
          @click="pickFigure(idx)"
        >{{ figureBusy === idx ? 'Uploading…' : 'Upload image' }}</button>
      </div>
    </div>

    <!-- Unit video (separate from the chapter's own intro video) -->
    <div>
      <p class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-2">Unit video</p>

      <p v-if="!unit" class="text-xs text-slate-500 dark:text-slate-400">
        Save the unit first, then you can add a video.
      </p>

      <template v-else>
        <input ref="videoFileRef" type="file" class="hidden" accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-matroska,.mp4,.mov,.webm,.m4v,.mkv" @change="handleVideoFile($event)" />

        <div v-if="unitVideo.url" class="space-y-2">
          <video :src="unitVideo.url" controls class="w-full max-h-72 rounded-lg bg-black"></video>
          <div class="flex items-center justify-between">
            <button type="button" class="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline" @click="pickVideo">Replace video</button>
            <button type="button" :disabled="removingVideo" class="text-xs font-bold text-red-600 hover:underline disabled:opacity-50" @click="removeVideo">
              {{ removingVideo ? 'Removing…' : 'Remove video' }}
            </button>
          </div>
        </div>

        <div
          v-else
          @dragover.prevent="videoDragging = true"
          @dragleave.prevent="videoDragging = false"
          @drop.prevent="handleVideoDrop($event)"
          :class="[
            'w-full border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center transition cursor-pointer',
            videoDragging ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
          ]"
          @click="pickVideo"
        >
          <div class="text-xl mb-1">🎥</div>
          <p class="text-xs font-bold text-slate-900 dark:text-white">Click to browse or drop a video</p>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">MP4, MOV, WebM, M4V or MKV</p>
        </div>

        <div v-if="videoUploading" class="mt-2 space-y-1">
          <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div class="h-full bg-emerald-600 transition-all" :style="{ width: videoProgress + '%' }"></div>
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">Uploading… {{ videoProgress }}%</p>
        </div>
        <p v-if="videoError" class="text-xs text-red-600 mt-1">{{ videoError }}</p>
      </template>
    </div>

    <div class="flex items-center justify-between">
      <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
        <input v-model="form.is_free" type="checkbox" class="rounded" />
        Free preview (readable without enrolling)
      </label>
      <button type="button" class="text-xs text-emerald-700 dark:text-emerald-400 hover:underline" @click="showPreview = !showPreview">
        {{ showPreview ? 'Hide preview' : 'Preview' }}
      </button>
    </div>

    <div v-if="showPreview" class="rounded-lg border border-dashed border-emerald-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 max-h-96 overflow-y-auto">
      <MarkdownContent :source="form.content" />
    </div>

    <div class="flex justify-end">
      <button
        type="button"
        :disabled="busy || !form.title.trim() || renderingFigures > 0"
        class="px-4 py-1.5 rounded-lg bg-[#006A3A] hover:bg-[#005A31] text-white text-xs font-bold disabled:opacity-50"
        @click="save"
      >
        {{ busy ? 'Saving…' : unit ? 'Save changes' : 'Add unit' }}
      </button>
    </div>
  </div>
</template>

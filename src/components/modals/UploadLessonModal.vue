<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    @click.self="!busy && $emit('close')"
  >
    <div class="w-full max-w-xl rounded-[32px] bg-[#f8fafd] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white mb-1 text-left">
        New Chapter
      </h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-5 text-left">
        Give the chapter a title, add its text units (Markdown), and optionally an
        intro video. Only the title is required.
      </p>

      <!-- Form Inputs -->
      <div class="space-y-4 mb-5 text-left">
        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-2">Chapter Title *</label>
          <input
            v-model="form.title"
            type="text"
            placeholder="e.g. ជំពូកទី១៖ អាណានិគមបារាំង (១៨៦៣-១៩៥៣)"
            class="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300 mb-2">Description</label>
          <textarea
            v-model="form.description"
            rows="2"
            placeholder="Add details about this chapter..."
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

      <!-- Chapter content (Markdown / LaTeX → units) -->
      <div class="mb-5 text-left">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-xs font-bold text-slate-800 dark:text-slate-300">
            Chapter content — Markdown or LaTeX
          </label>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
              @click="texInputRef?.click()"
            >Import .tex</button>
            <button
              v-if="markdown.trim()"
              type="button"
              class="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
              @click="showPreview = !showPreview"
            >{{ showPreview ? 'Hide preview' : 'Preview' }}</button>
          </div>
        </div>
        <input
          ref="texInputRef"
          type="file"
          class="hidden"
          accept=".tex,text/x-tex,application/x-tex"
          @change="handleTexFile($event)"
        />
        <div
          v-if="looksLikeLatex"
          class="mb-2 flex items-center justify-between gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2"
        >
          <span class="text-[11px] text-amber-800 dark:text-amber-200">This looks like LaTeX — convert it to Markdown?</span>
          <button
            type="button"
            class="text-xs font-semibold text-amber-800 dark:text-amber-200 hover:underline shrink-0"
            @click="convertLatex(markdown)"
          >Convert</button>
        </div>
        <textarea
          v-model="markdown"
          rows="7"
          placeholder="## Unit 1: …&#10;&#10;Prose, **bold**, lists. Maths: $x^2$ inline or $$…$$ display.&#10;&#10;## Unit 2: …&#10;&#10;— or paste a whole LaTeX document / “Import .tex”."
          class="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
        ></textarea>
        <p v-if="texWarnings.length" class="text-[11px] text-amber-700 dark:text-amber-300 mt-1.5">
          Converted from LaTeX — check the preview.
          <span v-for="(w, i) in texWarnings" :key="i" class="block">• {{ w }}</span>
        </p>
        <p v-if="renderingFigures > 0" class="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1.5">Rendering diagram(s)…</p>
        <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
          Split into units on every <code>## </code> heading. A leading
          <code># </code> title and <code>---</code> rules are ignored. With no
          <code>## </code> the whole thing becomes one unit named after the
          chapter. Leave empty to add units later.
        </p>
        <div
          v-if="showPreview"
          class="mt-2 rounded-lg border border-dashed border-emerald-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 max-h-64 overflow-y-auto"
        >
          <MarkdownContent :source="markdown" />
        </div>
      </div>

      <!-- Video slot (optional) -->
      <div
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="handleDrop($event)"
        :class="[
          'w-full border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center mb-5 transition cursor-pointer',
          dragging
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
        ]"
        @click="videoInputRef?.click()"
      >
        <div class="text-2xl mb-1">{{ videoFile ? '🎬' : '🎥' }}</div>
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">
          {{ videoFile ? videoFile.name : 'Intro video — optional (MP4 / MOV / WebM / MKV)' }}
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
          @change="handlePick($event)"
        />
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
          :disabled="busy || !form.title || renderingFigures > 0"
          class="px-5 py-2 rounded-full bg-[#033B26] hover:bg-[#022819] disabled:bg-gray-400 text-white text-sm font-semibold transition cursor-pointer disabled:opacity-50 active:scale-95"
        >
          {{ busy ? 'Saving...' : 'Create chapter' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { isVideoFile } from '@/services/lessonService'
import { unitService } from '@/services/unitService'
import { isLatexDocument, latexToMarkdown, renderPendingFigures } from '@/utils/latexToMarkdown'
import MarkdownContent from '@/components/ui/MarkdownContent.vue'

const props = defineProps({
  uploading: Boolean,
  error: String,
  // null when idle, 0-100 while the video is uploading
  videoProgress: { type: Number, default: null }
})

const emit = defineEmits(['close', 'upload'])

const busy = computed(() => props.uploading)

const form = ref({ title: '', description: '', orderNumber: 0 })
const markdown = ref('')
const showPreview = ref(false)
const videoFile = ref(null)
const dragging = ref(false)
const localError = ref(null)
const videoInputRef = ref(null)
const texInputRef = ref(null)
const texWarnings = ref([])

const looksLikeLatex = computed(() => isLatexDocument(markdown.value))
const renderingFigures = ref(0) // >0 while a TikZ figure is being rendered

const convertLatex = async (raw) => {
  const { markdown: md, warnings } = latexToMarkdown(raw)
  markdown.value = md
  texWarnings.value = warnings
  showPreview.value = true

  // Auto-render any TikZ figure to a real diagram (node-tikzjax, server-side).
  // One that fails falls back to a "```figure" placeholder — there's no
  // upload UI in this modal, so it just stays as a note in the Markdown; the
  // teacher can fill it in later from the chapter's unit editor.
  if (/```figure-tikz\b/.test(markdown.value)) {
    renderingFigures.value++
    try {
      const { markdown: rendered, failed } = await renderPendingFigures(
        markdown.value,
        (source) => unitService.renderTikzFigure(source).then((r) => r.data.dataUrl),
      )
      markdown.value = rendered
      if (failed) texWarnings.value = [...texWarnings.value, `${failed} figure(s) couldn't be auto-rendered — add ${failed === 1 ? 'it' : 'them'} from the unit editor after creating the chapter.`]
    } finally {
      renderingFigures.value--
    }
  }
}

const handleTexFile = async (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    const text = await file.text()
    if (isLatexDocument(text)) await convertLatex(text)
    else { markdown.value = text; texWarnings.value = [] }
  } catch {
    localError.value = 'Could not read that file.'
  }
}

const assignVideo = (file) => {
  if (!file) return
  if (!isVideoFile(file)) {
    localError.value = 'That file is not a supported video (MP4, MOV, WebM, M4V, MKV).'
    return
  }
  localError.value = null
  videoFile.value = file
}

const handlePick = (e) => assignVideo(e.target.files?.[0])
const handleDrop = (e) => {
  dragging.value = false
  assignVideo(e.dataTransfer.files?.[0])
}

const submitUpload = () => {
  if (!form.value.title) return
  let md = markdown.value.trim()
  // Units are split on `## ` — if the content has none (e.g. a converted
  // single-topic .tex), wrap it as one unit named after the chapter.
  if (md && !/^##\s/m.test(md)) {
    md = `## ${form.value.title}\n\n${md}`
  }
  emit('upload', {
    title: form.value.title,
    description: form.value.description,
    orderNumber: form.value.orderNumber,
    videoFile: videoFile.value,
    markdown: md || null
  })
}
</script>

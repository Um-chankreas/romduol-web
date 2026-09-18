<script setup>
import { ref, computed } from 'vue'
import Sidebar from '../../components/layout/Sidebar.vue'
import Header from '../../components/layout/Header.vue'
import MarkdownContent from '../../components/ui/MarkdownContent.vue'
import { isLatexDocument, latexToMarkdown, renderPendingFigures } from '@/utils/latexToMarkdown'
import { unitService } from '@/services/unitService'

defineOptions({ name: 'LatexConverterView' })

const fileInputRef = ref(null)
const fileName = ref('')
const dragging = ref(false)
const busy = ref(false)
const error = ref('')
const warnings = ref([])
const converted = ref('')
const showRaw = ref(false)

const hasResult = computed(() => converted.value.trim().length > 0)

const convert = async (raw) => {
  busy.value = true
  error.value = ''
  warnings.value = []
  try {
    if (isLatexDocument(raw)) {
      const { markdown, warnings: w } = latexToMarkdown(raw)
      let out = markdown
      if (/```figure-tikz\b/.test(out)) {
        const { markdown: rendered, failed } = await renderPendingFigures(
          out,
          (source) => unitService.renderTikzFigure(source).then((r) => r.data.dataUrl),
        )
        out = rendered
        if (failed) w.push(`${failed} figure(s) couldn't be auto-rendered.`)
      }
      converted.value = out
      warnings.value = w
    } else {
      // Not LaTeX — pass the text through as-is.
      converted.value = raw
    }
  } catch {
    error.value = 'Could not convert that file.'
  } finally {
    busy.value = false
  }
}

const handleFile = async (file) => {
  if (!file) return
  error.value = ''
  fileName.value = file.name
  try {
    const text = await file.text()
    await convert(text)
  } catch {
    error.value = 'Could not read that file.'
  }
}

const onPick = (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  handleFile(file)
}
const onDrop = (e) => {
  dragging.value = false
  handleFile(e.dataTransfer.files?.[0])
}

const copyResult = async () => {
  try {
    await navigator.clipboard.writeText(converted.value)
  } catch {
    error.value = 'Could not copy to clipboard.'
  }
}

const downloadResult = () => {
  const blob = new Blob([converted.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const base = fileName.value.replace(/\.[^.]+$/, '') || 'converted'
  a.href = url
  a.download = `${base}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

const reset = () => {
  fileName.value = ''
  converted.value = ''
  warnings.value = []
  error.value = ''
  showRaw.value = false
}
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header>
        <template #left>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white truncate">LaTeX to Text</h1>
        </template>
      </Header>

      <main class="p-6 sm:p-8 flex-1 w-full space-y-6 max-w-4xl">
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Upload a LaTeX file (.txt or .tex) and convert it into normal, readable text.
        </p>

        <!-- Upload zone -->
        <div
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
          <div class="text-2xl mb-1">📄</div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            {{ fileName || 'Click to browse or drop a .txt / .tex file' }}
          </h3>
          <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
            {{ fileName ? 'Click to choose a different file' : 'The LaTeX source will be converted automatically' }}
          </p>
          <input
            ref="fileInputRef"
            type="file"
            class="hidden"
            accept=".txt,.tex,text/plain,text/x-tex,application/x-tex"
            @change="onPick($event)"
          />
        </div>

        <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
        <p v-if="busy" class="text-xs text-emerald-700 dark:text-emerald-400">Converting…</p>

        <p v-if="warnings.length" class="text-[11px] text-amber-700 dark:text-amber-300">
          <span v-for="(w, i) in warnings" :key="i" class="block">• {{ w }}</span>
        </p>

        <!-- Result -->
        <div v-if="hasResult" class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-900 dark:text-white">Converted text</h2>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                @click="showRaw = !showRaw"
              >{{ showRaw ? 'Show preview' : 'Show plain text' }}</button>
              <button type="button" class="text-xs text-emerald-700 dark:text-emerald-400 hover:underline" @click="copyResult">Copy</button>
              <button type="button" class="text-xs text-emerald-700 dark:text-emerald-400 hover:underline" @click="downloadResult">Download .txt</button>
              <button type="button" class="text-xs text-red-600 hover:underline" @click="reset">Clear</button>
            </div>
          </div>

          <div
            v-if="!showRaw"
            class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 max-h-[70vh] overflow-y-auto"
          >
            <MarkdownContent :source="converted" />
          </div>
          <textarea
            v-else
            :value="converted"
            readonly
            rows="18"
            class="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-none"
          ></textarea>
        </div>
      </main>
    </div>
  </div>
</template>

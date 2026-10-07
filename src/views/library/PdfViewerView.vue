<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ZoomIn, ZoomOut, ChevronUp, ChevronDown, Loader2, AlertCircle } from 'lucide-vue-next'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { libraryService } from '@/services/libraryService'
import { useLanguage } from '@/composables/useLanguage'

defineOptions({ name: 'PdfViewerView' })
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const { t } = useLanguage()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref('')
const title = ref('')
const numPages = ref(0)
const current = ref(1)
const zoom = ref(1)
const scroller = ref(null)
const pageEls = ref([])

let pdf = null
let baseScale = 1            // fits page 1 to the reading column
let renderVersion = 0        // bumps on zoom so stale renders are dropped
const rendered = new Map()   // page -> version it was drawn at
let observer = null
let pageObserver = null

const listers = {
  textbook: () => libraryService.listTextbooks(),
  'past-paper': () => libraryService.listPastPapers(),
  formula: () => libraryService.listFormulas(),
}

const sizeFor = (n) => pageSizes.value[n] || pageSizes.value[1] || { w: 600, h: 800 }
const pageSizes = ref({})
const pageStyle = (n) => {
  const s = sizeFor(n)
  const sc = baseScale * zoom.value
  return { width: `${s.w * sc}px`, height: `${s.h * sc}px` }
}

const renderPage = async (n) => {
  if (!pdf || rendered.get(n) === renderVersion) return
  const version = renderVersion
  rendered.set(n, version)
  const page = await pdf.getPage(n)
  const sc = baseScale * zoom.value
  const dpr = window.devicePixelRatio || 1
  const viewport = page.getViewport({ scale: sc * dpr })
  const wrap = pageEls.value[n - 1]
  if (!wrap || version !== renderVersion) return
  let canvas = wrap.querySelector('canvas')
  if (!canvas) { canvas = document.createElement('canvas'); wrap.appendChild(canvas) }
  canvas.width = viewport.width
  canvas.height = viewport.height
  canvas.style.width = `${viewport.width / dpr}px`
  canvas.style.height = `${viewport.height / dpr}px`
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
}

const observe = () => {
  observer?.disconnect()
  pageObserver?.disconnect()
  // Draw pages shortly before they scroll into view.
  observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) renderPage(Number(e.target.dataset.page)) })
  }, { root: scroller.value, rootMargin: '800px 0px' })
  // The page that fills the most of the screen is "current".
  pageObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) current.value = Number(e.target.dataset.page) })
  }, { root: scroller.value, threshold: 0.5 })
  pageEls.value.forEach((el) => { if (el) { observer.observe(el); pageObserver.observe(el) } })
}

const setZoom = async (z) => {
  const keep = current.value
  zoom.value = Math.min(2.5, Math.max(0.5, Math.round(z * 100) / 100))
  renderVersion++
  rendered.clear()
  pageEls.value.forEach((el) => el?.querySelector('canvas')?.remove())
  await nextTick()
  observe()
  goTo(keep)
}

const goTo = (n) => {
  const page = Math.min(numPages.value, Math.max(1, n))
  pageEls.value[page - 1]?.scrollIntoView({ block: 'start' })
}

const onKey = (e) => {
  if (e.key === 'ArrowRight' || e.key === 'PageDown') goTo(current.value + 1)
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(current.value - 1)
}
// The reader is view-only: no right-click save and no print shortcut.
const block = (e) => e.preventDefault()
const onKeyBlock = (e) => {
  if ((e.ctrlKey || e.metaKey) && ['s', 'p'].includes(e.key.toLowerCase())) e.preventDefault()
}

const back = () => (window.history.length > 1 ? router.back() : router.push('/library'))

onMounted(async () => {
  try {
    const list = await listers[route.params.kind]?.()
    const book = (list || []).find((b) => String(b.id) === String(route.params.id))
    if (!book?.file_url) throw new Error('not found')
    title.value = book.title

    pdf = await pdfjsLib.getDocument({ url: book.file_url, disableAutoFetch: true }).promise
    const first = await pdf.getPage(1)
    const vp = first.getViewport({ scale: 1 })
    const avail = Math.min((scroller.value?.clientWidth || 900) - 32, 960)
    baseScale = avail / vp.width
    pageSizes.value = { 1: { w: vp.width, h: vp.height } }
    numPages.value = pdf.numPages
    loading.value = false
    await nextTick()
    observe()
  } catch (e) {
    console.error('PDF viewer:', e)
    error.value = 'This book could not be opened. Please go back and try again.'
    loading.value = false
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('keydown', onKeyBlock)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  pageObserver?.disconnect()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keydown', onKeyBlock)
  pdf?.destroy()
})

const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`)
</script>

<template>
  <div class="h-screen flex flex-col bg-slate-100 dark:bg-slate-950" @contextmenu="block">
    <!-- Toolbar -->
    <header class="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
      <button type="button" @click="back"
        class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
        <ArrowLeft class="w-4 h-4" /> {{ t('Back') }}
      </button>
      <h1 class="flex-1 min-w-0 truncate text-sm sm:text-base font-bold text-slate-900 dark:text-white">{{ title }}</h1>

      <div v-if="numPages" class="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <button type="button" @click="goTo(current - 1)" :disabled="current <= 1" aria-label="Previous page"
          class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"><ChevronUp class="w-4 h-4" /></button>
        <span class="tabular-nums px-1">{{ current }} / {{ numPages }}</span>
        <button type="button" @click="goTo(current + 1)" :disabled="current >= numPages" aria-label="Next page"
          class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"><ChevronDown class="w-4 h-4" /></button>
        <span class="mx-2 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <button type="button" @click="setZoom(zoom - 0.25)" :disabled="zoom <= 0.5" aria-label="Zoom out"
          class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"><ZoomOut class="w-4 h-4" /></button>
        <button type="button" @click="setZoom(1)" class="tabular-nums w-12 text-center cursor-pointer" title="Reset zoom">{{ zoomLabel }}</button>
        <button type="button" @click="setZoom(zoom + 0.25)" :disabled="zoom >= 2.5" aria-label="Zoom in"
          class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"><ZoomIn class="w-4 h-4" /></button>
      </div>
    </header>

    <!-- Pages -->
    <div ref="scroller" class="flex-1 min-h-0 overflow-auto select-none">
      <div v-if="loading" class="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 class="w-8 h-8 animate-spin text-[#006A3A]" />
        <p class="text-sm font-semibold">{{ t('Opening book…') }}</p>
      </div>
      <div v-else-if="error" class="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
        <AlertCircle class="w-10 h-10 text-red-500" />
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ error }}</p>
      </div>
      <div v-else class="py-6 flex flex-col items-center gap-4 min-w-fit px-4">
        <div v-for="n in numPages" :key="n" :ref="(el) => (pageEls[n - 1] = el)" :data-page="n" :style="pageStyle(n)"
          class="bg-white shadow-md rounded-sm shrink-0 overflow-hidden" />
      </div>
    </div>
  </div>
</template>

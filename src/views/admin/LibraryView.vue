<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Pencil, Trash2, Search, BookOpen, ScrollText, ExternalLink, X, Plus, Library, Layers, HardDrive, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import Sidebar from '../../components/layout/Sidebar.vue'
import Header from '../../components/layout/Header.vue'
import CoverCropper from '../../components/ui/CoverCropper.vue'
import { libraryService } from '@/services/libraryService'

defineOptions({ name: 'LibraryView' })

const options = ref(null)
const kind = ref('textbook')
const form = reactive({
  order: 1, grade: 1, subject: 'khmer', variant: '', language: '',
  topic: '', paper_kind: 'paper',
})
const file = ref(null)
const fileInputRef = ref(null)
const dragging = ref(false)
const busy = ref(false)
const progress = ref(0)
const error = ref('')
const success = ref('')
const needsOverwrite = ref(false)

const textbooks = ref([])
const pastPapers = ref([])
const listError = ref('')

const items = computed(() => (kind.value === 'textbook' ? textbooks.value : pastPapers.value))

// Shelf filters (client-side: the whole shelf is one request).
const search = ref('')
// Textbooks open as folders (one per grade, or per subject); clicking one
// shows just its books. `openGroup` is the folder's key, null at the top level.
const groupBy = ref('grade')
const openGroup = ref(null)

const subjectChoices = computed(() => {
  const seen = new Map()
  textbooks.value.forEach(b => b.subject_slug && seen.set(b.subject_slug, b.subject_en))
  return [...seen].map(([slug, en]) => ({ slug, en }))
})

const keyOf = (b) => (groupBy.value === 'grade' ? (b.grade ?? 'other') : (b.subject_slug ?? 'other'))

const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter(b => {
    if (kind.value === 'textbook' && openGroup.value !== null && keyOf(b) !== openGroup.value) return false
    if (!q) return true
    return `${b.title} ${b.subtitle || ''} ${b.id}`.toLowerCase().includes(q)
  })
})

// The folders shown before you open one: books grouped by grade or subject.
const folders = computed(() => {
  const map = new Map()
  textbooks.value.forEach(b => {
    const key = keyOf(b)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(b)
  })
  const byGrade = groupBy.value === 'grade'
  return [...map.entries()].map(([key, books]) => {
    const grades = [...new Set(books.map(b => b.grade).filter(Boolean))].sort((a, b) => a - b)
    return {
      key,
      label: key === 'other' ? 'Other' : byGrade ? `Grade ${key}` : (books[0].subject_en || key),
      detail: byGrade
        ? `${new Set(books.map(b => b.subject_en)).size} subjects`
        : grades.length ? `Grades ${grades[0]}${grades.length > 1 ? '–' + grades[grades.length - 1] : ''}` : '',
      count: books.length,
      chips: byGrade ? [...new Set(books.map(b => b.subject_en).filter(Boolean))] : [],
      bytes: books.reduce((n, b) => n + (b.file_size || 0), 0),
    }
  }).sort((x, y) => (x.key === 'other') - (y.key === 'other')
    || (byGrade ? x.key - y.key : x.label.localeCompare(y.label)))
})
// Cambodian school levels, so twelve grade folders read as three clear steps.
const LEVELS = [
  { title: 'Primary school', from: 1, to: 6 },
  { title: 'Lower secondary', from: 7, to: 9 },
  { title: 'Upper secondary', from: 10, to: 12 },
]
const folderSections = computed(() => {
  if (groupBy.value !== 'grade') return [{ title: '', sub: '', folders: folders.value }]
  const out = LEVELS.map(l => {
    const list = folders.value.filter(f => f.key !== 'other' && f.key >= l.from && f.key <= l.to)
    return { title: l.title, sub: `Grades ${l.from}–${l.to}`, folders: list }
  }).filter(sec => sec.folders.length)
  const other = folders.value.filter(f => f.key === 'other')
  if (other.length) out.push({ title: 'Other', sub: '', folders: other })
  return out
})
const maxFolderCount = computed(() => Math.max(1, ...folders.value.map(f => f.count)))
const showFolders = computed(() => kind.value === 'textbook' && openGroup.value === null && !search.value.trim())
const openFolderLabel = computed(() => folders.value.find(f => f.key === openGroup.value)?.label || '')

// ---- shelf: one continuous run of covers, grade then order ----
const shelfItems = computed(() => [...filteredItems.value].sort((x, y) =>
  (x.grade ?? 99) - (y.grade ?? 99) || x.order_number - y.order_number || x.id.localeCompare(y.id)))

// Covers are plain paper on purpose: green stays an accent (spine, grade label)
// so a shelf of 100 books reads as a library, not a wall of colour.

const selected = ref(new Set())
const toggleRow = (id) => {
  const next = new Set(selected.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selected.value = next
}
watch(groupBy, () => { openGroup.value = null })
// Only what's on screen can stay selected — otherwise "Delete N selected"
// would also delete books ticked in a folder or search you've since left.
watch([kind, openGroup, search], () => { selected.value = new Set() })

const removeSelected = async () => {
  const ids = [...selected.value]
  if (!ids.length) return
  if (!window.confirm(`Delete ${ids.length} file(s)? They disappear from the app and can't be undone.`)) return
  error.value = ''; success.value = ''
  let failed = 0
  for (const id of ids) {
    try { await libraryService.remove(kind.value, id) } catch { failed++ }
  }
  selected.value = new Set()
  if (failed) error.value = `${failed} of ${ids.length} could not be deleted.`
  else success.value = `Deleted ${ids.length} file(s).`
  refresh()
}

const totalBytes = computed(() => items.value.reduce((n, b) => n + (b.file_size || 0), 0))
const gradesCovered = computed(() => new Set(textbooks.value.map(b => b.grade).filter(Boolean)).size)
const subjectsCovered = computed(() => subjectChoices.value.length)

const clearFilters = () => { search.value = ''; openGroup.value = null }

const kindLabel = { questions: 'Key questions', answers: 'Answers', paper: 'Paper' }
const size = (bytes) => (bytes == null ? '—' : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`)

const refresh = async () => {
  listError.value = ''
  try {
    ;[textbooks.value, pastPapers.value] = await Promise.all([
      libraryService.listTextbooks(), libraryService.listPastPapers(),
    ])
  } catch {
    listError.value = 'Could not load the current shelf.'
  }
}

onMounted(async () => {
  try {
    options.value = await libraryService.getOptions()
  } catch {
    error.value = 'Could not load the form options. Are you signed in as an admin?'
  }
  refresh()
})

watch(kind, () => {
  clearFilters()
  error.value = ''; success.value = ''; needsOverwrite.value = false
  editing.value = null
})

// Edit mode: the form is loaded with an existing file's fields and saving
// moves that file to its new name (no re-upload).
const editing = ref(null)
const showForm = ref(false)

// ---- optional cover: pick an image, crop it, upload the cropped JPEG ----
const cropFile = ref(null)          // image waiting in the cropper
const coverBlob = ref(null)         // the cropped result, sent on save
const coverPreview = ref('')
const removeExistingCover = ref(false)
const coverInputRef = ref(null)

const resetCover = () => {
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  cropFile.value = null; coverBlob.value = null; coverPreview.value = ''; removeExistingCover.value = false
}
const pickCover = (e) => {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (!f) return
  if (!f.type.startsWith('image/')) { error.value = 'Please choose an image for the cover.'; return }
  error.value = ''
  cropFile.value = f
}
const onCropped = (blob) => {
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  coverBlob.value = blob
  coverPreview.value = URL.createObjectURL(blob)
  removeExistingCover.value = false
  cropFile.value = null
}
const clearCover = () => {
  const hadNew = !!coverBlob.value
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  coverBlob.value = null; coverPreview.value = ''
  // Removing when there was no fresh pick means "delete the saved cover".
  if (!hadNew && editing.value?.cover_url) removeExistingCover.value = true
}
const shownCover = computed(() => coverPreview.value || (!removeExistingCover.value && editing.value?.cover_url) || '')

const startEdit = (b) => {
  resetCover()
  error.value = ''; success.value = ''; needsOverwrite.value = false
  file.value = null
  editing.value = b
  showForm.value = true
  form.order = b.order_number
  if (kind.value === 'textbook') {
    form.grade = b.grade || 1
    form.subject = b.subject_slug || 'khmer'
    form.variant = b.variant_slug || ''
    form.language = b.language || ''
  } else {
    form.topic = b.topic_slug || ''
    form.paper_kind = b.kind
  }
}
const cancelEdit = () => { editing.value = null; error.value = '' }
const openAdd = () => { resetCover(); editing.value = null; file.value = null; error.value = ''; success.value = ''; needsOverwrite.value = false; showForm.value = true }
const closeForm = () => { resetCover(); showForm.value = false; editing.value = null; error.value = '' }

const removeItem = async (b) => {
  if (!window.confirm(`Delete "${b.title}" (${b.id}.pdf)? It disappears from the app and can't be undone.`)) return
  error.value = ''; success.value = ''
  try {
    await libraryService.remove(kind.value, b.id)
    if (editing.value?.id === b.id) editing.value = null
    success.value = `Deleted ${b.id}.pdf.`
    refresh()
  } catch (e) {
    error.value = e.response?.data?.error || e.message || 'Delete failed.'
  }
}

const pickFile = (f) => {
  error.value = ''
  success.value = ''
  needsOverwrite.value = false
  if (!f) return
  if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) {
    error.value = 'Please choose a PDF file.'
    return
  }
  // Same limit the server enforces — fail now, not after a long upload.
  const maxBytes = options.value?.max_bytes
  if (maxBytes && f.size > maxBytes) {
    error.value = `This PDF is ${mb(f.size)} MB. The limit is ${Math.round(maxBytes / 1048576)} MB.`
    return
  }
  file.value = f
}
const onDrop = (e) => { dragging.value = false; pickFile(e.dataTransfer.files?.[0]) }
const onChoose = (e) => { pickFile(e.target.files?.[0]); e.target.value = '' }

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1)

const canSubmit = computed(() => (!!file.value || !!editing.value) && !busy.value
  && (kind.value === 'textbook' || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.topic.trim().toLowerCase())))

const submit = async (overwrite = false) => {
  if (!canSubmit.value) return
  busy.value = true
  progress.value = 0
  error.value = ''
  success.value = ''
  try {
    const fields = kind.value === 'textbook'
      ? { kind: 'textbook', order: form.order, grade: form.grade, subject: form.subject,
          variant: form.variant, language: form.language }
      : { kind: 'past-paper', order: form.order, topic: form.topic.trim().toLowerCase(),
          paper_kind: form.paper_kind }
    if (overwrite) fields.overwrite = 'true'

    if (editing.value) {
      const result = await libraryService.update(kind.value, editing.value.id, fields)
      // The cover follows its PDF's name, so apply any cover change to the new one.
      const stem = result.name.replace(/\.pdf$/, '')
      // The rename has happened. If the cover step below fails, a retry must
      // target the new name, not the old one that no longer exists.
      editing.value = { ...editing.value, id: stem }
      if (coverBlob.value) await libraryService.setCover(kind.value, stem, coverBlob.value)
      else if (removeExistingCover.value) await libraryService.removeCover(kind.value, stem)
      success.value = result.unchanged && !coverBlob.value && !removeExistingCover.value ? 'Nothing changed.' : `Saved. Now ${result.name}.`
      resetCover()
      editing.value = null
      showForm.value = false
      refresh()
      return
    }

    const result = await libraryService.upload(file.value, fields, (e) => {
      if (e.total) progress.value = Math.round((e.loaded / e.total) * 100)
    }, coverBlob.value)
    success.value = `Uploaded as ${result.name}. It will show in the app now.`
    resetCover()
    file.value = null
    needsOverwrite.value = false
    showForm.value = false
    form.order = Math.min(99, Number(form.order) + 1)
    refresh()
  } catch (e) {
    error.value = e.response?.data?.error || e.message || 'Upload failed.'
    needsOverwrite.value = e.response?.status === 409 && !editing.value
  } finally {
    busy.value = false
  }
}


// ---- look & feel helpers ----

// Deliberately one quiet tone: colour is reserved for actions and status, so
// a 100-row catalog reads as a list rather than a rainbow.
const tone = () => ({
  tile: 'bg-emerald-50 text-[#006A3A] dark:bg-emerald-500/10 dark:text-emerald-400',
  chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
})

// What the file will be called — mirrors lms-backend library.routes.js buildName.
const pad2 = (n) => String(Math.max(0, Number(n) || 0)).padStart(2, '0')
const previewName = computed(() => {
  if (kind.value === 'textbook') {
    const parts = [pad2(form.order), `grade${pad2(form.grade)}`, form.subject]
    if (form.variant) parts.push(form.variant)
    if (form.language) parts.push(form.language)
    return `${parts.join('-')}.pdf`
  }
  const topic = form.topic.trim().toLowerCase() || 'topic'
  const suffix = { questions: '-key-questions', answers: '-answers', paper: '' }[form.paper_kind]
  return `${pad2(form.order)}-${topic}${suffix}.pdf`
})

const inputCls = 'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500'
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5'
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header>
        <template #left>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white truncate">Library Management</h1>
        </template>
      </Header>

      <main class="p-4 sm:p-8 flex-1 w-full space-y-6">

        <!-- Hero -->
        <section class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#005530] via-[#006A3A] to-[#12985a] px-5 py-4 text-white shadow-md">
          <div class="absolute -right-10 -top-16 w-60 h-60 rounded-full bg-[#ffce04]/20 blur-3xl" />
          <div class="relative flex flex-wrap items-center gap-x-6 gap-y-3">
            <div class="min-w-0">
              <h2 class="text-xl font-extrabold leading-tight">Book catalog</h2>
              <p class="text-xs text-white/70">Add a PDF and it's on students' phones instantly.</p>
            </div>

            <div class="flex flex-wrap items-center gap-2 lg:ml-auto">
              <span v-for="c in [
                { label: 'textbooks', value: textbooks.length, icon: BookOpen },
                { label: 'past papers', value: pastPapers.length, icon: ScrollText },
                { label: 'grades', value: gradesCovered, icon: Layers },
                { label: 'used', value: size(textbooks.reduce((n, b) => n + (b.file_size || 0), 0) + pastPapers.reduce((n, b) => n + (b.file_size || 0), 0)), icon: HardDrive },
              ]" :key="c.label"
                class="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 pl-2.5 pr-3.5 py-1.5 text-sm">
                <component :is="c.icon" class="w-4 h-4 text-[#ffce04]" />
                <b class="font-extrabold">{{ c.value }}</b>
                <span class="text-white/70 text-xs">{{ c.label }}</span>
              </span>
            </div>

            <button type="button" @click="openAdd" :disabled="options && !options.configured"
              class="inline-flex items-center gap-2 bg-[#ffce04] hover:bg-[#ffd92e] disabled:opacity-40 text-[#3d3000] text-sm font-extrabold py-2.5 px-4 rounded-xl shadow-lg shadow-black/10 transition hover:-translate-y-0.5 cursor-pointer">
              <Plus class="w-4 h-4" /> Add {{ kind === 'textbook' ? 'textbook' : 'past paper' }}
            </button>
          </div>
        </section>

        <div v-if="options && !options.configured"
          class="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
          Textbook storage isn't configured on the server (TEXTBOOK_* in .env), so adding files is disabled.
        </div>

        <!-- Status messages -->
        <p v-if="!showForm && error" class="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" /> {{ error }}
        </p>
        <p v-if="!showForm && success" class="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 class="w-4 h-4 mt-0.5 shrink-0" /> {{ success }}
        </p>

        <!-- Catalog panel -->
        <section>
          <!-- Tabs · search · filters on one row -->
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-1">
              <button v-for="t in [{ k: 'textbook', l: 'Textbooks', n: textbooks.length }, { k: 'past-paper', l: 'Past papers', n: pastPapers.length }]"
                :key="t.k" type="button" @click="kind = t.k"
                :class="['px-3 py-3 text-sm font-bold border-b-2 -mb-px transition cursor-pointer',
                  kind === t.k ? 'border-[#006A3A] text-[#006A3A] dark:text-emerald-400 dark:border-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200']">
                {{ t.l }}
                <span :class="['ml-1.5 px-1.5 py-0.5 rounded-full text-[11px]', kind === t.k ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500']">{{ t.n }}</span>
              </button>
            </div>

            <!-- Browse textbooks as folders by grade or by subject -->
            <div v-if="kind === 'textbook'" class="flex items-center gap-2 pl-4 ml-1 border-l border-slate-200 dark:border-slate-700 py-2">
              <span class="text-xs font-bold text-slate-500 dark:text-slate-400">Browse by</span>
              <div class="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
                <button v-for="g in [{ k: 'grade', l: 'Grade' }, { k: 'subject', l: 'Subject' }]" :key="g.k" type="button" @click="groupBy = g.k"
                  :class="['px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer',
                    groupBy === g.k ? 'bg-white dark:bg-slate-900 text-[#006A3A] dark:text-emerald-400 shadow-sm' : 'text-slate-500']">{{ g.l }}</button>
              </div>
            </div>

            <div class="ml-auto flex flex-wrap items-center gap-2 py-2">
              <button v-if="selected.size" type="button" @click="removeSelected"
                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer">
                <Trash2 class="w-3.5 h-3.5" /> Delete {{ selected.size }} selected
              </button>
              <button v-if="search || openGroup !== null" type="button" @click="clearFilters"
                class="text-xs font-bold text-[#006A3A] dark:text-emerald-400 underline cursor-pointer">Clear</button>
              <div class="relative w-56">
                <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input v-model="search" type="search" placeholder="Search" :class="[inputCls, 'pl-9 !py-2']" />
              </div>
              <span v-if="!showFolders" class="text-xs font-semibold text-slate-400 whitespace-nowrap">{{ filteredItems.length }}<template v-if="filteredItems.length !== items.length"> of {{ items.length }}</template> {{ kind === 'textbook' ? 'books' : 'papers' }}</span>
            </div>
          </div>

          <p v-if="listError" class="px-4 py-2 text-sm text-red-600">{{ listError }}</p>

          <!-- Bookshelf -->
          <div class="p-4 sm:p-6">
            <!-- Inside a folder: way back -->
            <div v-if="kind === 'textbook' && openGroup !== null" class="flex items-center gap-2 mb-5 text-sm">
              <button type="button" @click="openGroup = null"
                class="inline-flex items-center gap-1 font-bold text-[#006A3A] dark:text-emerald-400 hover:underline cursor-pointer">
                <ChevronLeft class="w-4 h-4" /> All {{ groupBy === 'grade' ? 'grades' : 'subjects' }}
              </button>
              <span class="text-slate-300">/</span>
              <span class="font-extrabold text-slate-900 dark:text-white">{{ openFolderLabel }}</span>
            </div>

            <!-- Folders, grouped into school levels -->
            <div v-if="showFolders" class="space-y-8">
              <section v-for="sec in folderSections" :key="sec.title || 'all'">
                <div v-if="sec.title" class="flex items-center gap-3 mb-3">
                  <span class="w-1.5 h-6 rounded-full bg-[#ffce04]" />
                  <h3 class="text-base font-extrabold text-slate-900 dark:text-white">{{ sec.title }}</h3>
                  <span class="text-xs font-semibold text-slate-400">{{ sec.sub }}<template v-if="sec.sub"> · </template>{{ sec.folders.reduce((n, f) => n + f.count, 0) }} books</span>
                  <span class="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                </div>

                <div class="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
                  <button v-for="f in sec.folders" :key="f.key" type="button" @click="openGroup = f.key"
                    class="group text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:border-[#006A3A] cursor-pointer">
                    <div class="flex items-center gap-4">
                      <span class="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#005530] to-[#12985a] text-white shrink-0 flex flex-col items-center justify-center shadow-md shadow-emerald-900/15 relative overflow-hidden transition group-hover:scale-105">
                        <span class="absolute top-0 inset-x-0 h-1 bg-[#ffce04]" />
                        <template v-if="groupBy === 'grade' && f.key !== 'other'">
                          <span class="text-[9px] font-bold uppercase tracking-widest text-white/70 leading-none">Grade</span>
                          <span class="text-2xl font-extrabold leading-none mt-1">{{ f.key }}</span>
                        </template>
                        <BookOpen v-else class="w-7 h-7" />
                      </span>

                      <div class="min-w-0 flex-1">
                        <p class="text-lg font-extrabold text-slate-900 dark:text-white truncate leading-tight">{{ f.label }}</p>
                        <p class="text-sm font-bold text-[#006A3A] dark:text-emerald-400 whitespace-nowrap">{{ f.count }} {{ f.count === 1 ? 'book' : 'books' }}</p>
                        <p class="text-xs text-slate-500 truncate">{{ f.detail }}<template v-if="f.detail"> · </template>{{ size(f.bytes) }}</p>
                      </div>

                      <ChevronRight class="w-5 h-5 text-slate-300 group-hover:text-[#006A3A] group-hover:translate-x-0.5 transition shrink-0" />
                    </div>

                    <!-- what's inside -->
                    <div v-if="f.chips.length" class="mt-4 flex flex-wrap gap-1.5">
                      <span v-for="c in f.chips.slice(0, 4)" :key="c" class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{{ c }}</span>
                      <span v-if="f.chips.length > 4" class="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-[11px] font-bold text-[#006A3A] dark:text-emerald-400">+{{ f.chips.length - 4 }} more</span>
                    </div>

                    <div class="mt-4 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div class="h-full rounded-full bg-[#006A3A]/70" :style="{ width: Math.max(6, (f.count / maxFolderCount) * 100) + '%' }" />
                    </div>
                  </button>
                </div>
              </section>
            </div>

            <div v-if="!showFolders" class="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,10rem))] gap-x-5 gap-y-6">
                <article v-for="b in shelfItems" :key="b.id" class="group relative">
                  <!-- Cover -->
                  <div :class="['relative aspect-[3/4] rounded-r-xl rounded-l-md overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-sm transition duration-200 group-hover:-translate-y-1.5 group-hover:shadow-lg',
                      selected.has(b.id) ? 'ring-4 ring-[#ffce04]' : editing?.id === b.id ? 'ring-4 ring-[#ffce04]/60' : '']">
                    <img v-if="b.cover_url" :src="b.cover_url" :alt="b.title" loading="lazy" class="absolute inset-0 w-full h-full object-cover" />
                    <span class="absolute left-0 inset-y-0 w-2.5 bg-[#006A3A]" />
                    <span class="absolute top-0 inset-x-0 h-1 bg-[#ffce04]" />
                    <FileText v-if="!b.cover_url" class="absolute -right-3 -bottom-3 w-20 h-20 text-slate-100 dark:text-slate-700/60" />

                    <div v-if="!b.cover_url" class="relative h-full flex flex-col justify-between pl-5 pr-2.5 pt-4 pb-2.5">
                      <p class="text-[9px] font-bold uppercase tracking-wider text-[#006A3A] dark:text-emerald-400">
                        {{ kind === 'textbook' ? (b.grade ? 'Grade ' + b.grade : 'Textbook') : kindLabel[b.kind] }}
                      </p>
                      <p class="font-bold text-[13px] leading-snug line-clamp-4">{{ b.title }}</p>
                      <div class="flex items-end justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <span class="truncate">{{ b.subject_en || 'PDF' }}</span>
                        
                      </div>
                    </div>

                    <!-- Hover actions -->
                    <div class="absolute inset-0 bg-slate-900/55 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition flex items-center justify-center gap-2">
                      <a :href="b.file_url" target="_blank" rel="noopener" title="Open"
                        class="w-8 h-8 rounded-full bg-white text-[#006A3A] flex items-center justify-center hover:scale-110 transition"><ExternalLink class="w-4 h-4" /></a>
                      <button type="button" title="Edit" @click="startEdit(b)"
                        class="w-8 h-8 rounded-full bg-[#ffce04] text-[#3d3000] flex items-center justify-center hover:scale-110 transition cursor-pointer"><Pencil class="w-4 h-4" /></button>
                      <button type="button" title="Delete" @click="removeItem(b)"
                        class="w-8 h-8 rounded-full bg-white text-red-600 flex items-center justify-center hover:scale-110 transition cursor-pointer"><Trash2 class="w-4 h-4" /></button>
                    </div>

                    <!-- Select -->
                    <label :class="['absolute top-3 right-2 w-6 h-6 rounded-md bg-white/90 flex items-center justify-center cursor-pointer transition',
                        selected.has(b.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100']">
                      <input type="checkbox" :checked="selected.has(b.id)" @change="toggleRow(b.id)" class="accent-[#006A3A] w-4 h-4 cursor-pointer" />
                    </label>
                  </div>

                  <p class="mt-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate" :title="b.id + '.pdf'">{{ b.subtitle || b.id }}</p>
                  <p class="text-[11px] text-slate-400 truncate">{{ size(b.file_size) }} · #{{ b.order_number }}</p>
                </article>
              </div>

            <div v-if="showFolders ? !folders.length : !shelfItems.length" class="py-16 text-center">
              <Library class="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">{{ items.length ? 'No matches' : 'Nothing on this shelf yet' }}</p>
              <button v-if="!items.length" type="button" @click="openAdd" class="mt-2 text-sm font-bold text-[#006A3A] dark:text-emerald-400 underline cursor-pointer">Add the first one</button>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- Add / edit drawer (slides in from the right) -->
    <Transition name="drawer">
    <div v-if="showForm" class="drawer-root fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-[2px]" @click.self="!busy && closeForm()">
      <div class="drawer-panel relative w-full max-w-md h-full flex flex-col bg-white dark:bg-slate-900 shadow-2xl">
        <CoverCropper v-if="cropFile" :file="cropFile" @done="onCropped" @cancel="cropFile = null" />
        <div :class="['px-6 py-4 flex items-center justify-between border-b', editing ? 'bg-[#ffce04]/20 border-[#ffce04]/40' : 'bg-emerald-50 dark:bg-emerald-900/10 border-slate-100 dark:border-slate-800']">
          <h3 class="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <component :is="editing ? Pencil : UploadCloud" class="w-5 h-5 text-[#006A3A] dark:text-emerald-400" />
            {{ editing ? 'Edit details' : `Add a ${kind === 'textbook' ? 'textbook' : 'past paper'}` }}
          </h3>
          <button type="button" @click="closeForm" :disabled="busy" class="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"><X class="w-5 h-5" /></button>
        </div>

        <div class="p-6 space-y-5 flex-1 overflow-y-auto">
          <!-- File -->
          <div>
            <p class="flex items-center gap-2 mb-2 text-sm font-bold text-slate-900 dark:text-white">
              <span class="w-6 h-6 rounded-full bg-[#006A3A] text-white text-xs flex items-center justify-center">1</span>
              {{ editing ? 'File' : 'Choose the PDF' }}
            </p>
            <div v-if="editing" class="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
              <span :class="['w-11 h-11 rounded-xl flex items-center justify-center shrink-0', tone(editing).tile]"><FileText class="w-5 h-5" /></span>
              <div class="min-w-0">
                <p class="font-semibold text-slate-900 dark:text-white truncate">{{ editing.title }}</p>
                <p class="text-xs text-slate-500 truncate">{{ editing.id }}.pdf · the PDF isn't re-uploaded</p>
              </div>
            </div>
            <div v-else
              @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop"
              @click="fileInputRef?.click()"
              :class="['w-full min-h-[9rem] border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center transition cursor-pointer',
                dragging ? 'border-[#006A3A] bg-emerald-50 dark:bg-emerald-900/20'
                  : file ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10'
                  : 'border-slate-300 dark:border-slate-700 hover:border-[#006A3A] hover:bg-slate-50 dark:hover:bg-slate-800/50']">
              <template v-if="file">
                <CheckCircle2 class="w-8 h-8 text-emerald-500 mb-1.5" />
                <p class="text-sm font-semibold text-slate-900 dark:text-white break-all">{{ file.name }}</p>
                <p class="text-xs text-slate-500 mt-0.5">{{ mb(file.size) }} MB · click to change</p>
              </template>
              <template v-else>
                <span class="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mb-2"><UploadCloud class="w-5 h-5 text-[#006A3A] dark:text-emerald-400" /></span>
                <p class="text-sm font-bold text-slate-800 dark:text-slate-100">Drop a PDF here, or <span class="text-[#006A3A] dark:text-emerald-400 underline">browse</span></p>
                <p class="text-xs text-slate-500 mt-1">PDF only · up to {{ options ? Math.round(options.max_bytes / 1048576) : 100 }} MB</p>
              </template>
              <input ref="fileInputRef" type="file" accept="application/pdf,.pdf" class="hidden" @change="onChoose" />
            </div>
          </div>

          <!-- Details -->
          <div>
            <p class="flex items-center gap-2 mb-2 text-sm font-bold text-slate-900 dark:text-white">
              <span class="w-6 h-6 rounded-full bg-[#006A3A] text-white text-xs flex items-center justify-center">2</span>
              Where does it go?
            </p>
            <div v-if="options" class="grid grid-cols-2 gap-3">
              <template v-if="kind === 'textbook'">
                <div class="col-span-2">
                  <label :class="labelCls">Subject</label>
                  <select v-model="form.subject" :class="inputCls"><option v-for="s in options.subjects" :key="s.slug" :value="s.slug">{{ s.en }} · {{ s.km }}</option></select>
                </div>
                <div>
                  <label :class="labelCls">Grade</label>
                  <select v-model.number="form.grade" :class="inputCls"><option v-for="g in 12" :key="g" :value="g">Grade {{ g }}</option></select>
                </div>
                <div>
                  <label :class="labelCls">Order</label>
                  <input v-model.number="form.order" type="number" min="0" max="99" :class="inputCls" />
                </div>
                <div>
                  <label :class="labelCls">Edition / part</label>
                  <select v-model="form.variant" :class="inputCls"><option value="">None</option><option v-for="v in options.variants" :key="v.slug" :value="v.slug">{{ v.en }}</option></select>
                </div>
                <div>
                  <label :class="labelCls">Language</label>
                  <select v-model="form.language" :class="inputCls"><option value="">None</option><option v-for="l in options.languages" :key="l" :value="l" class="capitalize">{{ l }}</option></select>
                </div>
              </template>
              <template v-else>
                <div class="col-span-2">
                  <label :class="labelCls">Topic</label>
                  <input v-model="form.topic" list="known-topics" placeholder="e.g. khmer-republic" :class="inputCls" />
                  <datalist id="known-topics"><option v-for="t in options.topics" :key="t.slug" :value="t.slug">{{ t.en }}</option></datalist>
                  <p class="text-[11px] text-slate-400 mt-1">Lowercase letters, numbers, hyphens. A new topic shows in English in the app.</p>
                </div>
                <div class="col-span-2">
                  <label :class="labelCls">This file is</label>
                  <select v-model="form.paper_kind" :class="inputCls"><option value="paper">Standalone paper</option><option value="questions">Key questions</option><option value="answers">Answers</option></select>
                </div>
                <div class="col-span-2">
                  <label :class="labelCls">Order</label>
                  <input v-model.number="form.order" type="number" min="0" max="99" :class="inputCls" />
                </div>
              </template>
            </div>
          </div>

          <!-- Cover (optional) -->
          <div>
            <p class="flex items-center gap-2 mb-2 text-sm font-bold text-slate-900 dark:text-white">
              <span class="w-6 h-6 rounded-full bg-[#006A3A] text-white text-xs flex items-center justify-center">3</span>
              Cover picture <span class="text-xs font-medium text-slate-400">optional</span>
            </p>
            <div class="flex items-center gap-4">
              <div class="relative w-20 aspect-[3/4] rounded-r-lg rounded-l-md overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                <img v-if="shownCover" :src="shownCover" alt="" class="absolute inset-0 w-full h-full object-cover" />
                <span v-if="shownCover" class="absolute left-0 inset-y-0 w-1.5 bg-[#006A3A]" />
                <FileText v-else class="w-6 h-6 text-slate-300" />
              </div>
              <div class="flex flex-col items-start gap-2">
                <button type="button" @click="coverInputRef?.click()"
                  class="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-[#006A3A] hover:text-[#006A3A] cursor-pointer">
                  {{ shownCover ? 'Change picture' : 'Choose picture' }}
                </button>
                <button v-if="shownCover" type="button" @click="clearCover" class="text-xs font-bold text-red-600 hover:underline cursor-pointer">Remove</button>
                <p class="text-[11px] text-slate-400 max-w-[12rem]">You'll crop it to the book shape next. Without one, the app shows a plain cover.</p>
              </div>
              <input ref="coverInputRef" type="file" accept="image/*" class="hidden" @change="pickCover" />
            </div>
          </div>

          <div class="rounded-xl bg-slate-50 dark:bg-slate-800 px-3 py-2 flex flex-wrap items-center gap-x-2 text-xs">
            <span class="font-bold uppercase tracking-wider text-slate-400">Saved as</span>
            <code class="font-mono font-semibold text-[#006A3A] dark:text-emerald-400 break-all">{{ previewName }}</code>
          </div>

          <div v-if="busy && !editing" class="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-[#006A3A] to-[#ffce04] transition-all" :style="{ width: progress + '%' }" />
          </div>
          <p v-if="error" class="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" /> {{ error }}
          </p>
        </div>

        <div class="px-6 py-4 flex flex-wrap justify-end gap-3 shrink-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
          <button type="button" @click="closeForm" :disabled="busy" class="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer">Cancel</button>
          <button v-if="needsOverwrite" type="button" :disabled="busy" @click="submit(true)"
            class="border-2 border-red-300 text-red-600 dark:text-red-400 text-sm font-bold py-2.5 px-5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer">Replace existing file</button>
          <button type="button" :disabled="!canSubmit || (options && !options.configured)" @click="submit(false)"
            class="bg-[#006A3A] hover:bg-[#005A31] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 px-6 rounded-xl shadow-sm cursor-pointer">
            {{ editing ? (busy ? 'Saving…' : 'Save changes') : (busy ? `Uploading… ${progress}%` : 'Upload to app') }}
          </button>
        </div>
      </div>
    </div>
    </Transition>
  </div>
</template>

<style scoped>
.drawer-enter-active, .drawer-leave-active { transition: background-color .25s ease, backdrop-filter .25s ease; }
.drawer-enter-active .drawer-panel, .drawer-leave-active .drawer-panel { transition: transform .28s cubic-bezier(.22, 1, .36, 1); }
.drawer-enter-from, .drawer-leave-to { background-color: transparent; backdrop-filter: none; }
.drawer-enter-from .drawer-panel, .drawer-leave-to .drawer-panel { transform: translateX(100%); }
</style>

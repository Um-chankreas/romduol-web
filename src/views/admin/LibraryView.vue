<script setup>
import { useLanguage } from '@/composables/useLanguage'
const { t } = useLanguage()
import { ref, reactive, computed, onMounted, onBeforeUnmount, onActivated, onDeactivated, nextTick, watch } from 'vue'
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Pencil, Trash2, Search, BookOpen, ScrollText, ExternalLink, X, Plus, Library, Layers, HardDrive, ChevronDown, Calculator } from 'lucide-vue-next'
import Sidebar from '../../components/layout/Sidebar.vue'
import Header from '../../components/layout/Header.vue'
import Footer from '../../components/layout/Footer.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import CoverCropper from '../../components/ui/CoverCropper.vue'
import { libraryService } from '@/services/libraryService'
import { authService } from '@/services/authService'

defineOptions({ name: 'LibraryView' })

// Students and teachers can browse the shelf; managing it is admin-only.
const canManage = ['admin', 'super_admin'].includes(authService.getCurrentUser()?.role)
const options = ref(null)
const kind = ref('textbook')
const form = reactive({
  order: 1, grade: 1, subject: 'khmer', variant: '', language: '',
  topic: '', paper_kind: 'paper',
  // formula sheets
  grade_from: 12, grade_to: '', qualifier: '', source: '', version: 1,
  // optional hand-written title (empty = the automatic one)
  title: '', subtitle: '',
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
const formulas = ref([])
const listError = ref('')
// True only until the first load finishes, so skeletons show on arrival but a
// refresh after an upload or delete doesn't flash the page back to grey.
const initialLoading = ref(true)

const items = computed(() => (kind.value === 'textbook' ? textbooks.value : kind.value === 'formula' ? formulas.value : pastPapers.value))
const addLabel = computed(() => (kind.value === 'textbook' ? 'textbook' : kind.value === 'formula' ? 'formula sheet' : 'past paper'))
const unitLabel = computed(() => (kind.value === 'textbook' ? 'books' : kind.value === 'formula' ? 'sheets' : 'papers'))

// Shelf filters (client-side: the whole shelf is one request).
const search = ref('')
// "Grade 12" or "Grades 10–12" for a formula sheet.
const gradeRange = (f) => (f.grade_from == null ? '' : f.grade_from === f.grade_to ? `Grade ${f.grade_from}` : `Grades ${f.grade_from}–${f.grade_to}`)

const searching = computed(() => !!search.value.trim())

// ---- Grade / Subject filters (textbooks + formulas; past papers have neither) ----
const filterGrades = ref([])       // [] = all grades; several can be picked at once
const filterSubject = ref('')      // '' = all subjects
const openMenu = ref('')           // '' | 'grade' | 'subject'
const hasFilters = computed(() => filterGrades.value.length > 0 || !!filterSubject.value)
const canFilter = computed(() => kind.value !== 'past-paper')
const GRADE_LEVELS = [
  { title: 'Primary school', grades: [1, 2, 3, 4, 5, 6] },
  { title: 'Lower secondary', grades: [7, 8, 9] },
  { title: 'Upper secondary', grades: [10, 11, 12] },
]
const subjectOptions = computed(() => {
  const seen = new Map()
  items.value.forEach(b => b.subject_slug && seen.set(b.subject_slug, b.subject_en || b.subject_slug))
  return [...seen].map(([slug, en]) => ({ slug, en })).sort((a, b) => a.en.localeCompare(b.en))
})
const subjectLabel = computed(() => subjectOptions.value.find(s => s.slug === filterSubject.value)?.en || t('All'))
const matchesGrade = (b, g) => (kind.value === 'formula'
  ? b.grade_from != null && g >= b.grade_from && g <= b.grade_to
  : b.grade === g)
// Grades are multi-select: each click toggles one and the menu stays open.
const toggleGrade = (g) => {
  const set = new Set(filterGrades.value)
  set.has(g) ? set.delete(g) : set.add(g)
  filterGrades.value = [...set].sort((a, b) => a - b)
}
const gradeLabel = computed(() => {
  const g = filterGrades.value
  return !g.length ? t('All') : g.length <= 3 ? g.join(', ') : `${g.length} selected`
})
const pickSubject = (s) => { filterSubject.value = s; openMenu.value = '' }
const toggleMenu = (m) => { openMenu.value = openMenu.value === m ? '' : m }
const closeMenus = (e) => { if (!e.target.closest?.('.lib-filter')) openMenu.value = '' }

// Grade and Subject narrow the shelf first; search then looks inside what's left
// (clear the filters and it looks across every book of the tab).
const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  const words = q ? q.split(/\s+/) : []
  const useFilters = canFilter.value
  return items.value.filter(b => {
    if (useFilters && filterGrades.value.length && !filterGrades.value.some(g => matchesGrade(b, g))) return false
    if (useFilters && filterSubject.value && b.subject_slug !== filterSubject.value) return false
    if (!words.length) return true
    const hay = `${b.title} ${b.subtitle || ''} ${b.id} ${b.subject_en || ''} ${b.grade ? 'grade ' + b.grade : ''} ${b.grade_from != null ? 'grade ' + b.grade_from + ' grade ' + b.grade_to : ''}`.toLowerCase()
    return words.every(w => hay.includes(w))
  })
})

// ---- shelf: one continuous run of covers, grade then order ----
const shelfItems = computed(() => [...filteredItems.value].sort((x, y) => kind.value === 'formula'
  ? (x.subject_en || '~').localeCompare(y.subject_en || '~') || (x.grade_from ?? 99) - (y.grade_from ?? 99) || x.id.localeCompare(y.id)
  : (x.grade ?? 99) - (y.grade ?? 99) || x.order_number - y.order_number || x.id.localeCompare(y.id)))

// The shelf is one continuous, untitled run: no grouping by grade or subject.
const shelfSections = computed(() => [{ key: 'all', title: '', books: shelfItems.value }])

// Covers are plain paper on purpose: green stays an accent (spine, grade label)
// so a shelf of 100 books reads as a library, not a wall of colour.

const selected = ref(new Set())
const toggleRow = (id) => {
  const next = new Set(selected.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selected.value = next
}
// Only what's on screen can stay selected — otherwise "Delete N selected"
// would also delete books ticked in a folder or search you've since left.
onBeforeUnmount(() => document.removeEventListener('click', closeMenus))

// Kept alive (see App.vue): coming back from the reader keeps the tab, filters
// and scroll position instead of reloading. Covers/links can be presigned and
// lapse, so the shelf is refreshed quietly on return.
const scrollEl = ref(null)
let savedScroll = 0
let activatedOnce = false
onDeactivated(() => {
  savedScroll = scrollEl.value?.scrollTop || 0
  document.removeEventListener('click', closeMenus)
})
onActivated(async () => {
  document.addEventListener('click', closeMenus)
  if (!activatedOnce) { activatedOnce = true; return }
  refresh()
  await nextTick()
  if (scrollEl.value) scrollEl.value.scrollTop = savedScroll
})
watch([kind, search, filterGrades, filterSubject], () => { selected.value = new Set() })

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

const clearFilters = () => { search.value = ''; filterGrades.value = []; filterSubject.value = ''; openMenu.value = '' }

const kindLabel = { questions: 'Key questions', answers: 'Answers', paper: 'Paper' }
const size = (bytes) => (bytes == null ? '—' : bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(1)} GB` : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`)

const refresh = async () => {
  listError.value = ''
  try {
    ;[textbooks.value, pastPapers.value] = await Promise.all([
      libraryService.listTextbooks(), libraryService.listPastPapers(),
    ])
  } catch {
    listError.value = 'Could not load the current shelf.'
  }
  // Separate so a formula-shelf problem never hides the books and papers.
  try { formulas.value = await libraryService.listFormulas() } catch { formulas.value = [] }
  initialLoading.value = false
}

onMounted(async () => {
  document.addEventListener('click', closeMenus)
  if (canManage) {
    try {
      options.value = await libraryService.getOptions()
    } catch {
      error.value = 'Could not load the form options. Are you signed in as an admin?'
    }
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
  form.title = b.title_custom ? b.title : ''
  form.subtitle = b.title_custom ? (b.subtitle || '') : ''
  if (kind.value === 'formula') {
    form.subject = b.subject_slug || 'math'
    form.grade_from = b.grade_from || 12
    form.grade_to = b.grade_to && b.grade_to !== b.grade_from ? b.grade_to : ''
    form.qualifier = b.qualifier_slug || ''
    form.source = b.source_slug || ''
    form.language = b.language || ''
    form.version = b.version || 1
  } else if (kind.value === 'textbook') {
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
const openAdd = () => { form.title = ''; form.subtitle = ''; resetCover(); editing.value = null; file.value = null; error.value = ''; success.value = ''; needsOverwrite.value = false; showForm.value = true }
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
  && (kind.value !== 'past-paper' || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.topic.trim().toLowerCase())))

const submit = async (overwrite = false) => {
  if (!canSubmit.value) return
  busy.value = true
  progress.value = 0
  error.value = ''
  success.value = ''
  try {
    const fields = kind.value === 'formula'
      ? { kind: 'formula', subject: form.subject, grade_from: form.grade_from, grade_to: form.grade_to,
          qualifier: form.qualifier, source: form.source, language: form.language, version: form.version }
      : kind.value === 'textbook'
      ? { kind: 'textbook', order: form.order, grade: form.grade, subject: form.subject,
          variant: form.variant, language: form.language }
      : { kind: 'past-paper', order: form.order, topic: form.topic.trim().toLowerCase(),
          paper_kind: form.paper_kind }
    // Editing always sends the title so clearing it restores the automatic one;
    // a new upload only sends one that was typed.
    if (editing.value || form.title.trim()) { fields.title = form.title.trim(); fields.subtitle = form.subtitle.trim() }
    if (overwrite) fields.overwrite = 'true'

    if (editing.value) {
      const editingWas = editing.value
      const result = await libraryService.update(kind.value, editing.value.id, fields)
      // The cover follows its PDF's name, so apply any cover change to the new one.
      const stem = result.name.replace(/\.pdf$/, '')
      // The rename has happened. If the cover step below fails, a retry must
      // target the new name, not the old one that no longer exists.
      editing.value = { ...editing.value, id: stem }
      if (coverBlob.value) await libraryService.setCover(kind.value, stem, coverBlob.value)
      else if (removeExistingCover.value) await libraryService.removeCover(kind.value, stem)
      const titleChanged = form.title.trim() !== (editingWas.title_custom ? editingWas.title : '')
        || form.subtitle.trim() !== (editingWas.title_custom ? (editingWas.subtitle || '') : '')
      success.value = result.unchanged && !coverBlob.value && !removeExistingCover.value && !titleChanged ? 'Nothing changed.' : `Saved. Now ${result.name}.`
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
    if (kind.value !== 'formula') form.order = Math.min(99, Number(form.order) + 1)
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
  if (kind.value === 'formula') {
    const parts = [editing.value?.id?.match(/^\d{6,}/)?.[0] || '########', form.subject, 'formulas']
    if (form.qualifier) parts.push(form.qualifier)
    parts.push(`g${pad2(form.grade_from)}`)
    if (form.grade_to !== '' && Number(form.grade_to) !== Number(form.grade_from)) parts.push(`g${pad2(form.grade_to)}`)
    if (form.source) parts.push(form.source)
    if (form.language) parts.push(form.language)
    if (Number(form.version) > 1) parts.push(`v${form.version}`)
    return `${parts.join('-')}.pdf`
  }
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
  <div class="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0 min-h-0">
      <Header>
        <template #left>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white truncate">{{ t('Library Management') }}</h1>
        </template>
      </Header>

      <!-- only this area scrolls; sidebar + header stay put -->
      <div ref="scrollEl" class="flex-1 min-h-0 overflow-y-auto flex flex-col">
      <main class="p-4 sm:p-8 flex-1 w-full space-y-6">

        <!-- Title + action -->
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <h2 class="text-2xl font-extrabold leading-tight text-slate-900 dark:text-white">{{ t('Book catalog') }}</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{{ t("Add a PDF and it's on students' phones instantly.") }}</p>
          </div>
          <button v-if="canManage" type="button" @click="openAdd" :disabled="options && !options.configured"
            class="inline-flex items-center gap-2 bg-[#006A3A] hover:bg-[#005A31] disabled:opacity-40 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition cursor-pointer">
            <Plus class="w-4 h-4" /> {{ t('Add') }} {{ t(addLabel) }}
          </button>
        </div>

        <!-- Stats -->
        <div :class="['grid grid-cols-2 gap-4', canManage ? 'lg:grid-cols-5' : 'lg:grid-cols-4']">
          <div v-for="c in [
            { label: t('Textbooks'), value: textbooks.length, icon: BookOpen },
            { label: t('Past papers'), value: pastPapers.length, icon: ScrollText },
            { label: t('Formulas'), value: formulas.length, icon: Calculator },
            { label: t('Grades'), value: gradesCovered, icon: Layers },
            ...(canManage ? [{ label: t('Storage used'), value: size([textbooks, pastPapers, formulas].reduce((n, list) => n + list.reduce((m, b) => m + (b.file_size || 0), 0), 0)), icon: HardDrive }] : []),
          ]" :key="c.label"
            class="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-5 py-4">
            <div>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ c.label }}</p>
              <Skeleton v-if="initialLoading" class="h-6 w-14 mt-1.5" />
              <p v-else class="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 leading-none">{{ c.value }}</p>
            </div>
            <component :is="c.icon" class="w-4 h-4 text-slate-400" />
          </div>
        </div>

        <div v-if="canManage && options && !options.configured"
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
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center gap-1">
              <button v-for="tab in [{ k: 'textbook', l: t('Textbooks'), n: textbooks.length }, { k: 'past-paper', l: t('Past papers'), n: pastPapers.length }, { k: 'formula', l: t('Formulas'), n: formulas.length }]"
                :key="tab.k" type="button" @click="kind = tab.k"
                :class="['px-3 py-3 text-sm font-bold border-b-2 -mb-px transition cursor-pointer',
                  kind === tab.k ? 'border-[#006A3A] text-[#006A3A] dark:text-emerald-400 dark:border-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200']">
                {{ tab.l }}
                <span :class="['ml-1.5 px-1.5 py-0.5 rounded-full text-[11px]', kind === tab.k ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500']"><template v-if="!initialLoading">{{ tab.n }}</template><template v-else>&nbsp;&nbsp;</template></span>
              </button>
            </div>

            <!-- Grade + Subject filters -->
            <div v-if="canFilter" class="flex items-center gap-2 py-2">
              <div class="lib-filter relative">
                <button type="button" @click="toggleMenu('grade')"
                  :class="['inline-flex items-center gap-2 rounded-xl border bg-white dark:bg-slate-900 px-3 py-2 text-xs transition cursor-pointer',
                    openMenu === 'grade' || filterGrades.length ? 'border-[#006A3A] ring-2 ring-[#006A3A]/15' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300']">
                  <span class="text-slate-500 dark:text-slate-400">{{ t('Grade') }}</span>
                  <b class="text-slate-900 dark:text-white">{{ gradeLabel }}</b>
                  <ChevronDown class="w-3.5 h-3.5 text-slate-400" />
                </button>
                <div v-if="openMenu === 'grade'" class="absolute left-0 top-full mt-2 z-40 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-4">
                  <button type="button" @click="filterGrades = []"
                    :class="['w-full text-left rounded-lg px-3 py-2 text-sm font-bold cursor-pointer', !filterGrades.length ? 'bg-emerald-50 dark:bg-emerald-500/10 text-[#006A3A] dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800']">All grades</button>
                  <div v-for="lv in GRADE_LEVELS" :key="lv.title" class="mt-3">
                    <p class="text-[11px] font-bold text-slate-400 mb-1.5">{{ lv.title }}</p>
                    <div class="flex flex-wrap gap-1.5">
                      <button v-for="g in lv.grades" :key="g" type="button" @click="toggleGrade(g)" :aria-pressed="filterGrades.includes(g)"
                        :class="['w-9 h-8 rounded-lg border text-xs font-semibold cursor-pointer transition', filterGrades.includes(g) ? 'bg-[#006A3A] border-[#006A3A] text-white' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#006A3A]']">{{ g }}</button>
                    </div>
                  </div>
                  <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button type="button" @click="filterGrades = []" :disabled="!filterGrades.length"
                      class="text-xs font-bold text-slate-500 hover:text-red-600 disabled:opacity-40 disabled:hover:text-slate-500 disabled:cursor-not-allowed cursor-pointer">Clear</button>
                    <button type="button" @click="openMenu = ''"
                      class="px-4 py-1.5 rounded-lg bg-[#006A3A] hover:bg-[#005A31] text-white text-xs font-bold cursor-pointer">Done</button>
                  </div>
                </div>
              </div>

              <div class="lib-filter relative">
                <button type="button" @click="toggleMenu('subject')"
                  :class="['inline-flex items-center gap-2 rounded-xl border bg-white dark:bg-slate-900 px-3 py-2 text-xs transition cursor-pointer',
                    openMenu === 'subject' || filterSubject ? 'border-[#006A3A] ring-2 ring-[#006A3A]/15' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300']">
                  <span class="text-slate-500 dark:text-slate-400">{{ t('Subject') }}</span>
                  <b class="text-slate-900 dark:text-white">{{ subjectLabel }}</b>
                  <ChevronDown class="w-3.5 h-3.5 text-slate-400" />
                </button>
                <div v-if="openMenu === 'subject'" class="absolute left-0 top-full mt-2 z-40 w-60 max-h-80 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-3">
                  <button type="button" @click="pickSubject('')"
                    :class="['w-full text-left rounded-lg px-3 py-2 text-sm font-bold cursor-pointer', !filterSubject ? 'bg-emerald-50 dark:bg-emerald-500/10 text-[#006A3A] dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800']">All subjects</button>
                  <button v-for="s in subjectOptions" :key="s.slug" type="button" @click="pickSubject(s.slug)"
                    :class="['w-full text-left rounded-lg px-3 py-2 text-sm font-medium cursor-pointer mt-0.5', filterSubject === s.slug ? 'bg-emerald-50 dark:bg-emerald-500/10 text-[#006A3A] dark:text-emerald-400 font-bold' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800']">{{ s.en }}</button>
                </div>
              </div>
            </div>

            <div class="ml-auto flex flex-wrap items-center gap-2 py-2">
              <button v-if="canManage && selected.size" type="button" @click="removeSelected"
                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer">
                <Trash2 class="w-3.5 h-3.5" /> Delete {{ selected.size }} selected
              </button>
              <button v-if="search || hasFilters" type="button" @click="clearFilters"
                class="text-xs font-bold text-[#006A3A] dark:text-emerald-400 underline cursor-pointer">Clear</button>
              <div class="relative w-56">
                <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input v-model="search" type="search" :placeholder="t('Search all books')" :class="[inputCls, 'pl-9 !py-2']" />
              </div>
              <span class="text-xs font-semibold text-slate-400 whitespace-nowrap">{{ filteredItems.length }}<template v-if="filteredItems.length !== items.length"> {{ t('of') }} {{ items.length }}</template> {{ t(unitLabel) }}</span>
            </div>
          </div>

          <p v-if="listError" class="px-4 py-2 text-sm text-red-600">{{ listError }}</p>

          <!-- Bookshelf -->
          <div class="pt-6">
            <!-- Search results -->
            <p v-if="searching && !hasFilters" class="mb-5 text-sm text-slate-500 dark:text-slate-400">
              <b class="text-slate-900 dark:text-white">{{ filteredItems.length }}</b>
              {{ filteredItems.length === 1 ? 'result' : 'results' }} for
              “<b class="text-slate-900 dark:text-white">{{ search.trim() }}</b>” across all {{ items.length }} {{ unitLabel }}
            </p>

            <!-- Loading: a shelf of grey covers -->
            <div v-if="initialLoading" class="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,10rem))] gap-x-5 gap-y-6" aria-busy="true" aria-label="Loading books">
              <div v-for="n in 12" :key="n">
                <Skeleton class="aspect-[3/4] w-full !rounded-r-xl !rounded-l-md" />
                <Skeleton class="mt-2.5 h-3.5 w-11/12" />
                <Skeleton class="mt-1.5 h-3 w-2/3" />
              </div>
            </div>

            <div v-else class="space-y-8">
              <section v-for="sec in shelfSections" :key="sec.key">
                <div v-if="sec.title" class="flex items-center gap-3 mb-3">
                  <span class="w-1.5 h-6 rounded-full bg-[#ffce04]" />
                  <h3 class="text-base font-extrabold text-slate-900 dark:text-white">{{ sec.title }}</h3>
                  <span class="text-xs font-semibold text-slate-400">{{ sec.books.length }} {{ sec.books.length === 1 ? unitLabel.slice(0, -1) : unitLabel }}</span>
                  <span class="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                </div>
              <div class="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,10rem))] gap-x-5 gap-y-6">
                <article v-for="b in sec.books" :key="b.id" class="group relative">
                  <!-- Cover -->
                  <div :class="['relative aspect-[3/4] rounded-r-xl rounded-l-md overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-sm transition duration-200 group-hover:-translate-y-1.5 group-hover:shadow-lg',
                      selected.has(b.id) ? 'ring-4 ring-[#ffce04]' : editing?.id === b.id ? 'ring-4 ring-[#ffce04]/60' : '']">
                    <img v-if="b.cover_url" :src="b.cover_url" :alt="b.title" loading="lazy" class="absolute inset-0 w-full h-full object-cover" />
                    <span class="absolute left-0 inset-y-0 w-2.5 bg-[#006A3A]" />
                    <span class="absolute top-0 inset-x-0 h-1 bg-[#ffce04]" />
                    <FileText v-if="!b.cover_url" class="absolute -right-3 -bottom-3 w-20 h-20 text-slate-100 dark:text-slate-700/60" />

                    <div v-if="!b.cover_url" class="relative h-full flex flex-col justify-between pl-5 pr-2.5 pt-4 pb-2.5">
                      <p class="text-[9px] font-bold uppercase tracking-wider text-[#006A3A] dark:text-emerald-400">
                        {{ kind === 'textbook' ? (b.grade ? 'Grade ' + b.grade : 'Textbook') : kind === 'formula' ? (gradeRange(b) || 'Formula') : kindLabel[b.kind] }}
                      </p>
                      <p class="font-bold text-[13px] leading-snug line-clamp-4">{{ b.title }}</p>
                      <div class="flex items-end justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <span class="truncate">{{ b.subject_en || 'PDF' }}</span>
                        
                      </div>
                    </div>

                    <!-- Hover actions -->
                    <div class="absolute inset-0 bg-slate-900/55 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition flex items-center justify-center gap-2">
                      <router-link :to="{ name: 'LibraryReader', params: { kind, id: b.id } }" title="Read"
                        class="w-8 h-8 rounded-full bg-white text-[#006A3A] flex items-center justify-center hover:scale-110 transition"><ExternalLink class="w-4 h-4" /></router-link>
                      <button v-if="canManage" type="button" title="Edit" @click="startEdit(b)"
                        class="w-8 h-8 rounded-full bg-[#ffce04] text-[#3d3000] flex items-center justify-center hover:scale-110 transition cursor-pointer"><Pencil class="w-4 h-4" /></button>
                      <button v-if="canManage" type="button" title="Delete" @click="removeItem(b)"
                        class="w-8 h-8 rounded-full bg-white text-red-600 flex items-center justify-center hover:scale-110 transition cursor-pointer"><Trash2 class="w-4 h-4" /></button>
                    </div>

                    <!-- Select -->
                    <label v-if="canManage" :class="['absolute top-3 right-2 w-6 h-6 rounded-md bg-white/90 flex items-center justify-center cursor-pointer transition',
                        selected.has(b.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100']">
                      <input type="checkbox" :checked="selected.has(b.id)" @change="toggleRow(b.id)" class="accent-[#006A3A] w-4 h-4 cursor-pointer" />
                    </label>
                  </div>

                  <p class="mt-2.5 text-[13px] font-bold leading-snug text-slate-900 dark:text-white line-clamp-2" :title="b.title">{{ b.title }}</p>
                  <p v-if="b.subtitle" class="text-xs text-slate-600 dark:text-slate-300 truncate" :title="b.subtitle">{{ b.subtitle }}</p>
                  <p v-else class="text-xs text-slate-500 truncate" :title="b.id + '.pdf'">{{ b.id }}</p>
                  <p class="text-[11px] text-slate-400 truncate">{{ size(b.file_size) }}<template v-if="kind !== 'formula'"> · #{{ b.order_number }}</template></p>
                </article>
              </div>
              </section>
            </div>

            <div v-if="!initialLoading && !shelfItems.length" class="py-16 text-center">
              <Library class="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">{{ items.length ? 'No matches' : 'Nothing on this shelf yet' }}</p>
              <button v-if="canManage && !items.length" type="button" @click="openAdd" class="mt-2 text-sm font-bold text-[#006A3A] dark:text-emerald-400 underline cursor-pointer">Add the first one</button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      </div>
    </div>

    <!-- Add / edit drawer (slides in from the right) -->
    <Transition name="drawer">
    <div v-if="canManage && showForm" class="drawer-root fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-[2px]" @click.self="!busy && closeForm()">
      <div class="drawer-panel relative w-full max-w-md h-full flex flex-col bg-white dark:bg-slate-900 shadow-2xl">
        <CoverCropper v-if="cropFile" :file="cropFile" @done="onCropped" @cancel="cropFile = null" />
        <div :class="['px-6 py-4 flex items-center justify-between border-b', editing ? 'bg-[#ffce04]/20 border-[#ffce04]/40' : 'bg-emerald-50 dark:bg-emerald-900/10 border-slate-100 dark:border-slate-800']">
          <h3 class="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <component :is="editing ? Pencil : UploadCloud" class="w-5 h-5 text-[#006A3A] dark:text-emerald-400" />
            {{ editing ? 'Edit details' : `Add a ${addLabel}` }}
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
              <template v-if="kind === 'formula'">
                <div class="col-span-2">
                  <label :class="labelCls">Subject</label>
                  <select v-model="form.subject" :class="inputCls"><option v-for="s in options.subjects" :key="s.slug" :value="s.slug">{{ s.en }} · {{ s.km }}</option></select>
                </div>
                <div>
                  <label :class="labelCls">Grade</label>
                  <select v-model.number="form.grade_from" :class="inputCls"><option v-for="g in 12" :key="g" :value="g">Grade {{ g }}</option></select>
                </div>
                <div>
                  <label :class="labelCls">Up to grade</label>
                  <select v-model="form.grade_to" :class="inputCls"><option value="">Same grade</option><option v-for="g in 12" :key="g" :value="g" :disabled="g <= form.grade_from">Grade {{ g }}</option></select>
                </div>
                <div>
                  <label :class="labelCls">Sheet type</label>
                  <select v-model="form.qualifier" :class="inputCls"><option value="">Formulas</option><option v-for="q in options.formula_qualifiers" :key="q.slug" :value="q.slug">{{ q.en }}</option></select>
                </div>
                <div>
                  <label :class="labelCls">Source</label>
                  <select v-model="form.source" :class="inputCls"><option value="">None</option><option v-for="s in options.formula_sources" :key="s.slug" :value="s.slug">{{ s.en }}</option></select>
                </div>
                <div>
                  <label :class="labelCls">Language</label>
                  <select v-model="form.language" :class="inputCls"><option value="">None</option><option v-for="l in options.languages" :key="l" :value="l" class="capitalize">{{ l }}</option></select>
                </div>
                <div>
                  <label :class="labelCls">Version</label>
                  <input v-model.number="form.version" type="number" min="1" max="99" :class="inputCls" />
                </div>
              </template>
              <template v-else-if="kind === 'textbook'">
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

          <!-- Title (optional) -->
          <div>
            <p class="flex items-center gap-2 mb-2 text-sm font-bold text-slate-900 dark:text-white">
              <span class="w-6 h-6 rounded-full bg-[#006A3A] text-white text-xs flex items-center justify-center">3</span>
              Title <span class="text-xs font-medium text-slate-400">optional</span>
            </p>
            <div class="space-y-3">
              <div>
                <label :class="labelCls">Title</label>
                <input v-model="form.title" maxlength="200" :placeholder="editing && !editing.title_custom ? editing.title : 'Leave empty for the automatic title'" :class="inputCls" />
              </div>
              <div>
                <label :class="labelCls">Subtitle</label>
                <input v-model="form.subtitle" maxlength="200" :placeholder="editing && !editing.title_custom ? (editing.subtitle || '') : 'e.g. the English title'" :class="inputCls" />
              </div>
              <p class="text-[11px] text-slate-400">The app shows these instead of the title built from the subject and grade. Clear them to go back to the automatic one.</p>
            </div>
          </div>

          <!-- Cover (optional) -->
          <div>
            <p class="flex items-center gap-2 mb-2 text-sm font-bold text-slate-900 dark:text-white">
              <span class="w-6 h-6 rounded-full bg-[#006A3A] text-white text-xs flex items-center justify-center">4</span>
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

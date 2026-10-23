<script setup>
import { ref, watch } from 'vue'
import { ImagePlus, Plus, Trash2, Loader2, CheckCircle2, AlertCircle } from 'lucide-vue-next'
import { libraryService } from '@/services/libraryService'

// Table of contents for one textbook: photograph the contents page, let the server
// read it into a draft, correct it, save. Students only ever see what is saved here.
const props = defineProps({
  kind: { type: String, required: true },
  fileId: { type: String, required: true },
})

const items = ref([])
const pageOffset = ref(0)
const loading = ref(false)
const reading = ref(false)
const saving = ref(false)
const error = ref('')
const message = ref('')
const dirty = ref(false)
const inputRef = ref(null)

// ---- or type / paste the contents instead of reading a photo (no AI needed) ----
const pasteOpen = ref(false)
const pasteText = ref('')
const KHMER_DIGITS = '០១២៣៤៥៦៧៨៩'
const toLatin = (s) => s.replace(/[០-៩]/g, d => String(KHMER_DIGITS.indexOf(d)))

// One entry per line: "Title ........ 12". Indent a line (tab or 2+ spaces) to make it a section,
// twice for a sub-section. Khmer digits are fine.
const parsePasted = (text) => {
  const rows = []
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue
    const indent = /^[\t ]*/.exec(raw)[0].replace(/\t/g, '  ').length
    const level = Math.min(2, Math.floor(indent / 2))
    const line = raw.trim()
    const m = /^(.*?)[\s.·…_\-–—]*([0-9០-៩]{1,4})$/.exec(line)
    const title = (m ? m[1] : line).replace(/[\s.·…_]+$/, '').trim()
    if (!title) continue
    rows.push({ title, page: m ? Number(toLatin(m[2])) : null, level })
  }
  return rows
}
const usePasted = () => {
  const rows = parsePasted(pasteText.value)
  if (!rows.length) { error.value = 'Type one entry per line, like:  Limits ........ 12'; return }
  error.value = ''
  items.value = rows
  dirty.value = true
  pasteOpen.value = false
  pasteText.value = ''
  message.value = `Added ${rows.length} entries. Check them, then save.`
}

const LEVELS = [
  { v: 0, label: 'Chapter' },
  { v: 1, label: 'Section' },
  { v: 2, label: 'Sub-section' },
]

const load = async () => {
  loading.value = true; error.value = ''; message.value = ''; dirty.value = false
  try {
    const data = await libraryService.getToc(props.kind, props.fileId)
    items.value = data.items || []
    pageOffset.value = data.page_offset || 0
  } catch (e) {
    items.value = []; pageOffset.value = 0
    error.value = e.response?.data?.error || 'Could not load the table of contents.'
  } finally {
    loading.value = false
  }
}
watch(() => props.fileId, load, { immediate: true })

const markDirty = () => { dirty.value = true; message.value = '' }

const pickPhotos = async (e) => {
  const files = Array.from(e.target.files || []).slice(0, 4)
  e.target.value = ''
  if (!files.length) return
  if (files.some(f => !f.type.startsWith('image/'))) { error.value = 'Please choose photos (JPEG, PNG or WebP).'; return }
  error.value = ''; message.value = ''; reading.value = true
  try {
    const draft = await libraryService.extractToc(props.kind, props.fileId, files)
    if (!draft.length) { error.value = 'Nothing readable was found. Try a sharper, straight-on photo of the contents page.'; return }
    items.value = draft
    dirty.value = true
    message.value = `Read ${draft.length} entries. Check them against the book, fix any mistakes, then save.`
  } catch (e) {
    error.value = e.response?.data?.error || 'Could not read the photo.'
  } finally {
    reading.value = false
  }
}

const addRow = () => { items.value.push({ title: '', page: null, level: items.value.at(-1)?.level ?? 0 }); markDirty() }
const removeRow = (i) => { items.value.splice(i, 1); markDirty() }
const clearAll = () => { items.value = []; markDirty() }

const save = async () => {
  saving.value = true; error.value = ''; message.value = ''
  try {
    const rows = items.value
      .map(r => ({ title: String(r.title || '').trim(), page: r.page === '' || r.page == null ? null : Number(r.page), level: Number(r.level) || 0 }))
      .filter(r => r.title)
    const saved = await libraryService.saveToc(props.kind, props.fileId, { items: rows, page_offset: Number(pageOffset.value) || 0 })
    items.value = saved
    dirty.value = false
    message.value = saved.length ? 'Saved. The app shows these as the book\'s chapters.' : 'Removed. The app falls back to plain page parts.'
  } catch (e) {
    error.value = e.response?.data?.error || 'Could not save.'
  } finally {
    saving.value = false
  }
}

const inputCls = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#006A3A]/40'
</script>

<template>
  <div class="space-y-3">
    <p class="text-[11px] text-slate-400">
      Photograph the book's contents page (up to 4 photos). The server reads it into a list you can correct before saving.
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <button type="button" :disabled="reading" @click="inputRef?.click()"
        class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-[#006A3A] hover:text-[#006A3A] disabled:opacity-50 cursor-pointer">
        <Loader2 v-if="reading" class="w-4 h-4 animate-spin" /><ImagePlus v-else class="w-4 h-4" />
        {{ reading ? 'Reading…' : items.length ? 'Read from a new photo' : 'Read from a photo' }}
      </button>
      <button type="button" @click="pasteOpen = !pasteOpen" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
        Type or paste
      </button>
      <button type="button" @click="addRow" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#006A3A] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer">
        <Plus class="w-4 h-4" /> Add a line
      </button>
      <button v-if="items.length" type="button" @click="clearAll" class="text-xs font-bold text-red-600 hover:underline cursor-pointer">Clear all</button>
      <input ref="inputRef" type="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden" @change="pickPhotos" />
    </div>

    <div v-if="pasteOpen" class="space-y-2">
      <textarea v-model="pasteText" rows="7" :class="inputCls"
        placeholder="One entry per line, with its page number at the end:&#10;ជំពូក ១  ចំនួនកុំផ្លិច ........ ៥&#10;  ទម្រង់ពីជគណិត ........ ៨&#10;ជំពូក ២  លីមីត ........ ២០"></textarea>
      <p class="text-[11px] text-slate-400">Indent a line (a tab or two spaces) to make it a section, twice for a sub-section. Khmer digits are fine.</p>
      <button type="button" @click="usePasted" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 cursor-pointer">Turn into a list</button>
    </div>

    <p v-if="loading" class="text-xs text-slate-400">Loading…</p>

    <div v-if="items.length" class="space-y-1.5 max-h-80 overflow-y-auto pr-1">
      <div v-for="(row, i) in items" :key="i" class="flex items-center gap-1.5" :style="{ paddingLeft: row.level * 14 + 'px' }">
        <select v-model.number="row.level" @change="markDirty" :class="[inputCls, '!w-[5.6rem] shrink-0']">
          <option v-for="l in LEVELS" :key="l.v" :value="l.v">{{ l.label }}</option>
        </select>
        <input v-model="row.title" @input="markDirty" maxlength="200" placeholder="Title" :class="inputCls" />
        <input v-model.number="row.page" @input="markDirty" type="number" min="1" placeholder="Page" :class="[inputCls, '!w-16 shrink-0']" />
        <button type="button" @click="removeRow(i)" aria-label="Remove line" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"><Trash2 class="w-4 h-4" /></button>
      </div>
    </div>

    <div v-if="items.length" class="flex items-center gap-3">
      <label class="text-xs font-bold text-slate-500 shrink-0" for="toc-offset">Page offset</label>
      <input id="toc-offset" v-model.number="pageOffset" @input="markDirty" type="number" :class="[inputCls, '!w-20']" />
      <p class="text-[11px] text-slate-400">PDF page = printed page + offset. If printed page 1 is the 9th page of the PDF, enter 8.</p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <button type="button" :disabled="saving || (!dirty && !items.length)" @click="save"
        class="bg-[#006A3A] hover:bg-[#005A31] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer">
        {{ saving ? 'Saving…' : 'Save table of contents' }}
      </button>
      <span v-if="dirty" class="text-[11px] font-semibold text-amber-600">Not saved yet</span>
    </div>

    <p v-if="message" class="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
      <CheckCircle2 class="w-4 h-4 mt-0.5 shrink-0" /> {{ message }}
    </p>
    <p v-if="error" class="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
      <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" /> {{ error }}
    </p>
  </div>
</template>

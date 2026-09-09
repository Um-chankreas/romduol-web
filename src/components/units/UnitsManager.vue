<script setup>
import { ref, onMounted, computed } from 'vue'
import { unitService } from '@/services/unitService'
import { isLatexDocument, latexToMarkdown } from '@/utils/latexToMarkdown'
import MarkdownContent from '@/components/ui/MarkdownContent.vue'

const props = defineProps({
  lessonId: { type: String, required: true },
})

const emit = defineEmits(['change'])

const units = ref([])
const loading = ref(true)
const error = ref(null)
const busy = ref(false)

// ── Add / edit form ────────────────────────────────────────────────────────
const editingId = ref(null)          // null → the "add new" form
const form = ref({ title: '', content: '', is_free: false })
const showPreview = ref(false)

const resetForm = () => {
  editingId.value = null
  form.value = { title: '', content: '', is_free: false }
  showPreview.value = false
}

const startEdit = (u) => {
  editingId.value = u.id
  form.value = { title: u.title, content: u.content || '', is_free: !!u.is_free }
  showPreview.value = false
}

// ── Bulk import ────────────────────────────────────────────────────────────
const showBulk = ref(false)
const bulk = ref({ markdown: '', replace: false })

// ── LaTeX → Markdown ──────────────────────────────────────────────────────
// A whole `\documentclass … \end{document}` paste is converted to the
// Markdown the LMS stores. Fires on blur, or from the "Convert LaTeX" button.
const texNote = ref('')
const convertField = (obj, key) => {
  if (!isLatexDocument(obj[key])) return
  const { markdown, warnings } = latexToMarkdown(obj[key])
  obj[key] = markdown
  texNote.value = warnings.length
    ? `Converted from LaTeX — ${warnings.join(' ')}`
    : 'Converted from LaTeX to Markdown.'
  showPreview.value = true
  setTimeout(() => { texNote.value = '' }, 8000)
}

const load = async () => {
  loading.value = true
  error.value = null
  try {
    const res = await unitService.listUnits(props.lessonId)
    units.value = res.data?.units || []
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to load units'
  } finally {
    loading.value = false
  }
}

const saveForm = async () => {
  if (!form.value.title.trim()) return
  busy.value = true
  error.value = null
  try {
    if (editingId.value) {
      await unitService.updateUnit(editingId.value, {
        title: form.value.title.trim(),
        content: form.value.content,
        is_free: form.value.is_free,
      })
    } else {
      await unitService.createUnit({
        lesson_id: props.lessonId,
        title: form.value.title.trim(),
        content: form.value.content,
        is_free: form.value.is_free,
      })
    }
    resetForm()
    await load()
    emit('change')
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to save unit'
  } finally {
    busy.value = false
  }
}

const removeUnit = async (u) => {
  if (!confirm(`Delete unit "${u.title}"? This cannot be undone.`)) return
  busy.value = true
  error.value = null
  try {
    await unitService.deleteUnit(u.id)
    if (editingId.value === u.id) resetForm()
    await load()
    emit('change')
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to delete unit'
  } finally {
    busy.value = false
  }
}

const move = async (index, dir) => {
  const target = index + dir
  if (target < 0 || target >= units.value.length) return
  const next = units.value.slice()
  ;[next[index], next[target]] = [next[target], next[index]]
  units.value = next
  busy.value = true
  try {
    await unitService.reorderUnits(props.lessonId, next.map((u) => u.id))
    await load()
    emit('change')
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to reorder'
    await load()
  } finally {
    busy.value = false
  }
}

const runBulkImport = async () => {
  if (!bulk.value.markdown.trim()) return
  if (bulk.value.replace && !confirm('Replace ALL existing units in this chapter?')) return
  busy.value = true
  error.value = null
  try {
    const res = await unitService.bulkImport(props.lessonId, bulk.value.markdown, {
      replace: bulk.value.replace,
    })
    bulk.value = { markdown: '', replace: false }
    showBulk.value = false
    await load()
    emit('change')
    error.value = null
    imported.value = res.message || 'Imported'
    setTimeout(() => (imported.value = null), 4000)
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Import failed'
  } finally {
    busy.value = false
  }
}
const imported = ref(null)

const inputCls =
  'w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500'

onMounted(load)
</script>

<template>
  <div class="space-y-4 text-left">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h3 class="text-sm font-bold text-slate-900 dark:text-white">
        Units <span class="text-slate-400 font-medium">({{ units.length }})</span>
      </h3>
      <button
        type="button"
        class="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
        @click="showBulk = !showBulk"
      >
        {{ showBulk ? 'Close import' : 'Import Markdown' }}
      </button>
    </div>

    <p v-if="imported" class="text-xs text-emerald-700 dark:text-emerald-400">{{ imported }}</p>
    <p v-if="error" class="text-xs text-red-600">{{ error }}</p>

    <!-- Bulk import -->
    <div
      v-if="showBulk"
      class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3"
    >
      <p class="text-xs text-slate-600 dark:text-slate-400">
        Paste the whole chapter's Markdown — or a whole LaTeX document (it's
        converted on blur). Split into units on every
        <code class="text-[11px]">## </code> heading; anything above the first
        <code class="text-[11px]">## </code> is ignored.
      </p>
      <textarea
        v-model="bulk.markdown"
        rows="8"
        placeholder="## Unit 1: …&#10;&#10;Prose, **bold**, lists, and $x^2$ / $$…$$ for maths.&#10;&#10;## Unit 2: …&#10;&#10;— or paste a LaTeX .tex document"
        :class="[inputCls, 'font-mono text-xs']"
        @blur="convertField(bulk, 'markdown')"
      ></textarea>
      <p v-if="isLatexDocument(bulk.markdown)" class="text-[11px] text-amber-700 dark:text-amber-300">
        Looks like LaTeX —
        <button type="button" class="font-semibold hover:underline" @click="convertField(bulk, 'markdown')">convert to Markdown</button>
      </p>
      <p v-if="texNote" class="text-[11px] text-amber-700 dark:text-amber-300">{{ texNote }}</p>
      <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
        <input v-model="bulk.replace" type="checkbox" class="rounded" />
        Replace all existing units first
      </label>
      <div class="flex justify-end">
        <button
          type="button"
          :disabled="busy || !bulk.markdown.trim()"
          class="px-4 py-1.5 rounded-lg bg-[#033B26] hover:bg-[#022819] text-white text-xs font-bold disabled:opacity-50"
          @click="runBulkImport"
        >
          {{ busy ? 'Importing…' : 'Import units' }}
        </button>
      </div>
    </div>

    <!-- Unit list -->
    <div v-if="loading" class="text-xs text-slate-500">Loading units…</div>
    <div
      v-else-if="units.length === 0"
      class="text-xs text-slate-500 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4"
    >
      No units yet. Add one below or import a Markdown chapter.
    </div>

    <ul v-else class="space-y-2">
      <li
        v-for="(u, i) in units"
        :key="u.id"
        class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
      >
        <div class="flex items-start gap-2">
          <div class="flex flex-col items-center pt-0.5">
            <button
              type="button"
              class="text-slate-400 hover:text-slate-700 disabled:opacity-30 text-xs leading-none"
              :disabled="i === 0 || busy"
              @click="move(i, -1)"
            >▲</button>
            <span class="text-[10px] text-slate-400 my-0.5">{{ u.order_number }}</span>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-700 disabled:opacity-30 text-xs leading-none"
              :disabled="i === units.length - 1 || busy"
              @click="move(i, 1)"
            >▼</button>
          </div>

          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ u.title }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{{ u.preview }}</p>
            <div class="mt-1 flex items-center gap-2">
              <span
                v-if="u.is_free"
                class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px] font-bold uppercase"
              >Free preview</span>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              class="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-700 text-xs font-bold"
              @click="startEdit(u)"
            >Edit</button>
            <button
              type="button"
              class="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-red-600 text-xs font-bold"
              @click="removeUnit(u)"
            >Delete</button>
          </div>
        </div>
      </li>
    </ul>

    <!-- Add / edit form -->
    <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500">
          {{ editingId ? 'Edit unit' : 'Add unit' }}
        </p>
        <button
          v-if="editingId"
          type="button"
          class="text-xs text-slate-500 hover:underline"
          @click="resetForm"
        >Cancel edit</button>
      </div>

      <input v-model="form.title" type="text" placeholder="Unit title" :class="inputCls" />

      <textarea
        v-model="form.content"
        rows="6"
        placeholder="Markdown content, or paste a LaTeX document (converted on blur). History → plain prose. Maths → $x^2$ inline or $$…$$ display."
        :class="[inputCls, 'font-mono text-xs']"
        @blur="convertField(form, 'content')"
      ></textarea>
      <p v-if="isLatexDocument(form.content)" class="text-[11px] text-amber-700 dark:text-amber-300">
        Looks like LaTeX —
        <button type="button" class="font-semibold hover:underline" @click="convertField(form, 'content')">convert to Markdown</button>
      </p>
      <p v-if="texNote" class="text-[11px] text-amber-700 dark:text-amber-300">{{ texNote }}</p>

      <div class="flex items-center justify-between">
        <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
          <input v-model="form.is_free" type="checkbox" class="rounded" />
          Free preview (readable without enrolling)
        </label>
        <button
          type="button"
          class="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
          @click="showPreview = !showPreview"
        >{{ showPreview ? 'Hide preview' : 'Preview' }}</button>
      </div>

      <div
        v-if="showPreview"
        class="rounded-lg border border-dashed border-emerald-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 max-h-72 overflow-y-auto"
      >
        <MarkdownContent :source="form.content" />
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          :disabled="busy || !form.title.trim()"
          class="px-4 py-1.5 rounded-lg bg-[#033B26] hover:bg-[#022819] text-white text-xs font-bold disabled:opacity-50"
          @click="saveForm"
        >
          {{ busy ? 'Saving…' : editingId ? 'Save changes' : 'Add unit' }}
        </button>
      </div>
    </div>
  </div>
</template>

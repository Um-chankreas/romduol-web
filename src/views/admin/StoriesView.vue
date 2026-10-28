<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Plus, Pencil, Trash2, AlertCircle, X } from 'lucide-vue-next'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'
import Footer from '@/components/layout/Footer.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { storiesService } from '@/services/storiesService'
import { useLanguage } from '@/composables/useLanguage'

defineOptions({ name: 'StoriesView' })
const { t } = useLanguage()

const stories = ref([])
const loading = ref(true)
const error = ref('')

const errMsg = (e, fallback) => e.response?.data?.error || fallback
const listToText = (list) => (list || []).join(', ')
const textToList = (text) => String(text || '').split(',').map((s) => s.trim()).filter(Boolean)

const load = async () => {
  loading.value = true
  error.value = ''
  try { stories.value = await storiesService.list() } catch (e) { error.value = errMsg(e, 'Could not load stories.') } finally { loading.value = false }
}

// ---- story form (add / edit) ----
const showForm = ref(false)
const editingId = ref('') // '' = adding
const saving = ref(false)
const formError = ref('')
const emptyForm = () => ({ title_km: '', title_en: '', author: '', year: '', summary_km: '', summary_en: '', themes: '' })
const form = reactive(emptyForm())
const excerpts = ref([])

const openAdd = () => {
  editingId.value = ''
  Object.assign(form, emptyForm())
  excerpts.value = []
  formError.value = ''
  showForm.value = true
}

const openEdit = async (s) => {
  editingId.value = s.id
  Object.assign(form, {
    title_km: s.title_km || '', title_en: s.title_en || '', author: s.author || '',
    year: s.year ?? '', summary_km: s.summary_km || '', summary_en: s.summary_en || '',
    themes: listToText(s.themes),
  })
  excerpts.value = []
  formError.value = ''
  showForm.value = true
  try {
    const full = await storiesService.get(s.id)
    excerpts.value = (full.excerpts || []).map(toExcerptRow)
  } catch (e) { formError.value = errMsg(e, 'Could not load the story’s parts.') }
}

const save = async () => {
  saving.value = true
  formError.value = ''
  const body = {
    title_km: form.title_km, title_en: form.title_en, author: form.author,
    year: form.year === '' ? null : form.year,
    summary_km: form.summary_km, summary_en: form.summary_en,
    themes: textToList(form.themes),
  }
  try {
    if (editingId.value) {
      await storiesService.update(editingId.value, body)
      showForm.value = false
    } else {
      // Stay open after adding so the parts can be added straight away.
      const created = await storiesService.create(body)
      editingId.value = created.id
    }
    await load()
  } catch (e) { formError.value = errMsg(e, 'Could not save the story.') } finally { saving.value = false }
}

const removeStory = async (s) => {
  if (!window.confirm(`${t('Delete')} “${s.title_km}”? ${t('Its parts will be deleted too.')}`)) return
  try { await storiesService.remove(s.id); await load() } catch (e) { error.value = errMsg(e, 'Could not delete the story.') }
}

// ---- parts (excerpts) of the story being edited ----
const toExcerptRow = (x) => ({ id: x.id, label: x.label, excerpt_km: x.excerpt_km, topics: listToText(x.usable_for_topics), order_number: x.order_number ?? 0, busy: false, error: '' })
const newExcerpt = ref({ label: '', excerpt_km: '', topics: '' })
const addingExcerpt = ref(false)

const addExcerpt = async () => {
  addingExcerpt.value = true
  formError.value = ''
  try {
    const x = await storiesService.addExcerpt(editingId.value, {
      label: newExcerpt.value.label,
      excerpt_km: newExcerpt.value.excerpt_km,
      usable_for_topics: textToList(newExcerpt.value.topics),
      order_number: excerpts.value.length + 1,
    })
    excerpts.value.push(toExcerptRow(x))
    newExcerpt.value = { label: '', excerpt_km: '', topics: '' }
  } catch (e) { formError.value = errMsg(e, 'Could not add the part.') } finally { addingExcerpt.value = false }
}

const saveExcerpt = async (x) => {
  x.busy = true
  x.error = ''
  try {
    await storiesService.updateExcerpt(editingId.value, x.id, {
      label: x.label, excerpt_km: x.excerpt_km, usable_for_topics: textToList(x.topics), order_number: x.order_number,
    })
  } catch (e) { x.error = errMsg(e, 'Could not save the part.') } finally { x.busy = false }
}

const removeExcerpt = async (x) => {
  if (!window.confirm(`${t('Delete')} “${x.label}”?`)) return
  try {
    await storiesService.removeExcerpt(editingId.value, x.id)
    excerpts.value = excerpts.value.filter((e) => e.id !== x.id)
  } catch (e) { x.error = errMsg(e, 'Could not delete the part.') }
}

const input = 'mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#006A3A]'
const label = 'block text-xs font-bold text-slate-700 dark:text-slate-200'

onMounted(load)
</script>

<template>
  <div class="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0 min-h-0">
      <Header>
        <template #left>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white truncate">{{ t('Khmer Stories') }}</h1>
        </template>
      </Header>

      <div class="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <main class="p-4 sm:p-8 flex-1 w-full max-w-5xl space-y-6">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 class="text-2xl font-extrabold leading-tight text-slate-900 dark:text-white">{{ t('Khmer stories') }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">{{ t('Famous stories with author and year. Split each into parts and tag the essay topics a part works as an example for — students pick from this in the app.') }}</p>
            </div>
            <button type="button" @click="openAdd"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006A3A] hover:bg-[#005A31] text-white text-sm font-bold cursor-pointer">
              <Plus class="w-4 h-4" /> {{ t('Add story') }}
            </button>
          </div>

          <p v-if="error" class="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" /> {{ error }}
          </p>

          <div v-if="loading" class="space-y-3">
            <Skeleton v-for="i in 3" :key="i" class="h-20 w-full" />
          </div>
          <p v-else-if="!stories.length && !error" class="text-sm text-slate-400">{{ t('No stories yet. Add the first one.') }}</p>

          <ul v-else class="space-y-3">
            <li v-for="s in stories" :key="s.id"
              class="flex items-start justify-between gap-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-5 py-4">
              <div class="min-w-0">
                <p class="font-extrabold text-slate-900 dark:text-white">{{ s.title_km }}</p>
                <p v-if="s.title_en" class="text-sm text-slate-500 dark:text-slate-400">{{ s.title_en }}</p>
                <p class="text-xs text-slate-400 mt-1">
                  <span v-if="s.author">{{ s.author }}</span><span v-if="s.author && s.year"> · </span><span v-if="s.year">{{ s.year }}</span>
                </p>
                <div v-if="s.themes && s.themes.length" class="flex flex-wrap gap-1.5 mt-2">
                  <span v-for="th in s.themes" :key="th" class="px-2 py-0.5 rounded-full bg-[#006A3A]/10 text-[#006A3A] dark:text-emerald-300 text-[11px] font-bold">{{ th }}</span>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" @click="openEdit(s)" :aria-label="t('Edit')"
                  class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><Pencil class="w-4 h-4" /></button>
                <button type="button" @click="removeStory(s)" :aria-label="t('Delete')"
                  class="p-2 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"><Trash2 class="w-4 h-4" /></button>
              </div>
            </li>
          </ul>
        </main>
        <Footer />
      </div>
    </div>

    <!-- Add / edit story -->
    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showForm = false">
      <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-extrabold text-slate-900 dark:text-white">{{ editingId ? t('Edit story') : t('Add story') }}</h3>
          <button type="button" @click="showForm = false" :aria-label="t('Close')" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X class="w-4 h-4" /></button>
        </div>

        <form class="space-y-3" @submit.prevent="save">
          <label :class="label">{{ t('Title (Khmer)') }}
            <input v-model="form.title_km" required :class="input" />
          </label>
          <label :class="label">{{ t('Title (English)') }}
            <input v-model="form.title_en" :class="input" />
          </label>
          <div class="grid sm:grid-cols-2 gap-3">
            <label :class="label">{{ t('Author') }}
              <input v-model="form.author" :class="input" />
            </label>
            <label :class="label">{{ t('Year') }}
              <input v-model="form.year" type="number" :class="input" />
            </label>
          </div>
          <label :class="label">{{ t('Summary (Khmer)') }}
            <textarea v-model="form.summary_km" rows="3" :class="input" />
          </label>
          <label :class="label">{{ t('Summary (English)') }}
            <textarea v-model="form.summary_en" rows="3" :class="input" />
          </label>
          <label :class="label">{{ t('Themes (comma-separated)') }}
            <input v-model="form.themes" :class="input" placeholder="family, honesty, nature" />
          </label>

          <p v-if="formError" class="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" /> {{ formError }}
          </p>
          <div class="flex justify-end gap-2">
            <button type="button" @click="showForm = false" :disabled="saving"
              class="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">{{ editingId ? t('Close') : t('Cancel') }}</button>
            <button type="submit" :disabled="saving"
              class="px-5 py-2 rounded-xl bg-[#006A3A] hover:bg-[#005A31] disabled:opacity-50 text-white text-sm font-bold cursor-pointer">{{ saving ? t('Saving…') : editingId ? t('Save changes') : t('Add story') }}</button>
          </div>
        </form>

        <!-- Parts of the story: only once the story exists -->
        <div v-if="editingId" class="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
          <h4 class="text-sm font-extrabold text-slate-900 dark:text-white">{{ t('Parts of the story') }}</h4>

          <div v-for="x in excerpts" :key="x.id" class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
            <input v-model="x.label" :class="input" :placeholder="t('Label, e.g. Beginning, Climax')" />
            <textarea v-model="x.excerpt_km" rows="3" :class="input" :placeholder="t('Text of this part (Khmer)')" />
            <input v-model="x.topics" :class="input" :placeholder="t('Essay topics this part fits (comma-separated)')" />
            <p v-if="x.error" class="text-xs text-red-600">{{ x.error }}</p>
            <div class="flex justify-end gap-2">
              <button type="button" @click="removeExcerpt(x)" class="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer">{{ t('Delete') }}</button>
              <button type="button" @click="saveExcerpt(x)" :disabled="x.busy"
                class="px-3 py-1.5 rounded-lg bg-[#006A3A] hover:bg-[#005A31] disabled:opacity-50 text-white text-xs font-bold cursor-pointer">{{ x.busy ? t('Saving…') : t('Save part') }}</button>
            </div>
          </div>

          <form class="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-3 space-y-2" @submit.prevent="addExcerpt">
            <input v-model="newExcerpt.label" required :class="input" :placeholder="t('Label, e.g. Beginning, Climax')" />
            <textarea v-model="newExcerpt.excerpt_km" required rows="3" :class="input" :placeholder="t('Text of this part (Khmer)')" />
            <input v-model="newExcerpt.topics" :class="input" :placeholder="t('Essay topics this part fits (comma-separated)')" />
            <div class="flex justify-end">
              <button type="submit" :disabled="addingExcerpt"
                class="px-3 py-1.5 rounded-lg bg-[#006A3A] hover:bg-[#005A31] disabled:opacity-50 text-white text-xs font-bold cursor-pointer">{{ addingExcerpt ? t('Saving…') : t('Add part') }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

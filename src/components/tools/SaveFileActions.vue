<script setup>
import { ref } from 'vue'
import { FolderDown, Download, Check } from 'lucide-vue-next'

// "Save as…" (pick a folder + name) and plain "Download" for a result held in
// an object URL. Save as uses the File System Access API, which only
// Chromium browsers (Chrome, Edge, Opera) have — elsewhere just the Download
// button shows, and the browser's own download settings decide the folder.
const props = defineProps({
  url: { type: String, required: true },
  name: { type: String, required: true },
})

const canPickFolder = typeof window !== 'undefined' && 'showSaveFilePicker' in window
const saving = ref(false)
const savedAs = ref('')
const error = ref('')

const MIME = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/x-m4v', '.mkv': 'video/x-matroska', '.zip': 'application/zip' }

const download = () => {
  const a = document.createElement('a')
  a.href = props.url
  a.download = props.name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const saveAs = async () => {
  error.value = ''
  const ext = (props.name.match(/\.[^.]+$/)?.[0] || '').toLowerCase()
  let handle
  try {
    // Open the picker before any await — it needs the click's user activation.
    handle = await window.showSaveFilePicker({
      suggestedName: props.name,
      types: MIME[ext] ? [{ description: ext.slice(1).toUpperCase() + ' file', accept: { [MIME[ext]]: [ext] } }] : undefined,
    })
  } catch (err) {
    if (err?.name !== 'AbortError') error.value = 'Couldn’t open the save dialog — use Download instead.'
    return
  }
  saving.value = true
  try {
    const blob = await (await fetch(props.url)).blob()
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    savedAs.value = handle.name
  } catch {
    error.value = 'Saving failed — try again or use Download.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      v-if="canPickFolder"
      type="button"
      :disabled="saving"
      class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#006A3A] hover:bg-[#005A31] text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
      @click="saveAs"
    >
      <FolderDown class="w-4 h-4" /> {{ saving ? 'Saving…' : 'Save as…' }}
    </button>
    <button
      type="button"
      class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
      @click="download"
    >
      <Download class="w-4 h-4" /> Download
    </button>
    <span v-if="savedAs" class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
      <Check class="w-3.5 h-3.5" /> Saved as {{ savedAs }}
    </span>
    <span v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</span>
  </div>
</template>

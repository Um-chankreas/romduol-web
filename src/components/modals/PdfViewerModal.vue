<template>
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
    @click.self="$emit('close')"
  >
    <div class="w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
        <div class="flex items-center gap-3 min-w-0">
          <span class="text-xl">📄</span>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white truncate">
            {{ pdf?.file_name || pdf?.title || 'Lesson Document' }}
          </h3>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button 
            @click="$emit('download', pdf)" 
            class="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Download / Open
          </button>
          <button 
            @click="$emit('close')" 
            class="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition cursor-pointer"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <div class="flex-1 bg-slate-100 dark:bg-slate-950 relative flex items-center justify-center">
        <iframe 
          v-if="pdf?.file_url" 
          :src="pdf.file_url" 
          class="w-full h-full border-none"
          title="PDF Document Viewer"
        ></iframe>
        <div v-else class="text-xs text-slate-500">
          Unable to load preview. Try using the Download/Open button.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  pdf: { type: Object, default: null }
})

defineEmits(['close', 'download'])
</script>
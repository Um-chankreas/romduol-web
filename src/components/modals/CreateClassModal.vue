<template>
  <!-- Backdrop -->
  <transition name="fade">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      @click="requestClose()"
    ></div>
  </transition>

  <!-- Drawer -->
  <transition name="drawer">
    <aside
      v-if="visible"
      class="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 shadow-2xl"
      role="dialog"
      aria-modal="true"
    >
      <!-- Header -->
      <header class="shrink-0 flex items-center justify-between px-5 sm:px-6 h-16 border-b border-slate-200/80 dark:border-slate-800">
        <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          {{ isEdit ? 'Edit class' : 'Add new class' }}
        </h2>
        <button
          type="button"
          @click="requestClose()"
          class="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </header>

      <!-- Scrollable body -->
      <div class="flex-1 overflow-y-auto custom-scrollbar px-5 sm:px-6 py-5 space-y-7 text-left">
        <!-- Live preview -->
        <div
          class="relative w-full h-20 rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 flex items-center px-4"
          :style="{ backgroundColor: color }"
        >
          <span class="text-2xl mr-3 drop-shadow">{{ icon }}</span>
          <span class="text-white font-bold truncate drop-shadow">{{ title || 'Class title' }}</span>
        </div>

        <!-- ── Basic info ─────────────────────────────────────────── -->
        <section class="space-y-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Basic info</p>

          <div>
            <label :class="labelCls">Class title <span class="text-red-500">*</span></label>
            <input v-model="title" type="text" placeholder="e.g. Calculus 101" :disabled="creating" :class="inputCls" />
          </div>

          <div>
            <label :class="labelCls">Description</label>
            <textarea v-model="description" rows="2" placeholder="What will students learn?" :disabled="creating" :class="[inputCls, 'resize-none']"></textarea>
          </div>

          <div>
            <label :class="labelCls">Category</label>
            <input v-model="category" type="text" placeholder="e.g. Mathematics, Grade 10" :disabled="creating" :class="inputCls" />
          </div>
        </section>

        <!-- ── Appearance ────────────────────────────────────────── -->
        <section class="space-y-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Appearance</p>

          <div>
            <label :class="labelCls">Select icon</label>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                v-for="i in iconOptions"
                :key="i"
                type="button"
                @click="icon = i"
                :class="[
                  'w-9 h-9 rounded-full border-2 grid place-items-center text-base transition shrink-0',
                  icon === i ? 'border-amber-600 scale-105 bg-amber-50 dark:bg-amber-900/20' : 'border-slate-200 dark:border-slate-700 hover:scale-105',
                ]"
              >{{ i }}</button>
            </div>
          </div>

          <div>
            <label :class="labelCls">Select theme color</label>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                v-for="c in themeColors"
                :key="c"
                type="button"
                @click="color = c"
                :class="[
                  'w-8 h-8 rounded-full border-2 grid place-items-center transition shrink-0',
                  color === c ? 'border-amber-600 scale-105 shadow-sm' : 'border-slate-300 dark:border-slate-700 hover:scale-105',
                ]"
                :style="{ backgroundColor: c }"
              >
                <svg v-if="color === c" class="w-4 h-4 text-white stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              </button>
            </div>
          </div>
        </section>

        <!-- ── Access settings ───────────────────────────────────── -->
        <section class="space-y-3">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Access settings</p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="isFree = true"
              :disabled="creating"
              :class="['flex-1 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition', isFree ? accessOn : accessOff]"
            >🎁 Free</button>
            <button
              type="button"
              @click="isFree = false"
              :disabled="creating"
              :class="['flex-1 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition', !isFree ? accessOn : accessOff]"
            >💳 Paid</button>
          </div>
        </section>

        <!-- ── Add chapters (create only) ────────────────────────── -->
        <section v-if="!isEdit" class="space-y-3">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Add chapters <span class="normal-case font-medium text-slate-400">(optional)</span>
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400 -mt-1">
            Give the class its first chapters (ជំពូក). You add each chapter's units afterwards.
          </p>

          <div v-for="(ch, i) in chapters" :key="i" class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-400 w-5 shrink-0">{{ i + 1 }}.</span>
            <input
              v-model="chapters[i]"
              type="text"
              :placeholder="`Chapter ${i + 1} title`"
              :disabled="creating"
              :class="inputCls"
            />
            <button
              type="button"
              class="text-slate-400 hover:text-red-500 text-sm shrink-0 px-1"
              @click="chapters.splice(i, 1)"
              aria-label="Remove chapter"
            >✕</button>
          </div>

          <button
            type="button"
            class="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
            @click="chapters.push('')"
          >+ Add chapter</button>
        </section>

        <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
      </div>

      <!-- Footer -->
      <footer class="shrink-0 border-t border-slate-200/80 dark:border-slate-800 px-5 sm:px-6 py-4 flex items-center justify-end gap-2.5">
        <button
          type="button"
          @click="requestClose()"
          :disabled="creating"
          class="px-4 py-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-sm font-semibold transition disabled:opacity-50"
        >
          Cancel
        </button>

        <template v-if="isEdit">
          <button
            type="button"
            @click="submit(false)"
            :disabled="creating || !title.trim()"
            class="px-5 py-2 rounded-full bg-[#006A3A] hover:bg-[#005A31] text-white text-sm font-bold transition disabled:opacity-50"
          >
            {{ creating ? 'Saving…' : 'Save changes' }}
          </button>
        </template>

        <template v-else>
          <button
            type="button"
            @click="submit(false)"
            :disabled="creating || !title.trim()"
            class="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold transition disabled:opacity-50"
          >
            {{ creating ? 'Creating…' : 'Create' }}
          </button>
          <button
            type="button"
            @click="submit(true)"
            :disabled="creating || !title.trim()"
            class="px-5 py-2 rounded-full bg-[#006A3A] hover:bg-[#005A31] text-white text-sm font-bold transition disabled:opacity-50"
          >
            Create &amp; add lessons →
          </button>
        </template>
      </footer>
    </aside>
  </transition>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  creating: { type: Boolean, default: false },
  error: { type: String, default: '' },
  // When provided, the drawer switches to edit mode and prefills these values.
  course: { type: Object, default: null },
})

const emit = defineEmits(['close', 'create', 'save'])

const visible = ref(false)
onMounted(() => requestAnimationFrame(() => { visible.value = true }))

// Play the slide-out before the parent unmounts us.
const requestClose = () => {
  if (props.creating) return
  visible.value = false
  setTimeout(() => emit('close'), 280)
}

const onKey = (e) => { if (e.key === 'Escape') requestClose() }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const isEdit = computed(() => !!props.course)

const title = ref('')
const description = ref('')
const category = ref('')
const icon = ref('📚')
const color = ref('#006A3A')
const isFree = ref(false)
const chapters = ref([''])

watch(
  () => props.course,
  (c) => {
    title.value = c?.title || ''
    description.value = c?.description || ''
    category.value = c?.category || ''
    icon.value = c?.icon || '📚'
    color.value = c?.color || '#006A3A'
    isFree.value = !!c?.is_free
  },
  { immediate: true },
)

const iconOptions = ['📚', '🧮', '🔬', '🎨', '💻', '🌍', '📐', '✏️', '🎵', '⚗️']
const themeColors = ['#006A3A', '#80B3FF', '#4CAF50', '#E91E63', '#FF9800', '#00BCD4', '#9C27B0', '#2196F3', '#9E9E9E']

const labelCls = 'block text-xs font-medium text-slate-800 dark:text-slate-300 mb-1.5'
const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm'
const accessOn = 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300'
const accessOff = 'border-slate-200 dark:border-slate-700 text-slate-500'

const submit = (openAfter) => {
  if (!title.value.trim()) return
  const payload = {
    title: title.value.trim(),
    description: description.value.trim(),
    category: category.value.trim(),
    color: color.value,
    icon: icon.value,
    is_free: isFree.value,
  }
  if (isEdit.value) {
    emit('save', { id: props.course.id, ...payload })
  } else {
    emit('create', {
      ...payload,
      chapters: chapters.value.map((t) => t.trim()).filter(Boolean),
      openAfter,
    })
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.drawer-enter-active, .drawer-leave-active { transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1); }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }
</style>

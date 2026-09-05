<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'
import MarkdownContent from '@/components/ui/MarkdownContent.vue'
import UnitsManager from '@/components/units/UnitsManager.vue'
import UnitPractice from '@/components/units/UnitPractice.vue'
import UnitQuizEditor from '@/components/units/UnitQuizEditor.vue'
import { unitService } from '@/services/unitService'
import { lessonService } from '@/services/lessonService'
import { authService } from '@/services/authService'

defineOptions({ name: 'LessonView' })

const route = useRoute()
const router = useRouter()

const lessonId = computed(() => route.params.lessonId)
const currentUser = authService.getCurrentUser()
const isTeacher = currentUser?.role === 'teacher'

const chapter = ref(null)
const courseAccess = ref(false)
const units = ref([])
const loading = ref(true)
const error = ref(null)

const selectedId = ref(null)
const selected = computed(() => units.value.find((u) => u.id === selectedId.value) || null)

const manageMode = ref(false)

const markingComplete = ref(false)
const completed = ref(false)

const load = async ({ silent = false } = {}) => {
  if (!silent) {
    loading.value = true
    error.value = null
  }
  try {
    const res = await unitService.listUnits(lessonId.value)
    chapter.value = res.data?.chapter || null
    courseAccess.value = !!res.data?.course_access
    units.value = res.data?.units || []
    if (!selectedId.value || !units.value.some((u) => u.id === selectedId.value)) {
      selectedId.value = units.value[0]?.id || null
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to load chapter'
  } finally {
    loading.value = false
  }
}

const selectUnit = async (u) => {
  selectedId.value = u.id
  // The list response already carries `content` for unlocked units; only
  // fetch the single unit if we somehow don't have it yet.
  if (u.content == null && !u.locked) {
    try {
      const res = await unitService.getUnit(u.id)
      const full = res.data?.unit
      if (full) {
        const i = units.value.findIndex((x) => x.id === u.id)
        if (i !== -1) units.value[i] = { ...units.value[i], content: full.content }
      }
    } catch { /* leave the preview showing */ }
  }
}

const markComplete = async () => {
  markingComplete.value = true
  try {
    await lessonService.markLessonComplete(lessonId.value)
    completed.value = true
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to mark complete'
  } finally {
    markingComplete.value = false
  }
}

const goBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/')
}

watch(lessonId, () => {
  selectedId.value = null
  load()
})
onMounted(load)
</script>

<template>
  <div class="flex h-screen bg-[#f8fafd] dark:bg-slate-950 overflow-hidden transition-colors">
    <Sidebar class="hidden md:flex shrink-0 h-full" />

    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <Header class="shrink-0" />

      <main class="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
        <div class="w-full max-w-6xl mx-auto flex flex-col gap-6">
          <div class="flex items-center justify-between">
            <button
              @click="goBack"
              class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold border border-slate-200/80 dark:border-slate-800 transition active:scale-95"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <button
              v-if="isTeacher && courseAccess"
              @click="manageMode = !manageMode"
              class="px-4 py-2 rounded-xl text-xs font-bold border transition active:scale-95"
              :class="manageMode
                ? 'bg-[#033B26] text-white border-[#033B26]'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'"
            >
              {{ manageMode ? 'Done managing' : 'Manage units' }}
            </button>
          </div>

          <div v-if="loading" class="text-center py-20 text-slate-500 dark:text-slate-400 font-medium">
            Loading chapter…
          </div>
          <div v-else-if="error" class="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm">{{ error }}</div>

          <template v-else>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {{ chapter?.course?.title || 'Chapter' }}
              </p>
              <h1 class="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-200">
                {{ chapter?.title }}
              </h1>
            </div>

            <!-- Teacher management -->
            <div
              v-if="manageMode"
              class="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
            >
              <UnitsManager :lesson-id="lessonId" @change="load({ silent: true })" />
            </div>

            <!-- Reader -->
            <div v-else class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
              <!-- Unit list -->
              <aside class="lg:sticky lg:top-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2">
                <p v-if="units.length === 0" class="p-3 text-xs text-slate-500 italic">
                  No units in this chapter yet.
                </p>
                <ul class="space-y-0.5">
                  <li v-for="u in units" :key="u.id">
                    <button
                      type="button"
                      @click="selectUnit(u)"
                      class="w-full text-left px-3 py-2 rounded-lg text-[13px] leading-snug transition flex items-start gap-2"
                      :class="selectedId === u.id
                        ? 'bg-emerald-50 dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'"
                    >
                      <span class="text-slate-400 shrink-0">{{ u.order_number }}.</span>
                      <span class="flex-1 min-w-0">{{ u.title }}</span>
                      <span v-if="u.locked" class="shrink-0" title="Locked">🔒</span>
                    </button>
                  </li>
                </ul>
              </aside>

              <!-- Selected unit -->
              <article class="min-w-0 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
                <template v-if="selected">
                  <h2 class="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">{{ selected.title }}</h2>

                  <MarkdownContent v-if="selected.content != null" :source="selected.content" />

                  <div v-if="selected.content == null" class="space-y-4">
                    <p class="text-sm text-slate-600 dark:text-slate-400">{{ selected.preview }}…</p>
                    <div class="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                      🔒 Enrol in this course to read the full unit.
                    </div>
                  </div>

                  <!-- Unit practice quiz — students take it, teachers manage it -->
                  <div
                    v-if="selected.content != null && courseAccess"
                    class="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800"
                  >
                    <UnitQuizEditor
                      v-if="isTeacher"
                      :key="'m-' + selected.id"
                      :unit-id="selected.id"
                      :unit-title="selected.title"
                      :course-id="chapter?.course?.id"
                      :lesson-id="lessonId"
                    />
                    <UnitPractice v-else :key="selected.id" :unit-id="selected.id" />
                  </div>

                  <div
                    v-if="courseAccess && !isTeacher && units.length > 0"
                    class="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800"
                  >
                    <button
                      :disabled="markingComplete || completed"
                      @click="markComplete"
                      class="px-5 py-2.5 rounded-xl bg-[#033B26] hover:bg-[#022819] text-white text-xs font-bold disabled:opacity-50 transition active:scale-95"
                    >
                      {{ completed ? '✓ Chapter completed' : markingComplete ? 'Saving…' : 'Mark chapter complete' }}
                    </button>
                  </div>
                </template>
                <p v-else class="text-sm text-slate-500 italic">Select a unit to start reading.</p>
              </article>
            </div>
          </template>
        </div>
      </main>
    </div>
  </div>
</template>

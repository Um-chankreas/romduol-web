<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BookOpen, ChevronDown, ChevronRight, Check, Lock, Gift, Star, Trophy, Flame, Plus, ArrowRight } from 'lucide-vue-next'
import StudentShell from '@/components/layout/StudentShell.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { studentLearningService } from '@/services/studentLearningService'
import { courseService } from '@/services/courseService'
import { useLanguage } from '@/composables/useLanguage'

defineOptions({ name: 'StudentClassView' })

const route = useRoute()
const router = useRouter()
const { t } = useLanguage()

// ───────── data ─────────
const courses = ref([])                 // enrolled courses
const pathByCourse = ref({})            // courseId -> { progress, nodes (chapters + chests) }
const open = ref({})                    // courseId -> expanded in the Subjects list
const streak = ref(0)
const loading = ref(true)
const error = ref('')

const selectedLessonId = ref(null)
const lessonPath = ref(null)            // GET /lessons/:id/path for the selected chapter
const pathLoading = ref(false)

const chaptersOf = (courseId) => (pathByCourse.value[courseId]?.nodes || []).filter(n => n.type === 'lesson')
const courseOfLesson = (lessonId) => courses.value.find(c => chaptersOf(c.id).some(l => l.id === lessonId))
const currentChapter = (courseId) => {
  const ch = chaptersOf(courseId)
  return ch.find(l => l.status === 'current') || ch.find(l => l.status !== 'completed' && l.status !== 'locked') || ch[0] || null
}

const loadAll = async () => {
  try {
    // The Home summary lists only the classes this student is enrolled in
    // (GET /courses returns every course, so it can't be used for this).
    const home = await studentLearningService.getHome()
    courses.value = (home.courses || []).map(c => ({ id: c.course_id, title: c.title, color: c.color, icon: c.icon }))
    const paths = await Promise.all(courses.value.map(c => studentLearningService.getCoursePath(c.id).catch(() => null)))
    const map = {}
    courses.value.forEach((c, i) => { if (paths[i]) map[c.id] = paths[i] })
    pathByCourse.value = map
    streak.value = home.streak || 0
    courses.value.forEach(c => { open.value[c.id] = true })

    // Land on the course from the URL (or the first one), at its current chapter.
    const wanted = route.params.courseId && courses.value.some(c => c.id === route.params.courseId) ? route.params.courseId : courses.value[0]?.id
    const start = wanted ? currentChapter(wanted) : null
    if (start) selectedLessonId.value = start.id
  } catch (e) {
    error.value = e.response?.data?.error || 'Could not load your classes.'
  } finally {
    loading.value = false
  }
}
onMounted(loadAll)

const loadLessonPath = async (id) => {
  if (!id) { lessonPath.value = null; return }
  pathLoading.value = true
  try {
    lessonPath.value = await studentLearningService.getLessonPath(id)
  } catch (e) {
    error.value = e.response?.data?.error || 'Could not load this chapter.'
    lessonPath.value = null
  } finally {
    pathLoading.value = false
  }
}
watch(selectedLessonId, loadLessonPath)

const selectedCourse = computed(() => (selectedLessonId.value ? courseOfLesson(selectedLessonId.value) : null))
const selectedChapter = computed(() => chaptersOf(selectedCourse.value?.id).find(l => l.id === selectedLessonId.value) || null)

// ───────── Subjects (left) ─────────
const done = (courseId) => chaptersOf(courseId).filter(l => l.status === 'completed').length
const pct = (courseId) => pathByCourse.value[courseId]?.progress?.percentage ?? 0

// ───────── Path (right) ─────────
const H = 220                                    // vertical space per step
const WIDTH = 360
const X = { left: 120, right: 240 }              // centres of the two lanes
const cx = (i) => (i % 2 === 0 ? X.right : X.left)
const nodes = computed(() => lessonPath.value?.nodes || [])
const progress = computed(() => lessonPath.value?.progress)

// "LESSON n" numbers count only the reading steps.
const lessonNo = computed(() => {
  let n = 0
  return nodes.value.map(x => (x.type === 'unit' || x.type === 'lesson' ? ++n : null))
})
const isPractice = (n) => n.type === 'unit_quiz' || n.type === 'lesson_quiz'
const cleanTitle = (n) => (n.title || '').replace(/\s+[—-]\s+Practice$/i, '')

const connectorPath = (i) => {
  const a = cx(i), b = cx(i + 1), y0 = 38, y1 = H + 38
  return `M ${a} ${y0} C ${a} ${y0 + H * 0.55}, ${b} ${y1 - H * 0.55}, ${b} ${y1}`
}
const connectorColor = (n) => (n.status === 'completed' || n.status === 'claimed' ? '#a932bd' : n.status === 'locked' ? '#d5dcd8' : '#c9a0d1')

const go = (n) => {
  if (n.status === 'locked' || n.type === 'chest') return
  const lessonId = n.lesson_id || n.id
  router.push({ path: `/lessons/${lessonId}`, query: n.unit_id ? { unit: n.unit_id } : {} })
}

const toast = ref('')
const claiming = ref(false)
const claim = async (n) => {
  if (n.status !== 'unlocked' || claiming.value) return
  claiming.value = true
  try {
    const courseId = selectedCourse.value?.id
    const res = await studentLearningService.claimChest(courseId, n.chest_index)
    toast.value = `+${res?.xp_awarded ?? ''} XP`
    setTimeout(() => { toast.value = '' }, 2500)
    pathByCourse.value[courseId] = await studentLearningService.getCoursePath(courseId)
    await loadLessonPath(selectedLessonId.value)
  } catch (e) {
    error.value = e.response?.data?.error || 'Could not claim that chest.'
  } finally {
    claiming.value = false
  }
}

// ───────── join a class ─────────
const code = ref('')
const joining = ref(false)
const joinError = ref('')
const join = async () => {
  if (!code.value.trim() || joining.value) return
  joining.value = true
  joinError.value = ''
  try {
    await courseService.joinCourseByCode(code.value.trim())
    code.value = ''
    loading.value = true
    await loadAll()
  } catch (e) {
    joinError.value = e.response?.data?.error || 'Could not join that class.'
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <StudentShell :breadcrumb="[{ label: 'Class' }]">
    <p v-if="error" class="mb-5 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{{ error }}</p>

    <div class="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <!-- ───────── Subjects ───────── -->
      <aside class="min-w-0">
        <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ t('Subjects') }}</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{{ t('Pick a lesson to open its path') }}</p>

        <div class="mt-5 space-y-4">
          <template v-if="loading"><Skeleton v-for="n in 2" :key="n" class="h-44 !rounded-2xl" /></template>

          <template v-else>
          <section v-for="c in courses" :key="c.id" class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4">
            <button type="button" class="w-full flex items-center gap-3 text-left cursor-pointer" @click="open[c.id] = !open[c.id]">
              <span class="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0" :style="{ backgroundColor: c.color || '#006A3A' }"><BookOpen class="w-5 h-5" /></span>
              <span class="min-w-0 flex-1">
                <span class="block font-extrabold text-slate-900 dark:text-white leading-snug">{{ c.title }}</span>
                <span class="block text-xs text-slate-500 mt-0.5">{{ chaptersOf(c.id).length }} {{ t('lessons') }} · {{ done(c.id) }} {{ t('done') }}</span>
              </span>
              <span class="rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 px-2.5 py-1 shrink-0">{{ pct(c.id) }}%</span>
              <ChevronDown :class="['w-4 h-4 text-slate-400 shrink-0 transition-transform', open[c.id] ? 'rotate-180' : '']" />
            </button>
            <div class="mt-3 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="h-full rounded-full bg-[#006A3A]" :style="{ width: pct(c.id) + '%' }" /></div>

            <ul v-if="open[c.id]" class="mt-2">
              <li v-for="l in chaptersOf(c.id)" :key="l.id">
                <button type="button" :disabled="l.status === 'locked'" @click="selectedLessonId = l.id"
                  :class="['w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition',
                    l.id === selectedLessonId ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800',
                    l.status === 'locked' ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer']">
                  <!-- done = bloom logo, otherwise a numbered ring -->
                  <svg v-if="l.status === 'completed'" viewBox="0 0 24 24" class="w-7 h-7 shrink-0"><circle cx="12" cy="7" r="4.6" fill="#f5b335" /><circle cx="7" cy="15.5" r="4.6" fill="#ffce04" /><circle cx="17" cy="15.5" r="4.6" fill="#e0a21f" /></svg>
                  <span v-else class="w-7 h-7 rounded-full border-2 border-[#006A3A] text-[#006A3A] dark:text-emerald-400 dark:border-emerald-400 text-xs font-extrabold flex items-center justify-center shrink-0">
                    <Lock v-if="l.status === 'locked'" class="w-3 h-3" /><template v-else>{{ l.order_number }}</template>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-bold text-slate-900 dark:text-white leading-snug">{{ l.title }}</span>
                    <span v-if="l.status === 'completed'" class="flex gap-0.5 mt-0.5"><Star v-for="s in 3" :key="s" :class="['w-3 h-3', s <= l.stars ? 'text-[#f5b335] fill-[#f5b335]' : 'text-slate-300 dark:text-slate-700 fill-slate-200 dark:fill-slate-700']" /></span>
                    <span v-else-if="l.status === 'current'" class="block text-xs font-bold text-[#006A3A] dark:text-emerald-400 mt-0.5">{{ t('You are here') }}</span>
                  </span>
                  <ChevronRight v-if="l.id !== selectedLessonId" class="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              </li>
            </ul>
          </section>
          </template>

          <p v-if="!loading && !courses.length" class="text-sm text-slate-500">{{ t('No classes yet. Enter a class code below to join one.') }}</p>
        </div>

        <!-- Join with a code -->
        <form class="mt-5 flex items-center gap-2" @submit.prevent="join">
          <input v-model="code" maxlength="12" :placeholder="t('Class code')"
            class="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm uppercase tracking-wider text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <button type="submit" :disabled="!code.trim() || joining" class="inline-flex items-center gap-1.5 rounded-xl bg-[#006A3A] hover:bg-[#005A31] disabled:opacity-40 text-white text-sm font-bold px-4 py-2.5 cursor-pointer">
            <Plus class="w-4 h-4" /> {{ joining ? t('Joining…') : t('Join class') }}
          </button>
        </form>
        <p v-if="joinError" class="mt-2 text-sm text-red-600">{{ joinError }}</p>
      </aside>

      <!-- ───────── Path ───────── -->
      <section class="min-w-0">
        <!-- header -->
        <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 px-6 py-5">
          <template v-if="loading || (pathLoading && !lessonPath)">
            <Skeleton class="h-3 w-40" /><Skeleton class="h-7 w-2/3 mt-2" /><Skeleton class="h-2.5 w-full mt-4" />
          </template>
          <template v-else-if="selectedChapter">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs text-slate-500 truncate">{{ selectedCourse?.title }}</p>
                <h2 class="mt-1 flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: selectedCourse?.color || '#9b27af' }" />
                  <span class="truncate">{{ selectedChapter.title }}</span>
                </h2>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 px-3 py-1.5"><Flame class="w-4 h-4 text-slate-500" />{{ streak }}</span>
                <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-sm font-bold text-[#a77a00] px-3 py-1.5"><Star class="w-4 h-4 fill-[#f5b335] text-[#f5b335]" />{{ progress?.stars_earned ?? 0 }}/{{ progress?.stars_possible ?? 0 }}</span>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-4">
              <div class="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div class="h-full rounded-full bg-gradient-to-r from-[#9b27af] via-[#b0409f] to-[#f5b335]" :style="{ width: (progress?.percentage ?? 0) + '%' }" />
              </div>
              <span class="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500"><Trophy class="w-4 h-4" />{{ progress?.percentage ?? 0 }}%</span>
            </div>
          </template>
          <p v-else class="text-sm text-slate-500">{{ t('Pick a lesson to open its path') }}</p>
        </div>

        <!-- winding path -->
        <div class="mt-6 overflow-x-auto pb-12">
          <div v-if="pathLoading" class="mx-auto space-y-12" :style="{ width: WIDTH + 'px' }">
            <div v-for="n in 3" :key="n" :style="{ marginLeft: (n % 2 ? 180 : 60) + 'px' }"><Skeleton class="w-[76px] h-[76px] !rounded-full" /><Skeleton class="h-14 w-40 mt-3 -ml-8" /></div>
          </div>

          <div v-else-if="nodes.length" class="relative mx-auto" :style="{ width: WIDTH + 'px', height: nodes.length * H + 'px' }">
            <template v-for="(n, i) in nodes" :key="n.type + (n.id || n.chest_index) + i">
              <!-- curved connector to the next step -->
              <svg v-if="i < nodes.length - 1" class="absolute left-0 pointer-events-none" :style="{ top: i * H + 'px' }" :width="WIDTH" :height="H + 80" :viewBox="`0 0 ${WIDTH} ${H + 80}`">
                <path :d="connectorPath(i)" fill="none" :stroke="connectorColor(n)" stroke-width="10" stroke-linecap="round" />
              </svg>

              <div class="absolute" :style="{ top: i * H + 'px', left: cx(i) + 'px', transform: 'translateX(-50%)' }">
                <div class="flex flex-col items-center">
                  <!-- circle -->
                  <button v-if="n.type !== 'chest'" type="button" :disabled="n.status === 'locked'" @click="go(n)" class="relative w-[76px] h-[76px] rounded-full flex items-center justify-center transition active:translate-y-0.5"
                    :class="[
                      n.status === 'locked' ? 'bg-[#e1e6e3] dark:bg-slate-800 text-slate-400 shadow-[0_6px_0_#c3cbc6] dark:shadow-[0_6px_0_#0f172a] cursor-not-allowed'
                        : isPractice(n) ? 'bg-[#ffce04] text-[#0f4c2e] shadow-[0_6px_0_#b89600] cursor-pointer'
                        : n.status === 'completed' ? 'bg-[#9b27af] text-white shadow-[0_6px_0_#6e1a7d] cursor-pointer'
                        : 'bg-white dark:bg-slate-900 text-[#9b27af] ring-[5px] ring-[#9b27af] shadow-[0_6px_0_#6e1a7d] cursor-pointer']">
                    <Lock v-if="n.status === 'locked'" class="w-7 h-7" />
                    <Trophy v-else-if="n.type === 'lesson_quiz'" class="w-8 h-8" />
                    <BookOpen v-else-if="isPractice(n)" class="w-8 h-8" />
                    <span v-else class="text-3xl font-extrabold">{{ lessonNo[i] }}</span>
                    <span v-if="n.status === 'completed'" class="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-[3px] ring-slate-50 dark:ring-slate-950"><Check class="w-4 h-4" /></span>
                  </button>

                  <button v-else type="button" :disabled="n.status !== 'unlocked' || claiming" @click="claim(n)"
                    :class="['w-[76px] h-[76px] rounded-3xl flex items-center justify-center transition',
                      n.status === 'unlocked' ? 'bg-[#ffce04] text-[#3d3000] shadow-[0_6px_0_#b89600] animate-bounce cursor-pointer'
                        : n.status === 'claimed' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600' : 'bg-[#e1e6e3] dark:bg-slate-800 text-slate-400 shadow-[0_6px_0_#c3cbc6] dark:shadow-[0_6px_0_#0f172a] cursor-not-allowed']">
                    <Check v-if="n.status === 'claimed'" class="w-8 h-8" /><Gift v-else class="w-8 h-8" />
                  </button>

                  <!-- label card -->
                  <div class="mt-3 text-center rounded-xl bg-white dark:bg-slate-900 border px-5 py-2.5 max-w-[300px] min-w-[150px]"
                    :class="n.status === 'current' && !isPractice(n) ? 'border-[#9b27af] border-2 shadow-sm'
                      : n.status === 'locked' ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60' : 'border-slate-200/80 dark:border-slate-800 shadow-sm'">
                    <template v-if="n.type === 'chest'">
                      <p class="text-[11px] font-bold tracking-[0.14em] uppercase text-[#a77a00]">{{ t('Surprise box') }}</p>
                      <p class="text-sm font-extrabold text-slate-900 dark:text-white">{{ n.status === 'claimed' ? t('Claimed') : `+${n.xp_reward} XP` }}</p>
                    </template>
                    <template v-else>
                      <p :class="['text-[11px] font-bold tracking-[0.14em] uppercase',
                        n.status === 'locked' ? 'text-slate-400' : isPractice(n) ? 'text-[#a77a00]' : 'text-[#9b27af]']">
                        <template v-if="n.status === 'locked'">{{ t('Locked') }} · {{ isPractice(n) ? t(n.type === 'lesson_quiz' ? 'Chapter quiz' : 'Practice') : t('Lesson') + ' ' + lessonNo[i] }}</template>
                        <template v-else-if="n.status === 'current' && !isPractice(n)">{{ t('Up next') }} · {{ t('Lesson') }} {{ lessonNo[i] }}</template>
                        <template v-else-if="isPractice(n)">{{ n.type === 'lesson_quiz' ? t('Chapter quiz') : t('Practice') }}</template>
                        <template v-else>{{ t('Lesson') }} {{ lessonNo[i] }}</template>
                      </p>
                      <p :class="['text-sm font-extrabold leading-snug', n.status === 'locked' ? 'text-slate-500' : 'text-slate-900 dark:text-white']">{{ cleanTitle(n) }}</p>
                      <div v-if="isPractice(n) && n.status === 'completed'" class="mt-1 flex justify-center gap-1">
                        <Star v-for="s in 3" :key="s" :class="['w-3.5 h-3.5', s <= n.stars ? 'text-[#f5b335] fill-[#f5b335]' : 'text-slate-300 fill-slate-200']" />
                      </div>
                      <button v-if="n.status === 'current'" type="button" @click="go(n)"
                        class="mt-2 inline-flex items-center gap-2 rounded-full bg-[#006A3A] hover:bg-[#005A31] text-white text-sm font-bold px-6 py-2 cursor-pointer">
                        {{ t('Continue') }} <ArrowRight class="w-4 h-4" />
                      </button>
                    </template>
                  </div>
                  <p v-if="n.type === 'chest' && n.status === 'unlocked'" class="mt-1.5 text-xs font-bold text-[#006A3A]">{{ claiming ? t('Claiming…') : t('Tap to claim') }}</p>
                </div>
              </div>
            </template>
          </div>

          <p v-else-if="!loading && selectedChapter" class="text-center text-sm text-slate-500 py-10">{{ t('This chapter has no steps yet.') }}</p>
        </div>
      </section>
    </div>

    <Transition name="fade">
      <div v-if="toast" class="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#006A3A] text-white font-extrabold px-6 py-3 shadow-xl">🎉 {{ toast }}</div>
    </Transition>
  </StudentShell>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

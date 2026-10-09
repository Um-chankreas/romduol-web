<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Zap, Star, Clock, Flame, ArrowRight, Check, Target, Lightbulb, BookOpen, Play,
  Video, ChevronRight, FileSearch, ClipboardCheck, Trophy, Gift,
} from 'lucide-vue-next'
import StudentShell from '@/components/layout/StudentShell.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { authService } from '@/services/authService'
import { studentLearningService } from '@/services/studentLearningService'
import { liveClassService } from '@/services/liveClassService'
import { useLanguage } from '@/composables/useLanguage'

defineOptions({ name: 'StudentHomeView' })

const router = useRouter()
const { t } = useLanguage()

const home = ref(null)
const activity = ref([])
const liveClasses = ref([])
const loading = ref(true)
const error = ref('')

// Live sessions and the friends feed are extras: if either fails the page still works.
const loadLive = async () => {
  try { liveClasses.value = await liveClassService.getMyLiveClasses('active') } catch { /* optional */ }
}
let livePoll = null

onMounted(async () => {
  loadLive()
  livePoll = setInterval(loadLive, 30000)
  studentLearningService.getActivity(8).then(a => { activity.value = a }).catch(() => {})
  try {
    home.value = await studentLearningService.getHome()
  } catch (e) {
    error.value = e.response?.data?.error || 'Could not load your home page.'
  } finally {
    loading.value = false
  }
})
onBeforeUnmount(() => clearInterval(livePoll))

const firstName = computed(() => (authService.getCurrentUser()?.name || '').split(' ')[0] || '')
const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
})
const today = computed(() => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }))
const studyTime = computed(() => {
  const m = home.value?.study_minutes || 0
  return m >= 60 ? `${(m / 60).toFixed(1)}h` : `${m}m`
})

// ---- live ----
const joinLive = (lc) => window.open(router.resolve({ name: 'LiveStream', params: { id: lc.id } }).href, '_blank')

// ---- resume ring ----
const RING = 2 * Math.PI * 52
const resumePct = computed(() => home.value?.progress?.percentage || 0)

// ---- today's goals (XP values match the mobile app) ----
const GOALS = {
  daily_challenge: { label: 'Daily challenge', xp: 20, icon: Target },
  pass_quiz: { label: 'Pass a quiz', xp: 15, icon: Lightbulb },
  finish_lesson: { label: 'Finish a lesson', xp: 15, icon: BookOpen },
}
const goalsPct = computed(() => {
  const d = home.value?.daily_targets
  return d && d.items.length ? (d.done_count / d.items.length) * 100 : 0
})

// ---- quick actions: only Assignments has a count from the API today; the rest arrive with their pages ----
const quickActions = computed(() => [
  { label: 'Daily Challenge', sub: '5 quick questions', icon: Target, soon: true },
  { label: 'Mistake Bank', sub: 'Review your mistakes', icon: FileSearch, soon: true },
  { label: 'Assignments', sub: `${home.value?.assignments_upcoming ?? 0} due`, icon: ClipboardCheck, soon: true },
  { label: 'Leaderboard', sub: 'See how you rank', icon: Trophy, soon: true },
])

// ---- XP by subject donut ----
const PALETTE = ['#9b27af', '#0f4c2e', '#f5b335', '#2a9fd6', '#e8524a', '#6e7bd9']
const xpSlices = computed(() => {
  const b = home.value?.xp_breakdown
  if (!b || !b.total) return []
  const rows = (b.courses || []).map((c, i) => ({ label: c.title || 'Course', xp: c.xp, color: c.color || PALETTE[i % PALETTE.length] }))
  if (b.general) rows.push({ label: 'Daily practice', xp: b.general, color: PALETTE[2] })
  // Course colours can repeat; fall back to the palette so every slice is distinct.
  const seen = new Set()
  return rows.map((r, i) => {
    const color = seen.has(r.color) ? PALETTE[i % PALETTE.length] : r.color
    seen.add(color)
    return { ...r, color, pct: Math.round((r.xp / b.total) * 100) }
  })
})
const R = 70
const CIRC = 2 * Math.PI * R
const arcs = computed(() => {
  const total = home.value?.xp_breakdown?.total || 1
  let offset = 0
  return xpSlices.value.map(s => {
    const len = (s.xp / total) * CIRC
    const arc = { ...s, dash: `${Math.max(len - 3, 0)} ${CIRC}`, offset: -offset }
    offset += len
    return arc
  })
})

// ---- class activity ----
const ago = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}
const activityText = (a) => {
  if (a.type === 'xp') return { text: 'earned', chip: `+${a.amount} XP` }
  if (a.type === 'lesson') return { text: a.lesson_title ? `finished ${a.lesson_title}` : 'finished a chapter' }
  return { text: 'earned a badge' }
}
</script>

<template>
  <StudentShell :breadcrumb="[{ label: 'Home' }]">
    <p v-if="error" class="mb-5 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{{ error }}</p>

    <div class="mb-6">
      <h1 class="text-3xl font-extrabold text-slate-900 dark:text-white">{{ t(greeting) }}<template v-if="firstName">, {{ firstName }}</template></h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{{ today }}</p>
    </div>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <!-- ───────── Left column ───────── -->
      <div class="space-y-6 min-w-0">
        <!-- Live classes -->
        <section v-if="liveClasses.length">
          <div class="flex items-center justify-between mb-3">
            <h2 class="flex items-center gap-2.5 font-extrabold text-slate-900 dark:text-white">
              <span class="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-500/15 text-red-600 flex items-center justify-center"><Video class="w-5 h-5" /></span>
              {{ t('Live Classes') }}
            </h2>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-red-600 text-white text-xs font-bold px-3 py-1"><span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> {{ liveClasses.length }} LIVE</span>
          </div>
          <div class="space-y-3">
            <div v-for="lc in liveClasses.slice(0, 2)" :key="lc.id" class="relative overflow-hidden rounded-3xl bg-[#0b4429] text-white p-6 flex items-center justify-between gap-4">
              <div class="absolute -top-16 right-1/4 w-48 h-48 rounded-full bg-white/[0.05]" />
              <div class="relative min-w-0">
                <div class="flex items-center gap-2 text-sm">
                  <span class="inline-flex items-center gap-1 rounded-full bg-red-600 text-xs font-bold px-2.5 py-0.5"><span class="w-1.5 h-1.5 rounded-full bg-white" /> LIVE</span>
                  <span class="text-white/70 truncate">{{ lc.course?.title }}</span>
                </div>
                <p class="mt-2 text-xl font-extrabold truncate">{{ lc.title || lc.course?.title }}</p>
                <p v-if="lc.teacher?.name" class="mt-2 text-sm text-white/75">{{ t('Live now') }} · {{ lc.teacher.name }}</p>
              </div>
              <button type="button" @click="joinLive(lc)" class="relative shrink-0 inline-flex items-center gap-2 rounded-2xl bg-white text-[#0b4429] font-bold text-sm px-5 py-3 hover:bg-slate-100 transition cursor-pointer">
                <Video class="w-4 h-4" /> {{ t('Join now') }}
              </button>
            </div>
          </div>
        </section>

        <!-- Resume -->
        <section class="relative overflow-hidden rounded-3xl bg-[#0f4c2e] text-white p-7">
          <div class="absolute -top-24 right-0 w-80 h-80 rounded-full bg-white/[0.05]" />
          <div class="absolute -bottom-28 left-1/3 w-64 h-64 rounded-full bg-black/[0.10]" />
          <div class="relative flex items-center justify-between gap-6">
            <div class="min-w-0">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90"><Play class="w-3 h-3 fill-white" /> {{ t('Pick up where you left off') }}</span>
              <template v-if="loading"><Skeleton class="h-8 w-64 mt-4 !bg-white/15" /><Skeleton class="h-4 w-40 mt-2 !bg-white/15" /></template>
              <template v-else-if="home?.continue_lesson">
                <h2 class="text-3xl font-extrabold mt-4 leading-tight">{{ home.continue_lesson.lesson_title }}</h2>
                <p class="text-sm text-white/70 mt-1">{{ home.continue_lesson.course_title }}</p>
                <button type="button" @click="router.push(`/lessons/${home.continue_lesson.lesson_id}`)"
                  class="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white text-[#0f4c2e] font-bold text-sm px-6 py-3 hover:bg-slate-100 transition cursor-pointer">
                  {{ t('Resume Learning') }} <ArrowRight class="w-4 h-4" />
                </button>
              </template>
              <p v-else class="mt-4 text-sm text-white/80">{{ home?.all_caught_up ? t("You're all caught up — great work!") : t('Join a class to start learning.') }}</p>
            </div>

            <div v-if="home?.continue_lesson" class="relative shrink-0 w-32 h-32 hidden sm:block">
              <svg viewBox="0 0 120 120" class="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="9" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"
                  :stroke-dasharray="RING" :stroke-dashoffset="RING * (1 - resumePct / 100)" />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-2xl font-extrabold leading-none">{{ resumePct }}%</span>
                <span class="text-[11px] text-white/70 mt-1">{{ t('complete') }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Stats -->
        <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4">
            <Skeleton v-if="loading" class="h-7 w-20" />
            <p v-else class="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white"><Zap class="w-4 h-4 text-[#f5b335] fill-[#f5b335]" />{{ (home?.xp ?? 0).toLocaleString() }}</p>
            <p class="text-xs text-slate-500 mt-2">{{ t('Total XP') }}</p>
          </div>
          <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4">
            <Skeleton v-if="loading" class="h-7 w-14" />
            <p v-else class="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white"><Star class="w-4 h-4 text-[#006A3A] fill-[#006A3A]" />{{ home?.level?.level }}</p>
            <p class="text-xs text-slate-500 mt-2">{{ home?.level?.title || t('Level') }}</p>
          </div>
          <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4">
            <Skeleton v-if="loading" class="h-7 w-16" />
            <p v-else class="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white"><Clock class="w-4 h-4 text-slate-500" />{{ studyTime }}</p>
            <p class="text-xs text-slate-500 mt-2">{{ t('Study Time') }}</p>
          </div>
          <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4">
            <Skeleton v-if="loading" class="h-7 w-10" />
            <p v-else class="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white"><Flame class="w-4 h-4 text-slate-500" />{{ home?.streak ?? 0 }}</p>
            <p class="text-xs text-slate-500 mt-2">{{ t('Day Streak') }}</p>
            <div class="mt-2 flex gap-1.5">
              <span v-for="d in home?.streak_week || []" :key="d.date" :title="d.date"
                :class="['w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center',
                  d.active ? 'bg-[#f5b335] text-white' : d.today ? 'ring-2 ring-[#f5b335] text-slate-600 dark:text-slate-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400']">{{ d.weekday?.slice(0, 1) }}</span>
            </div>
          </div>
        </section>

        <!-- Quick actions -->
        <section>
          <h2 class="font-extrabold text-slate-900 dark:text-white mb-3">{{ t('Quick actions') }}</h2>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div v-for="q in quickActions" :key="q.label" :title="q.soon ? t('Coming soon') : ''"
              class="relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 opacity-90">
              <span class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-[#006A3A] dark:text-emerald-400 flex items-center justify-center"><component :is="q.icon" class="w-5 h-5" /></span>
              <p class="mt-5 font-bold text-slate-900 dark:text-white text-sm">{{ t(q.label) }}</p>
              <p class="text-xs text-slate-500 mt-0.5">{{ t(q.sub) }}</p>
              <span v-if="q.soon" class="absolute top-3 right-3 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 px-2 py-0.5">{{ t('Soon') }}</span>
            </div>
          </div>
        </section>

        <!-- Continue learning -->
        <section>
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-extrabold text-slate-900 dark:text-white">{{ t('Continue Learning') }}</h2>
            <router-link to="/class" class="text-sm font-bold text-[#006A3A] dark:text-emerald-400 hover:underline">{{ t('All Courses') }}</router-link>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <template v-if="loading"><Skeleton v-for="n in 2" :key="n" class="h-24 !rounded-2xl" /></template>
            <template v-else>
              <router-link v-for="c in home?.courses || []" :key="c.course_id" :to="`/class/${c.course_id}`"
                class="flex items-center gap-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 hover:shadow-md transition">
                <span class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" :style="{ backgroundColor: (c.color || '#006A3A') + '22', color: c.color || '#006A3A' }"><BookOpen class="w-5 h-5" /></span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline justify-between gap-3">
                    <p class="font-extrabold text-slate-900 dark:text-white truncate">{{ c.title }}</p>
                    <span class="text-xs font-bold shrink-0" :style="{ color: c.color || '#006A3A' }">{{ c.percentage }}%</span>
                  </div>
                  <div class="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="h-full rounded-full" :style="{ width: c.percentage + '%', backgroundColor: c.color || '#006A3A' }" /></div>
                  <p v-if="c.current_chapter_title" class="mt-1.5 text-xs text-slate-500 truncate">{{ c.current_chapter_title }}</p>
                </div>
                <span class="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0" :style="{ backgroundColor: c.color || '#006A3A' }"><Play class="w-4 h-4 fill-white" /></span>
              </router-link>
              <p v-if="!(home?.courses || []).length" class="text-sm text-slate-500 md:col-span-2">
                {{ t('No classes yet.') }} <router-link to="/class" class="font-bold text-[#006A3A] hover:underline">{{ t('Join a class') }}</router-link>
              </p>
            </template>
          </div>
        </section>
      </div>

      <!-- ───────── Right column ───────── -->
      <aside class="space-y-6 min-w-0">
        <!-- Today's goals -->
        <section class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-6">
          <h2 class="font-extrabold text-slate-900 dark:text-white">{{ t("Today's goals") }}</h2>
          <span class="inline-flex items-center gap-1.5 mt-3 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-1"><Gift class="w-3.5 h-3.5" /> +{{ home?.daily_targets.bonus_xp ?? 50 }} XP {{ t('Bonus') }}</span>
          <div class="mt-4 flex items-center gap-4">
            <div class="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="h-full rounded-full bg-[#006A3A] transition-all" :style="{ width: goalsPct + '%' }" /></div>
            <span class="text-lg font-extrabold text-slate-900 dark:text-white">{{ home?.daily_targets.done_count ?? 0 }}<span class="text-sm font-semibold text-slate-400">/{{ home?.daily_targets.items.length ?? 3 }}</span></span>
          </div>
          <ul class="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading"><li v-for="n in 3" :key="n" class="py-3"><Skeleton class="h-6 w-full" /></li></template>
            <template v-else>
              <li v-for="it in home?.daily_targets.items || []" :key="it.key" class="flex items-center gap-3 py-3">
                <component :is="GOALS[it.key]?.icon || Target" class="w-5 h-5 text-[#006A3A] shrink-0" />
                <span class="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">{{ t(GOALS[it.key]?.label || it.key) }}</span>
                <span class="text-sm font-bold text-[#a77a00]">+{{ GOALS[it.key]?.xp }}</span>
                <span :class="['w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0', it.done ? 'bg-[#006A3A] border-[#006A3A] text-white' : 'border-slate-200 dark:border-slate-700']"><Check v-if="it.done" class="w-3.5 h-3.5" /></span>
              </li>
            </template>
          </ul>
        </section>

        <!-- XP by subject -->
        <section class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-6">
          <h2 class="font-extrabold text-slate-900 dark:text-white">{{ t('XP by Subject') }}</h2>
          <div class="relative w-44 h-44 mx-auto mt-4">
            <Skeleton v-if="loading" class="w-full h-full !rounded-full" />
            <template v-else>
              <svg viewBox="0 0 180 180" class="w-full h-full -rotate-90">
                <circle cx="90" cy="90" :r="R" fill="none" stroke="currentColor" class="text-slate-100 dark:text-slate-800" stroke-width="22" />
                <circle v-for="a in arcs" :key="a.label" cx="90" cy="90" :r="R" fill="none" :stroke="a.color" stroke-width="22"
                  :stroke-dasharray="a.dash" :stroke-dashoffset="a.offset" />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-2xl font-extrabold text-slate-900 dark:text-white">{{ (home?.xp ?? 0).toLocaleString() }}</span>
                <span class="text-xs text-slate-500">XP</span>
              </div>
            </template>
          </div>
          <ul class="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
            <li v-for="s in xpSlices" :key="s.label" class="flex items-center gap-2.5 py-2.5 text-sm">
              <span class="w-2.5 h-2.5 rounded-[3px] shrink-0" :style="{ backgroundColor: s.color }" />
              <span class="flex-1 truncate font-semibold text-slate-800 dark:text-slate-100">{{ t(s.label) }}</span>
              <span class="text-xs text-slate-400">{{ s.pct }}%</span>
              <span class="w-12 text-right font-bold text-slate-900 dark:text-white">{{ s.xp.toLocaleString() }}</span>
            </li>
          </ul>
        </section>

        <!-- Class activity -->
        <section v-if="activity.length" class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-6">
          <h2 class="font-extrabold text-slate-900 dark:text-white">{{ t('Class Activity') }}</h2>
          <ul class="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            <li v-for="(a, i) in activity" :key="i" class="flex items-center gap-3 py-3">
              <span class="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[#006A3A] dark:text-emerald-400 font-bold text-sm flex items-center justify-center shrink-0 overflow-hidden">
                <img v-if="a.actor.avatar_url" :src="a.actor.avatar_url" alt="" class="w-full h-full object-cover" />
                <template v-else>{{ (a.actor.name || '?').slice(0, 1) }}</template>
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ a.actor.name }}</p>
                <p class="text-xs text-slate-500 truncate">{{ activityText(a).text }}
                  <span v-if="activityText(a).chip" class="ml-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-[#a77a00] font-bold px-2 py-0.5">{{ activityText(a).chip }}</span>
                </p>
              </div>
              <span class="text-xs text-slate-400 shrink-0">{{ ago(a.at) }}</span>
              <ChevronRight class="w-3.5 h-3.5 text-slate-300 shrink-0" />
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </StudentShell>
</template>

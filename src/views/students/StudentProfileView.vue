<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { insightsService } from '../../services/insightsService.js';
import { authService } from '../../services/authService.js';
import { useTheme } from '../../composables/useTheme.js';

import Sidebar from '../../components/layout/Sidebar.vue';
import Header from '../../components/layout/Header.vue';
import ActivityHeatmap from '../../components/insights/ActivityHeatmap.vue';
import XpWeeklyChart from '../../components/insights/XpWeeklyChart.vue';
import QuizScoreChart from '../../components/insights/QuizScoreChart.vue';
import CoursePathStrip from '../../components/insights/CoursePathStrip.vue';

defineOptions({ name: 'StudentProfileView' });

const route = useRoute();
const router = useRouter();
const { isDark } = useTheme();

// Teachers only get the courses they teach (the API scopes it); say so.
const isTeacher = authService.getCurrentUser()?.role === 'teacher';

const DAY_MS = 86400000;
const LIST_PREVIEW = 8;

// ── Load ────────────────────────────────────────────────────────────────
const profile = ref(null);
const loading = ref(false);
const loadError = ref(null);   // { status, title, message } | null

const ERROR_COPY = {
  403: { title: 'Not one of your students', message: 'You can only view students enrolled in your classes.' },
  404: { title: 'Student not found', message: "This student doesn't exist, or their account has been removed." },
};

// Guards against a slow response for a previous :id landing after a newer one.
let requestSeq = 0;

const fetchProfile = async () => {
  const id = route.params.id;
  if (!id) return;
  const seq = ++requestSeq;
  loading.value = true;
  loadError.value = null;
  try {
    const data = await insightsService.getStudentProfile(id);
    if (seq !== requestSeq) return;
    profile.value = data;
    brokenAvatar.value = false;
  } catch (err) {
    if (seq !== requestSeq) return;
    const status = err.response?.status;
    profile.value = null;
    loadError.value = {
      status,
      title: ERROR_COPY[status]?.title || "Couldn't load this profile",
      message: ERROR_COPY[status]?.message || err.response?.data?.error || err.message || 'Failed to load the student profile.',
    };
  } finally {
    if (seq === requestSeq) loading.value = false;
  }
};

onMounted(fetchProfile);
watch(() => route.params.id, (id, prev) => { if (id && id !== prev) fetchProfile(); });

// vue-router records the previous entry in history.state.back; without one
// (opened in a new tab / pasted link) there's nothing to go back to.
const goBack = () => {
  if (window.history.state?.back) router.back();
  else router.push('/');
};

// ── Formatting helpers ──────────────────────────────────────────────────
const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v) => Number(v) || 0;
const fmtNum = (v) => num(v).toLocaleString('en-US');
const clampPct = (v) => Math.min(100, Math.max(0, Math.round(num(v))));

const initials = (name) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const validDate = (d) => {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t;
};
const formatDate = (d) => {
  const t = validDate(d);
  return t ? t.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
};
// "Sep 22" this year, "Sep 22, 2025" otherwise.
const shortDate = (d) => {
  const t = validDate(d);
  if (!t) return '—';
  const opts = { month: 'short', day: 'numeric' };
  if (t.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return t.toLocaleDateString('en-US', opts);
};
const timeAgo = (d) => {
  const t = validDate(d);
  if (!t) return '';
  const mins = Math.floor((Date.now() - t.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return shortDate(t);
};
const fmtMinutes = (m) => {
  const n = Math.max(0, Math.round(num(m)));
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const r = n % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};

// ── Sections (every one null-safe) ──────────────────────────────────────
const data = computed(() => profile.value || {});
const student = computed(() => data.value.student || {});
const xp = computed(() => data.value.xp || {});
const level = computed(() => xp.value.level || {});
const streak = computed(() => data.value.streak || {});
const summary = computed(() => data.value.summary || {});
const courses = computed(() => arr(data.value.courses));
const calendar = computed(() => arr(data.value.activity_calendar));
const xpWeekly = computed(() => arr(data.value.xp_weekly));
const recentXp = computed(() => arr(data.value.recent_xp));
const quizHistory = computed(() => arr(data.value.quiz_history));
const assignmentHistory = computed(() => arr(data.value.assignment_history));
const liveClasses = computed(() => data.value.live_classes || {});
const liveRecent = computed(() => arr(liveClasses.value.recent));
const dailyChallenges = computed(() => data.value.daily_challenges || {});
const earnedBadges = computed(() => arr(data.value.achievements?.earned));
const lockedBadges = computed(() => arr(data.value.achievements?.locked));

const brokenAvatar = ref(false);
const showAvatar = computed(() => !!student.value.avatar_url && !brokenAvatar.value);

// ── Header: level, rank, streak, last active ────────────────────────────
const levelPct = computed(() => {
  const span = num(level.value.xp_for_next_level);
  return span > 0 ? clampPct((num(level.value.xp_into_level) / span) * 100) : 0;
});
const xpToNext = computed(() =>
  level.value.xp_to_next_level ?? Math.max(num(level.value.xp_for_next_level) - num(level.value.xp_into_level), 0)
);
const streakWeek = computed(() => arr(streak.value.week));

const daysInactive = computed(() => {
  const s = summary.value;
  if (s.days_inactive != null) return num(s.days_inactive);
  const t = validDate(s.last_active);
  return t ? Math.max(0, Math.floor((Date.now() - t.getTime()) / DAY_MS)) : null;
});
const lastActiveLabel = computed(() => {
  const d = daysInactive.value;
  if (d == null) return 'never';
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
});
const lastActiveTone = computed(() => {
  const d = daysInactive.value;
  if (d == null) return 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-500/10';
  if (d <= 1) return 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10';
  if (d < 7) return 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800';
  return 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10';
});

// ── KPI tiles ───────────────────────────────────────────────────────────
const tiles = computed(() => {
  const s = summary.value;
  const dc = dailyChallenges.value;
  const badgeTotal = earnedBadges.value.length + lockedBadges.value.length;
  const missing = num(s.assignments_missing);
  return [
    {
      label: 'Study time', icon: '⏱️',
      value: fmtMinutes(s.study_minutes_total),
      hint: `${fmtMinutes(s.study_minutes_7d)} in the last 7 days`,
    },
    {
      label: 'Chapters done', icon: '📖',
      value: fmtNum(s.lessons_completed),
      hint: `${fmtNum(s.units_completed)} unit${num(s.units_completed) === 1 ? '' : 's'} read`,
    },
    {
      label: 'Quiz average', icon: '🎯',
      value: s.avg_quiz_score != null ? `${Math.round(num(s.avg_quiz_score))}%` : '—',
      hint: `${fmtNum(s.quizzes_passed)}/${fmtNum(s.quizzes_attempted)} passed`,
    },
    {
      label: 'Assignments', icon: '📝',
      value: fmtNum(s.assignments_submitted),
      hint: 'submitted',
      alert: missing > 0 ? `${fmtNum(missing)} missing` : null,
    },
    {
      label: 'Live classes', icon: '🎥',
      value: fmtNum(s.live_classes_attended ?? liveClasses.value.attended),
      hint: 'attended',
    },
    {
      label: 'Badges', icon: '🏅',
      value: fmtNum(s.badges_earned ?? earnedBadges.value.length),
      hint: badgeTotal ? `of ${badgeTotal} available` : 'earned',
    },
    {
      label: 'Daily challenges', icon: '⚡',
      value: fmtNum(dc.completed),
      hint: `completed · best ${dc.best_score != null ? `${Math.round(num(dc.best_score))}%` : '—'}`,
      sub: `🔥 ${fmtNum(dc.current_streak)} day streak · longest ${fmtNum(dc.longest_streak)}`,
    },
    {
      label: 'Courses', icon: '📚',
      value: fmtNum(s.courses ?? courses.value.length),
      hint: isTeacher ? 'in your classes' : 'enrolled',
    },
  ];
});

// ── Where they are now (per course) ─────────────────────────────────────
const positionOf = (p) => {
  if (!p || !(num(p.units_total) > 0)) return { main: 'No content yet', sub: null, tone: 'muted' };
  const cur = p.current;
  if (!cur) return { main: 'Course completed 🎉', sub: null, tone: 'done' };
  const n = cur.lesson_index ?? '?';
  if (cur.step === 'unit') {
    return {
      main: `Chapter ${n} of ${p.lessons_total ?? '?'} · Unit ${cur.unit_index ?? '?'}/${cur.units_in_lesson ?? '?'}: ${cur.unit_title || 'Untitled unit'}`,
      sub: cur.lesson_title || null,
      tone: 'active',
    };
  }
  if (cur.step === 'quiz') {
    return { main: `Chapter ${n}: units done — quizzes pending`, sub: cur.lesson_title || null, tone: 'waiting' };
  }
  return { main: `Chapter ${n}: ${cur.lesson_title || 'Untitled chapter'}`, sub: null, tone: 'active' };
};

const POSITION_TONE = {
  muted: 'text-slate-500 dark:text-slate-400',
  done: 'text-emerald-700 dark:text-emerald-300',
  active: 'text-slate-800 dark:text-slate-100',
  waiting: 'text-amber-700 dark:text-amber-300',
};

const subChip = (sub) => {
  if (sub?.is_active) {
    return {
      label: 'Subscribed',
      detail: sub.expiry_date ? `until ${shortDate(sub.expiry_date)}` : '',
      tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    };
  }
  if (sub?.expiry_date) {
    return {
      label: 'Expired',
      detail: shortDate(sub.expiry_date),
      tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    };
  }
  return { label: 'No subscription', detail: '', tone: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
};

const courseCards = computed(() => courses.value.map((c, i) => {
  const course = c?.course || {};
  const progress = c?.progress || {};
  const quizzes = c?.quizzes || {};
  const assignments = c?.assignments || {};
  return {
    key: course.id || i,
    course,
    progress,
    pct: clampPct(progress.percentage),
    position: positionOf(progress),
    xp: num(c?.xp),
    quizzes,
    assignments,
    sub: subChip(c?.subscription),
    enrolledAt: c?.enrolled_at,
  };
}));

// ── Study activity ──────────────────────────────────────────────────────
const calendarTotals = computed(() => {
  let minutes = 0;
  let active = 0;
  calendar.value.forEach(d => {
    const m = num(d?.minutes);
    minutes += m;
    if (d?.active || m > 0) active += 1;
  });
  return { minutes, active, perActiveDay: active ? Math.round(minutes / active) : 0 };
});

// ── XP ──────────────────────────────────────────────────────────────────
// Tags passed to awardXp() in lms-backend (grep "awardXp(" there).
const XP_REASONS = {
  lesson_complete: { icon: '📖', many: 'Chapters completed', one: 'Completed a chapter' },
  unit_complete: { icon: '🧩', many: 'Units completed', one: 'Completed a unit' },
  quiz_pass: { icon: '✅', many: 'Quizzes passed', one: 'Passed a quiz' },
  daily_quiz: { icon: '🗓️', many: 'Daily practice', one: 'Finished daily practice' },
  daily_challenge: { icon: '⚡', many: 'Daily challenges', one: 'Daily challenge done' },
  daily_challenge_retake: { icon: '🔁', many: 'Daily challenge retakes', one: 'Improved a daily challenge' },
  daily_challenge_streak: { icon: '🔥', many: 'Daily challenge streak bonuses', one: 'Daily challenge streak bonus' },
  mistake_review: { icon: '🛠️', many: 'Mistake reviews', one: 'Reviewed their mistakes' },
  assignment_ontime: { icon: '📝', many: 'Assignments on time', one: 'Assignment on time' },
  assignment_late: { icon: '⏰', many: 'Assignments turned in late', one: 'Assignment turned in late' },
  live_class: { icon: '🎥', many: 'Live classes attended', one: 'Attended a live class' },
  daily_targets: { icon: '🎯', many: 'Daily target bonuses', one: 'Hit the daily targets' },
  path_chest: { icon: '🎁', many: 'Path chests opened', one: 'Opened a path chest' },
  streak_combo: { icon: '🔥', many: 'Streak combo bonuses', one: 'Streak combo bonus' },
};
const titleCase = (tag) =>
  String(tag || '').replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase()) || 'Other';
const reasonInfo = (tag) => XP_REASONS[tag] || { icon: '✨', many: titleCase(tag), one: titleCase(tag) };

const xpReasons = computed(() => {
  const rows = arr(data.value.xp_by_reason).filter(r => r && num(r.xp) !== 0);
  const max = Math.max(1, ...rows.map(r => Math.abs(num(r.xp))));
  const total = rows.reduce((s, r) => s + num(r.xp), 0);
  return rows.map(r => ({
    key: r.reason || 'other',
    ...reasonInfo(r.reason),
    xp: num(r.xp),
    count: num(r.count),
    width: Math.max(2, Math.round((Math.abs(num(r.xp)) / max) * 100)),
    share: total > 0 ? Math.round((num(r.xp) / total) * 100) : 0,
  }));
});
const xpWeekStats = computed(() => {
  const list = xpWeekly.value.map(w => num(w?.xp));
  const total = list.reduce((s, v) => s + v, 0);
  return {
    total,
    thisWeek: list.length ? list[list.length - 1] : 0,
    avg: list.length ? Math.round(total / list.length) : 0,
    best: list.length ? Math.max(...list) : 0,
  };
});

// ── Scores ──────────────────────────────────────────────────────────────
const showAllXp = ref(false);
const showAllQuizzes = ref(false);
const showAllAssignments = ref(false);
const visibleXp = computed(() => (showAllXp.value ? recentXp.value : recentXp.value.slice(0, LIST_PREVIEW)));
const visibleQuizzes = computed(() => (showAllQuizzes.value ? quizHistory.value : quizHistory.value.slice(0, LIST_PREVIEW)));
const visibleAssignments = computed(() =>
  showAllAssignments.value ? assignmentHistory.value : assignmentHistory.value.slice(0, LIST_PREVIEW)
);

// Summary of the quiz_history window shown under the score chart.
const quizStats = computed(() => {
  const scored = quizHistory.value.filter(q => q?.score != null);
  if (!scored.length) return null;
  const scores = scored.map(q => num(q.score));
  return {
    avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    passRate: Math.round((scored.filter(q => q.passed).length / scored.length) * 100),
    best: Math.round(Math.max(...scores)),
  };
});

const ASSIGNMENT_STATUS = {
  graded: { label: 'Graded', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  submitted: { label: 'Submitted', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  missing: { label: 'Missing', tone: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  pending: { label: 'Pending', tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};
const statusOf = (a) => ASSIGNMENT_STATUS[a?.status] || ASSIGNMENT_STATUS.pending;

// grade / score are 0-100 percentages; earned points = round(pct / 100 * points)
// (see lms-backend sql/033_assignment_points.sql).
const assignmentScore = (a) => {
  const raw = a?.grade ?? a?.score;
  const points = num(a?.points);
  if (raw == null) return points > 0 ? `— / ${points} pts` : '—';
  const pct = clampPct(raw);
  return points > 0 ? `${Math.round((pct / 100) * points)} / ${points} pts · ${pct}%` : `${pct}%`;
};

// ── Achievements ────────────────────────────────────────────────────────
const BADGE_STYLE = {
  first_step: { icon: '👣', tone: 'emerald' },
  quick_learner: { icon: '⚡', tone: 'amber' },
  knowledge_seeker: { icon: '📚', tone: 'sky' },
  fast_finisher: { icon: '🏁', tone: 'rose' },
  streak_master: { icon: '🔥', tone: 'orange' },
  streak_7: { icon: '🔥', tone: 'orange' },
  streak_14: { icon: '🔥', tone: 'orange' },
  streak_30: { icon: '🔥', tone: 'orange' },
  quiz_grinder: { icon: '🧠', tone: 'violet' },
  quiz_master: { icon: '🏆', tone: 'amber' },
  rising_star: { icon: '🌟', tone: 'amber' },
  first_hundred: { icon: '💯', tone: 'emerald' },
  assignment_champion: { icon: '📝', tone: 'sky' },
  level_10: { icon: '🎓', tone: 'violet' },
  mistake_buster: { icon: '🛠️', tone: 'teal' },
};
const BADGE_TONE = {
  emerald: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30',
  amber: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30',
  sky: 'bg-sky-50 border-sky-200 dark:bg-sky-500/10 dark:border-sky-500/30',
  rose: 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30',
  orange: 'bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/30',
  violet: 'bg-violet-50 border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/30',
  teal: 'bg-teal-50 border-teal-200 dark:bg-teal-500/10 dark:border-teal-500/30',
};
const badgeIcon = (code) => BADGE_STYLE[code]?.icon || '🏅';
const badgeTone = (code) => BADGE_TONE[BADGE_STYLE[code]?.tone] || BADGE_TONE.emerald;
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header />

      <main class="p-4 sm:p-6 lg:p-8 flex-1 w-full min-w-0 space-y-6">
        <!-- Top bar -->
        <div class="flex items-center justify-between gap-3">
          <button
            @click="goBack"
            class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer active:scale-95"
          >
            <span class="text-sm leading-none">←</span> Back
          </button>
          <span class="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Student profile</span>
        </div>

        <!-- ===================== LOADING ===================== -->
        <div v-if="loading && !profile" class="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading profile">
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
            <div class="h-20 bg-slate-200 dark:bg-slate-800"></div>
            <div class="px-4 sm:px-6 pb-6 flex flex-col lg:flex-row gap-6">
              <div class="flex items-end gap-4 flex-1">
                <div class="-mt-10 w-20 h-20 rounded-2xl bg-slate-300 dark:bg-slate-700 ring-4 ring-white dark:ring-slate-900 shrink-0"></div>
                <div class="space-y-2 flex-1 pb-1">
                  <div class="h-5 w-40 max-w-full rounded bg-slate-200 dark:bg-slate-800"></div>
                  <div class="h-3 w-56 max-w-full rounded bg-slate-200 dark:bg-slate-800"></div>
                </div>
              </div>
              <div class="lg:w-96 space-y-3 lg:pt-6">
                <div class="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800"></div>
                <div class="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800"></div>
                <div class="h-3 w-48 rounded bg-slate-200 dark:bg-slate-800"></div>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div v-for="n in 8" :key="n" class="h-28 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800"></div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div v-for="n in 2" :key="n" class="h-56 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800"></div>
          </div>
        </div>

        <!-- ===================== ERROR ===================== -->
        <div
          v-else-if="loadError"
          class="bg-white dark:bg-slate-900 rounded-2xl p-8 sm:p-12 border border-slate-200/60 dark:border-slate-800 shadow-sm text-center"
        >
          <div class="text-4xl">{{ loadError.status === 403 ? '🔒' : loadError.status === 404 ? '🔍' : '⚠️' }}</div>
          <h1 class="mt-3 text-lg font-extrabold text-slate-900 dark:text-white">{{ loadError.title }}</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">{{ loadError.message }}</p>
          <div class="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              @click="fetchProfile"
              :disabled="loading"
              class="px-4 py-2.5 rounded-xl bg-[#006A3A] text-white font-bold text-xs shadow-md hover:bg-[#005A31] transition cursor-pointer active:scale-95 disabled:opacity-60"
            >
              {{ loading ? 'Retrying…' : 'Retry' }}
            </button>
            <button
              @click="goBack"
              class="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Go back
            </button>
          </div>
        </div>

        <!-- ===================== PROFILE ===================== -->
        <template v-else-if="profile">
          <!-- Header card -->
          <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
            <div class="h-20 bg-gradient-to-r from-[#006A3A] to-emerald-400 dark:from-emerald-950 dark:to-emerald-800"></div>
            <div class="px-4 sm:px-6 pb-5 flex flex-col lg:flex-row lg:items-end gap-5 lg:gap-8">
              <!-- Identity (only the avatar overlaps the banner) -->
              <div class="flex-1 min-w-0">
                <div class="-mt-10 w-20 h-20 rounded-2xl ring-4 ring-white dark:ring-slate-900 bg-[#016a36] text-white text-2xl font-extrabold flex items-center justify-center overflow-hidden select-none shadow-sm">
                  <img
                    v-if="showAvatar"
                    :src="student.avatar_url"
                    @error="brokenAvatar = true"
                    class="w-full h-full object-cover"
                    alt=""
                  />
                  <span v-else>{{ initials(student.name) }}</span>
                </div>
                <div class="mt-3 flex flex-wrap items-center gap-2">
                  <h1 class="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight break-words min-w-0">
                    {{ student.name || 'Student' }}
                  </h1>
                  <span
                    v-if="student.is_active === false"
                    class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  >Deactivated</span>
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                  <span v-if="student.email" class="break-all">✉️ {{ student.email }}</span>
                  <span v-if="student.phone">📞 {{ student.phone }}</span>
                  <span v-if="!student.email && !student.phone">No contact info</span>
                </div>
                <p v-if="student.bio" class="mt-2 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 max-w-xl">{{ student.bio }}</p>
                <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                  <span class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    Joined {{ formatDate(student.created_at) }}
                  </span>
                  <span :class="['px-2 py-1 rounded-lg font-semibold', lastActiveTone]">
                    Last active {{ lastActiveLabel }}
                  </span>
                </div>
              </div>

              <!-- Gamification -->
              <div class="lg:w-[26rem] shrink-0 space-y-4">
                <div>
                  <div class="flex items-center justify-between gap-2">
                    <span class="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold truncate">
                      Lv {{ level.level ?? 1 }} · {{ level.title || 'Scholar' }}
                    </span>
                    <span class="text-xs font-bold text-slate-900 dark:text-white shrink-0">{{ fmtNum(xp.total) }} XP</span>
                  </div>
                  <div
                    class="mt-2 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                    role="progressbar"
                    :aria-valuenow="levelPct"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-label="Progress to next level"
                  >
                    <div class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#006A3A] dark:to-emerald-300 transition-all" :style="{ width: `${levelPct}%` }"></div>
                  </div>
                  <p class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {{ fmtNum(level.xp_into_level) }} / {{ fmtNum(level.xp_for_next_level) }} ·
                    <span class="font-semibold text-slate-700 dark:text-slate-200">{{ fmtNum(xpToNext) }} XP</span> to level {{ num(level.level || 1) + 1 }}
                  </p>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
                    <p class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Rank</p>
                    <p class="text-lg font-extrabold text-slate-900 dark:text-white">
                      {{ xp.rank ? `#${fmtNum(xp.rank)}` : '—' }}
                      <span class="text-[11px] font-semibold text-slate-400">of {{ fmtNum(xp.total_students) }}</span>
                    </p>
                  </div>
                  <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
                    <p class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Streak</p>
                    <p class="text-lg font-extrabold text-slate-900 dark:text-white">
                      🔥 {{ fmtNum(streak.current) }}
                      <span class="text-[11px] font-semibold text-slate-400">day{{ num(streak.current) === 1 ? '' : 's' }}</span>
                    </p>
                  </div>
                </div>

                <div v-if="streakWeek.length" class="flex items-center justify-between gap-1">
                  <div v-for="d in streakWeek" :key="d.date || d.weekday" class="flex flex-col items-center gap-1 flex-1">
                    <span
                      :title="`${d.weekday || ''} ${d.date || ''}${d.active ? ' · active' : ''}`"
                      :class="[
                        'w-7 h-7 rounded-full flex items-center justify-center text-[11px]',
                        d.active ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600',
                        d.today ? 'ring-2 ring-offset-2 ring-orange-400 ring-offset-white dark:ring-offset-slate-900' : '',
                      ]"
                    >{{ d.active ? '🔥' : '·' }}</span>
                    <span :class="['text-[10px]', d.today ? 'font-bold text-slate-700 dark:text-slate-200' : 'text-slate-400']">
                      {{ (d.weekday || '').slice(0, 2) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- KPI tiles -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div
              v-for="t in tiles"
              :key="t.label"
              class="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide leading-tight">{{ t.label }}</span>
                <span class="text-base shrink-0">{{ t.icon }}</span>
              </div>
              <p class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2 truncate">{{ t.value }}</p>
              <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span
                  v-if="t.alert"
                  class="font-bold px-1.5 py-0.5 rounded text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-500/10"
                >{{ t.alert }}</span>
                <span class="text-slate-400 dark:text-slate-500">{{ t.hint }}</span>
              </div>
              <p v-if="t.sub" class="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{{ t.sub }}</p>
            </div>
          </div>

          <!-- Where they are now -->
          <section class="space-y-3">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-white">📍 Where they are now</h2>
              <p class="text-[11px] text-slate-400">
                {{ isTeacher ? 'Only the classes you teach are shown' : 'Every course they are enrolled in' }} · most recent first
              </p>
            </div>

            <div
              v-if="!courseCards.length"
              class="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200/60 dark:border-slate-800 shadow-sm text-center text-sm text-slate-500 dark:text-slate-400"
            >
              Not enrolled in any courses yet.
            </div>

            <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <article
                v-for="c in courseCards"
                :key="c.key"
                class="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                    :style="{ backgroundColor: c.course.color || '#006A3A' }"
                  >
                    <span>{{ c.course.icon || '📚' }}</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <router-link
                      v-if="c.course.id"
                      :to="`/courses/${c.course.id}`"
                      class="block text-sm font-bold text-slate-900 dark:text-white truncate hover:underline"
                    >{{ c.course.title || 'Untitled course' }}</router-link>
                    <p v-else class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ c.course.title || 'Untitled course' }}</p>
                    <div class="mt-1 flex flex-wrap items-center gap-1.5">
                      <span :class="['px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide whitespace-nowrap', c.sub.tone]">
                        {{ c.sub.label }}
                      </span>
                      <span v-if="c.sub.detail" class="text-[11px] text-slate-400">{{ c.sub.detail }}</span>
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-none">{{ c.pct }}<span class="text-base">%</span></p>
                    <p class="mt-1 text-[10px] text-slate-400">{{ fmtNum(c.progress.units_done) }}/{{ fmtNum(c.progress.units_total) }} units</p>
                  </div>
                </div>

                <div class="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    :class="['h-full rounded-full transition-all', c.pct === 100 ? 'bg-[#006A3A] dark:bg-emerald-400' : 'bg-emerald-500']"
                    :style="{ width: `${c.pct}%` }"
                  ></div>
                </div>

                <div class="mt-3">
                  <p :class="['text-sm font-semibold break-words', POSITION_TONE[c.position.tone]]">{{ c.position.main }}</p>
                  <p v-if="c.position.sub" class="text-[11px] text-slate-500 dark:text-slate-400 break-words">{{ c.position.sub }}</p>
                </div>

                <div class="mt-3">
                  <CoursePathStrip :path="c.progress.path || []" :current="c.progress.current || null" />
                </div>

                <dl class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
                  <div class="min-w-0">
                    <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Course XP</dt>
                    <dd class="text-sm font-extrabold text-slate-900 dark:text-white">{{ fmtNum(c.xp) }}</dd>
                  </div>
                  <div class="min-w-0">
                    <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Quiz avg</dt>
                    <dd class="text-sm font-extrabold text-slate-900 dark:text-white">
                      {{ c.quizzes.avg_score != null ? `${Math.round(num(c.quizzes.avg_score))}%` : '—' }}
                    </dd>
                    <dd class="text-[10px] text-slate-400">{{ fmtNum(c.quizzes.attempted) }}/{{ fmtNum(c.quizzes.total) }} tried</dd>
                  </div>
                  <div class="min-w-0">
                    <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Assignments</dt>
                    <dd class="text-sm font-extrabold text-slate-900 dark:text-white">{{ fmtNum(c.assignments.submitted) }}/{{ fmtNum(c.assignments.total) }}</dd>
                    <dd :class="['text-[10px]', num(c.assignments.missing) > 0 ? 'font-bold text-red-600 dark:text-red-400' : 'text-slate-400']">
                      {{ fmtNum(c.assignments.missing) }} missing
                    </dd>
                  </div>
                </dl>

                <p class="mt-3 text-[11px] text-slate-400">
                  <template v-if="c.progress.last_progress_at">Last progress {{ timeAgo(c.progress.last_progress_at) }}</template>
                  <template v-else>No progress yet</template>
                  <template v-if="c.enrolledAt"> · enrolled {{ shortDate(c.enrolledAt) }}</template>
                </p>
              </article>
            </div>
          </section>

          <!-- Study activity + weekly XP -->
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <section class="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0">
              <h2 class="text-base font-bold text-slate-900 dark:text-white">📅 Study activity</h2>
              <p class="text-[11px] text-slate-400 mb-4">Minutes studied per day · last 12 weeks</p>
              <ActivityHeatmap :days="calendar" />
              <dl class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">All time</dt>
                  <dd class="text-sm font-extrabold text-slate-900 dark:text-white">{{ fmtMinutes(summary.study_minutes_total) }}</dd>
                </div>
                <div>
                  <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Last 7 days</dt>
                  <dd class="text-sm font-extrabold text-slate-900 dark:text-white">{{ fmtMinutes(summary.study_minutes_7d) }}</dd>
                </div>
                <div>
                  <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Active days</dt>
                  <dd class="text-sm font-extrabold text-slate-900 dark:text-white">{{ calendarTotals.active }} <span class="text-[11px] font-semibold text-slate-400">/ 84</span></dd>
                </div>
                <div>
                  <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Per active day</dt>
                  <dd class="text-sm font-extrabold text-slate-900 dark:text-white">{{ fmtMinutes(calendarTotals.perActiveDay) }}</dd>
                </div>
              </dl>
            </section>

            <section class="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0">
              <div class="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 class="text-base font-bold text-slate-900 dark:text-white">⭐ XP per week</h2>
                  <p class="text-[11px] text-slate-400">Last 12 weeks · highlighted bar = this week</p>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-lg font-extrabold text-slate-900 dark:text-white leading-none">{{ fmtNum(xpWeekStats.total) }}</p>
                  <p class="text-[10px] text-slate-400">XP in 12 weeks</p>
                </div>
              </div>
              <XpWeeklyChart :weeks="xpWeekly" :dark="isDark" />
              <dl class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-3">
                <div>
                  <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">This week</dt>
                  <dd class="text-sm font-extrabold text-slate-900 dark:text-white">{{ fmtNum(xpWeekStats.thisWeek) }} XP</dd>
                </div>
                <div>
                  <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Weekly avg</dt>
                  <dd class="text-sm font-extrabold text-slate-900 dark:text-white">{{ fmtNum(xpWeekStats.avg) }} XP</dd>
                </div>
                <div>
                  <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Best week</dt>
                  <dd class="text-sm font-extrabold text-slate-900 dark:text-white">{{ fmtNum(xpWeekStats.best) }} XP</dd>
                </div>
              </dl>
            </section>
          </div>

          <!-- XP breakdown + recent XP -->
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <section class="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0">
              <h2 class="text-base font-bold text-slate-900 dark:text-white">Where their XP comes from</h2>
              <p class="text-[11px] text-slate-400">All time</p>
              <div v-if="!xpReasons.length" class="py-8 text-center text-xs text-slate-400">No XP earned yet.</div>
              <ul v-else class="mt-3 space-y-3">
                <li v-for="r in xpReasons" :key="r.key" class="min-w-0">
                  <div class="flex items-center justify-between gap-3 text-sm">
                    <span class="flex items-center gap-2 min-w-0">
                      <span class="shrink-0">{{ r.icon }}</span>
                      <span class="font-semibold text-slate-800 dark:text-slate-100 truncate">{{ r.many }}</span>
                      <span class="text-[11px] text-slate-400 shrink-0">× {{ fmtNum(r.count) }}</span>
                    </span>
                    <span class="shrink-0 text-right">
                      <span class="font-extrabold text-slate-900 dark:text-white">{{ fmtNum(r.xp) }}</span>
                      <span class="text-[11px] text-slate-400"> XP · {{ r.share }}%</span>
                    </span>
                  </div>
                  <div class="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div class="h-full rounded-full bg-emerald-500 dark:bg-emerald-400" :style="{ width: `${r.width}%` }"></div>
                  </div>
                </li>
              </ul>
            </section>

            <section class="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0">
              <h2 class="text-base font-bold text-slate-900 dark:text-white">Recent XP</h2>
              <p class="text-[11px] text-slate-400">Latest {{ recentXp.length || '' }} awards</p>
              <div v-if="!recentXp.length" class="py-8 text-center text-xs text-slate-400">Nothing yet.</div>
              <ul v-else class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                <li v-for="(e, i) in visibleXp" :key="i" class="flex items-center gap-3 py-2.5">
                  <span class="w-8 h-8 rounded-full bg-emerald-50 dark:bg-slate-800 flex items-center justify-center text-sm shrink-0">
                    {{ reasonInfo(e?.reason).icon }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ reasonInfo(e?.reason).one }}</p>
                    <p class="text-[11px] text-slate-400 truncate">
                      {{ e?.course_title || (e?.has_course ? 'Another class' : 'General') }} · {{ timeAgo(e?.created_at) }}
                    </p>
                  </div>
                  <span
                    :class="['text-sm font-extrabold shrink-0', num(e?.amount) < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400']"
                  >{{ num(e?.amount) < 0 ? '' : '+' }}{{ fmtNum(e?.amount) }} XP</span>
                </li>
              </ul>
              <button
                v-if="recentXp.length > LIST_PREVIEW"
                @click="showAllXp = !showAllXp"
                class="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {{ showAllXp ? 'Show less' : `Show all ${recentXp.length}` }}
              </button>
            </section>
          </div>

          <!-- Quiz scores -->
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <section class="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0">
              <h2 class="text-base font-bold text-slate-900 dark:text-white">🎯 Quiz scores</h2>
              <p class="text-[11px] text-slate-400 mb-3">Each submission over time · last {{ quizHistory.length || 0 }}</p>
              <QuizScoreChart :quizzes="quizHistory" :dark="isDark" />
              <dl v-if="quizStats" class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-3">
                <div>
                  <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Average</dt>
                  <dd class="text-sm font-extrabold text-slate-900 dark:text-white">{{ quizStats.avg }}%</dd>
                </div>
                <div>
                  <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pass rate</dt>
                  <dd class="text-sm font-extrabold text-slate-900 dark:text-white">{{ quizStats.passRate }}%</dd>
                </div>
                <div>
                  <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Best</dt>
                  <dd class="text-sm font-extrabold text-slate-900 dark:text-white">{{ quizStats.best }}%</dd>
                </div>
              </dl>
            </section>

            <section class="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0">
              <h2 class="text-base font-bold text-slate-900 dark:text-white">Recent quizzes</h2>
              <p class="text-[11px] text-slate-400">Newest first</p>
              <div v-if="!quizHistory.length" class="py-8 text-center text-xs text-slate-400">No quiz submissions yet.</div>
              <template v-else>
                <ul class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                  <li v-for="(q, i) in visibleQuizzes" :key="`${q?.quiz_id}-${i}`" class="flex items-center gap-3 py-2.5">
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ q?.title || 'Quiz' }}</p>
                      <p class="text-[11px] text-slate-400 truncate">{{ q?.course_title || '—' }} · {{ shortDate(q?.submitted_at) }}</p>
                    </div>
                    <span class="text-sm font-extrabold text-slate-900 dark:text-white shrink-0">
                      {{ q?.score != null ? `${Math.round(num(q.score))}%` : '—' }}
                    </span>
                    <span
                      :class="[
                        'w-16 text-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0',
                        q?.passed
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                      ]"
                    >{{ q?.passed ? '✓ Pass' : '✕ Fail' }}</span>
                  </li>
                </ul>
                <button
                  v-if="quizHistory.length > LIST_PREVIEW"
                  @click="showAllQuizzes = !showAllQuizzes"
                  class="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  {{ showAllQuizzes ? 'Show less' : `Show all ${quizHistory.length}` }}
                </button>
              </template>
            </section>
          </div>

          <!-- Assignments -->
          <section class="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="text-base font-bold text-slate-900 dark:text-white">📝 Assignments</h2>
                <p class="text-[11px] text-slate-400">Every published assignment in {{ isTeacher ? 'your classes' : 'their courses' }} · newest first</p>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span class="px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {{ fmtNum(summary.assignments_submitted) }} submitted
                </span>
                <span
                  :class="[
                    'px-2 py-0.5 rounded-md font-bold',
                    num(summary.assignments_missing) > 0
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                  ]"
                >{{ fmtNum(summary.assignments_missing) }} missing</span>
              </div>
            </div>

            <div v-if="!assignmentHistory.length" class="py-8 text-center text-xs text-slate-400">No assignments yet.</div>
            <template v-else>
              <!-- Column headings (sm+ only; rows stack into cards on phones) -->
              <div class="hidden sm:grid grid-cols-12 gap-3 mt-4 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span class="col-span-5">Assignment</span>
                <span class="col-span-2">Status</span>
                <span class="col-span-3">Score</span>
                <span class="col-span-2 text-right">Due</span>
              </div>
              <ul class="mt-2 space-y-2 sm:space-y-0 sm:divide-y sm:divide-slate-100 sm:dark:divide-slate-800">
                <li
                  v-for="(a, i) in visibleAssignments"
                  :key="`${a?.assignment_id}-${i}`"
                  class="rounded-xl border border-slate-100 dark:border-slate-800 p-3 sm:rounded-none sm:border-0 sm:grid sm:grid-cols-12 sm:gap-3 sm:items-center"
                >
                  <div class="sm:col-span-5 min-w-0 flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ a?.title || 'Assignment' }}</p>
                      <p class="text-[11px] text-slate-400 truncate">
                        {{ a?.course_title || '—' }}
                        <template v-if="a?.type"> · {{ a.type === 'quiz' ? 'Quiz' : 'File' }}</template>
                      </p>
                    </div>
                    <!-- status chip sits beside the title on phones -->
                    <span :class="['sm:hidden px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0', statusOf(a).tone]">
                      {{ statusOf(a).label }}
                    </span>
                  </div>
                  <div class="hidden sm:block sm:col-span-2">
                    <span :class="['px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide', statusOf(a).tone]">
                      {{ statusOf(a).label }}
                    </span>
                  </div>
                  <div class="sm:col-span-3 mt-2 sm:mt-0 flex items-center justify-between sm:block text-xs">
                    <span class="sm:hidden text-[10px] font-bold uppercase tracking-wide text-slate-400">Score</span>
                    <span class="font-semibold text-slate-700 dark:text-slate-200">{{ assignmentScore(a) }}</span>
                  </div>
                  <div class="sm:col-span-2 mt-1 sm:mt-0 flex items-center justify-between sm:block sm:text-right text-xs">
                    <span class="sm:hidden text-[10px] font-bold uppercase tracking-wide text-slate-400">Due</span>
                    <span>
                      <span :class="a?.status === 'missing' ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'">
                        {{ a?.due_date ? shortDate(a.due_date) : 'No due date' }}
                      </span>
                      <span v-if="a?.submitted_at" class="block text-[10px] text-slate-400">sent {{ shortDate(a.submitted_at) }}</span>
                    </span>
                  </div>
                </li>
              </ul>
              <button
                v-if="assignmentHistory.length > LIST_PREVIEW"
                @click="showAllAssignments = !showAllAssignments"
                class="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {{ showAllAssignments ? 'Show less' : `Show all ${assignmentHistory.length}` }}
              </button>
            </template>
          </section>

          <!-- Live classes + achievements -->
          <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <section class="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h2 class="text-base font-bold text-slate-900 dark:text-white">🎥 Live classes</h2>
                  <p class="text-[11px] text-slate-400">Recently joined</p>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">{{ fmtNum(liveClasses.attended ?? summary.live_classes_attended) }}</p>
                  <p class="text-[10px] text-slate-400">attended</p>
                </div>
              </div>
              <div v-if="!liveRecent.length" class="py-8 text-center text-xs text-slate-400">Hasn't joined a live class yet.</div>
              <ul v-else class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                <li v-for="(l, i) in liveRecent" :key="`${l?.live_class_id}-${i}`" class="flex items-center gap-3 py-2.5">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ l?.title || 'Live class' }}</p>
                    <p class="text-[11px] text-slate-400 truncate">{{ l?.course_title || '—' }} · {{ shortDate(l?.joined_at) }}</p>
                  </div>
                  <span class="text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
                    {{ l?.minutes != null ? fmtMinutes(l.minutes) : '—' }}
                  </span>
                </li>
              </ul>
            </section>

            <section class="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm min-w-0">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h2 class="text-base font-bold text-slate-900 dark:text-white">🏅 Achievements</h2>
                  <p class="text-[11px] text-slate-400">{{ earnedBadges.length }} of {{ earnedBadges.length + lockedBadges.length }} badges earned</p>
                </div>
              </div>

              <div v-if="!earnedBadges.length && !lockedBadges.length" class="py-8 text-center text-xs text-slate-400">No badges available.</div>
              <template v-else>
                <div v-if="earnedBadges.length" class="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  <div
                    v-for="b in earnedBadges"
                    :key="b.code"
                    :title="b.description || ''"
                    :class="['rounded-xl border p-3 min-w-0', badgeTone(b.code)]"
                  >
                    <div class="text-2xl">{{ badgeIcon(b.code) }}</div>
                    <p class="mt-1 text-xs font-bold text-slate-900 dark:text-white truncate">{{ b.label || b.code }}</p>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{{ b.description }}</p>
                    <p class="mt-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Earned {{ shortDate(b.earned_at) }}</p>
                  </div>
                </div>
                <p v-else class="mt-3 text-xs text-slate-400">No badges earned yet.</p>

                <template v-if="lockedBadges.length">
                  <p class="mt-5 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Locked</p>
                  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    <div
                      v-for="b in lockedBadges"
                      :key="b.code"
                      :title="b.description || ''"
                      class="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-3 min-w-0 bg-slate-50/60 dark:bg-slate-800/30"
                    >
                      <div class="text-2xl grayscale opacity-40">{{ badgeIcon(b.code) }}</div>
                      <p class="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400 truncate">🔒 {{ b.label || b.code }}</p>
                      <p class="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2">{{ b.description }}</p>
                    </div>
                  </div>
                </template>
              </template>
            </section>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

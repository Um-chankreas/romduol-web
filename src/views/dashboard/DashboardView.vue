<script setup>
import { computed, onActivated, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { authService } from '../../services/authService.js';
import { courseService } from '../../services/courseService.js';
import { lessonService } from '../../services/lessonService.js';
import { analyticsService } from '../../services/analyticsService.js';
import { useTheme } from '../../composables/useTheme.js';

import Sidebar from '../../components/layout/Sidebar.vue';
import Header from '../../components/layout/Header.vue';
import CreateClassModal from '../../components/modals/CreateClassModal.vue';
import SignupsChart from '../../components/dashboard/SignupsChart.vue';

defineOptions({ name: 'DashboardView' });

const router = useRouter();
const { isDark } = useTheme();

const currentUser = authService.getCurrentUser();

const courses = ref([]);
const loading = ref(false);
const loadError = ref('');

// ── School analytics ────────────────────────────────────────────────────
const analytics = ref(null);
const analyticsLoading = ref(false);
const analyticsError = ref('');

const fetchAnalytics = async ({ silent = false } = {}) => {
  if (!silent) analyticsLoading.value = true;
  analyticsError.value = '';
  try {
    analytics.value = await analyticsService.getDashboard();
  } catch (err) {
    analyticsError.value = err.response?.data?.error || err.message || 'Failed to load analytics.';
  } finally {
    analyticsLoading.value = false;
  }
};

const fetchCourses = async ({ silent = false } = {}) => {
  if (!silent) loading.value = true;
  loadError.value = '';
  try {
    const response = await courseService.getCourses();
    courses.value = response.data?.courses || response.data || [];
  } catch (err) {
    if (!silent) loadError.value = err.response?.data?.message || err.message || 'Failed to load your classes.';
  } finally {
    if (!silent) loading.value = false;
  }
};

let isFirstActivation = true;
onActivated(() => {
  if (isFirstActivation) { isFirstActivation = false; return; }
  fetchCourses({ silent: true });
  fetchAnalytics({ silent: true });
});

onMounted(() => {
  fetchCourses();
  fetchAnalytics();
});

// ── KPI helpers ─────────────────────────────────────────────────────────
const kpis = computed(() => analytics.value?.kpis || {});

const pctChange = (cur, prev) => {
  if (prev == null || prev === 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 100);
};
const fmtDelta = (n) => (n == null ? '' : `${n > 0 ? '+' : ''}${n}%`);

const activationRate = computed(() => {
  const k = kpis.value;
  if (!k.active_eligible) return null;
  return Math.round((k.active_students_7d / k.active_eligible) * 100);
});
const conversionRate = computed(() => {
  const k = kpis.value;
  if (!k.total_students) return null;
  return Math.round((k.paid_students / k.total_students) * 100);
});
const scoreDelta = computed(() => {
  const k = kpis.value;
  if (k.avg_quiz_score_30d == null || k.avg_quiz_score_prev_30d == null) return null;
  return k.avg_quiz_score_30d - k.avg_quiz_score_prev_30d;
});

const cards = computed(() => {
  const k = kpis.value;
  const signChange = pctChange(k.new_students_7d, k.new_students_prev_7d);
  return [
    {
      label: 'Total students',
      value: k.total_students ?? '—',
      hint: `${k.new_students_7d ?? 0} new this week`,
      delta: signChange,
      icon: '🎓',
    },
    {
      label: 'Active this week',
      value: k.active_students_7d ?? '—',
      hint: activationRate.value != null ? `${activationRate.value}% of students` : 'engagement',
      delta: null,
      icon: '⚡',
    },
    {
      label: 'Paid subscribers',
      value: k.paid_students ?? '—',
      hint: conversionRate.value != null ? `${conversionRate.value}% conversion` : '—',
      delta: null,
      icon: '💳',
    },
    {
      label: 'Avg quiz score (30d)',
      value: k.avg_quiz_score_30d != null ? `${k.avg_quiz_score_30d}%` : '—',
      hint: 'vs previous 30 days',
      delta: scoreDelta.value,
      deltaUnit: 'pts',
      icon: '🎯',
    },
  ];
});

// ── At-risk / improved ──────────────────────────────────────────────────
const mostImproved = computed(() => analytics.value?.most_improved || []);
const atRisk = computed(() => analytics.value?.at_risk || []);
const atRiskTotal = computed(() => analytics.value?.at_risk_total || 0);

const RISK_LABEL = {
  declining: 'Score dropping',
  inactive: 'Inactive',
  slowing: 'Slowing down',
  stuck: 'Stuck on a lesson',
  never_started: "Hasn't started",
};
const RISK_TONE = {
  declining: 'text-red-600 bg-red-50 dark:bg-red-500/10',
  inactive: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
  slowing: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
  stuck: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10',
  never_started: 'text-slate-500 bg-slate-100 dark:bg-slate-800',
};
const idleLabel = (n) => (n == null ? '—' : n === 0 ? 'today' : n === 1 ? '1 day ago' : `${n} days ago`);
const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// ── Classes ─────────────────────────────────────────────────────────────
const recentClasses = computed(() =>
  [...courses.value]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5)
);

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
});
const today = computed(() =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
);

const navigateToDetails = (courseId) => router.push(`/courses/${courseId}`);
const openStudents = () => router.push('/students');

// ── Create Class ────────────────────────────────────────────────────────
const showCreateModal = ref(false);
const creatingCourse = ref(false);
const createError = ref('');

const openCreateModal = () => { createError.value = ''; showCreateModal.value = true; };
const closeCreateModal = () => { if (!creatingCourse.value) showCreateModal.value = false; };

const handleCreateCourse = async ({ title, description, category, color, icon, is_free, chapters = [], openAfter = false }) => {
  try {
    creatingCourse.value = true;
    createError.value = '';
    const response = await courseService.createCourse(title, description, category, color, icon, null, is_free);
    const newCourse = response.data?.course || response.course || response.data || response;
    if (newCourse?.id && chapters.length) {
      for (let i = 0; i < chapters.length; i++) {
        await lessonService.createLesson(newCourse.id, chapters[i], '', null, i + 1);
      }
    }
    if (newCourse) courses.value.unshift(newCourse);
    showCreateModal.value = false;
    if (openAfter && newCourse?.id) router.push(`/courses/${newCourse.id}`);
  } catch (err) {
    createError.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create class.';
  } finally {
    creatingCourse.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-[#f8fafd] dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header />

      <main class="p-6 sm:p-8 flex-1 w-full space-y-6">
        <!-- Welcome -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {{ greeting }}{{ currentUser?.name ? `, ${currentUser.name}` : '' }} 👋
            </h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{{ today }}</p>
          </div>
          <button
            @click="openCreateModal"
            class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#034d31] text-white font-bold text-xs shadow-md hover:bg-[#023824] transition cursor-pointer active:scale-95 shrink-0"
          >
            <span class="text-sm font-normal">+</span> Create Class
          </button>
        </div>

        <div v-if="analyticsError" class="p-4 rounded-xl bg-red-500/10 text-red-500 text-sm">{{ analyticsError }}</div>

        <!-- KPI cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div
            v-for="c in cards"
            :key="c.label"
            class="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800 shadow-sm"
          >
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{{ c.label }}</span>
              <span class="text-base">{{ c.icon }}</span>
            </div>
            <p class="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
              {{ analyticsLoading ? '—' : c.value }}
            </p>
            <div class="mt-1 flex items-center gap-2 text-[11px]">
              <span
                v-if="c.delta != null && !analyticsLoading"
                :class="[
                  'font-bold px-1.5 py-0.5 rounded',
                  c.delta > 0 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10'
                  : c.delta < 0 ? 'text-red-600 bg-red-50 dark:bg-red-500/10'
                  : 'text-slate-500 bg-slate-100 dark:bg-slate-800',
                ]"
              >
                {{ c.delta > 0 ? '▲' : c.delta < 0 ? '▼' : '' }} {{ Math.abs(c.delta) }}{{ c.deltaUnit || '%' }}
              </span>
              <span class="text-slate-400 dark:text-slate-500">{{ c.hint }}</span>
            </div>
          </div>
        </div>

        <!-- Growth chart -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-white">Student growth</h2>
              <p class="text-[11px] text-slate-400">New sign-ups per week · last 12 weeks</p>
            </div>
            <button @click="openStudents" class="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline">
              All students →
            </button>
          </div>
          <SignupsChart :weeks="analytics?.signups_weekly || []" :dark="isDark" />
        </div>

        <!-- Improved + At-risk -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Most improved -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              📈 Most improved
              <span class="text-[11px] font-normal text-slate-400">last 30d vs previous 30d</span>
            </h2>
            <div v-if="analyticsLoading" class="py-8 text-center text-xs text-slate-400">Loading…</div>
            <div v-else-if="!mostImproved.length" class="py-8 text-center text-xs text-slate-400">
              Not enough quiz history yet.
            </div>
            <ul v-else class="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              <li v-for="s in mostImproved" :key="s.student_id" class="flex items-center gap-3 py-2.5">
                <div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center justify-center shrink-0 overflow-hidden">
                  <img v-if="s.avatar_url" :src="s.avatar_url" class="w-full h-full object-cover" alt="" />
                  <span v-else>{{ initials(s.name) }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ s.name || 'Student' }}</p>
                  <p class="text-[11px] text-slate-400">{{ s.prior_avg }}% → {{ s.recent_avg }}% · {{ s.quizzes }} quizzes</p>
                </div>
                <span class="text-sm font-extrabold text-emerald-600 shrink-0">▲ {{ s.delta }}</span>
              </li>
            </ul>
          </div>

          <!-- At risk -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              ⚠️ Needs attention
              <span v-if="atRiskTotal" class="text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded">{{ atRiskTotal }}</span>
            </h2>
            <div v-if="analyticsLoading" class="py-8 text-center text-xs text-slate-400">Loading…</div>
            <div v-else-if="!atRisk.length" class="py-8 text-center text-xs text-slate-400">
              Everyone's on track 🎉
            </div>
            <ul v-else class="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              <li v-for="s in atRisk" :key="s.student_id" class="flex items-center gap-3 py-2.5">
                <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center justify-center shrink-0 overflow-hidden">
                  <img v-if="s.avatar_url" :src="s.avatar_url" class="w-full h-full object-cover" alt="" />
                  <span v-else>{{ initials(s.name) }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ s.name || 'Student' }}</p>
                  <p class="text-[11px] text-slate-400">
                    <template v-if="s.reason === 'declining'">Avg {{ s.recent_avg }}% ({{ s.delta }} pts)</template>
                    <template v-else>Last active {{ idleLabel(s.days_inactive) }}</template>
                  </p>
                </div>
                <span :class="['text-[10px] font-bold px-2 py-1 rounded shrink-0', RISK_TONE[s.reason] || RISK_TONE.never_started]">
                  {{ RISK_LABEL[s.reason] || s.reason }}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Recent classes -->
        <div v-if="loadError" class="p-4 rounded-xl bg-red-500/10 text-red-500 text-sm">{{ loadError }}</div>
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">Recent classes</h2>
            <router-link to="/" class="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline">View all →</router-link>
          </div>
          <div v-if="loading" class="text-center py-8 text-slate-500 text-sm">Loading classes…</div>
          <div v-else-if="recentClasses.length === 0" class="text-center py-8 text-slate-500 text-sm">
            No classes yet. Create your first class to get started.
          </div>
          <div v-else class="divide-y divide-slate-100 dark:divide-slate-800">
            <button
              v-for="course in recentClasses"
              :key="course.id"
              @click="navigateToDetails(course.id)"
              class="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition rounded-xl px-2 -mx-2 cursor-pointer"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0" :style="{ backgroundColor: course.color || '#034d31' }">
                  <span>{{ course.icon || '📚' }}</span>
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ course.title }}</p>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">{{ course.category || 'General' }}</p>
                </div>
              </div>
              <span class="text-xs text-slate-400 shrink-0">{{ course.student_count || 0 }} students</span>
            </button>
          </div>
        </div>
      </main>
    </div>

    <CreateClassModal
      v-if="showCreateModal"
      :creating="creatingCourse"
      :error="createError"
      @close="closeCreateModal"
      @create="handleCreateCourse"
    />
  </div>
</template>

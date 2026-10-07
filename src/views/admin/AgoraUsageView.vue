<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { Activity, Video, Clock, TrendingUp, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'
import Footer from '@/components/layout/Footer.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { agoraUsageService } from '@/services/agoraUsageService'
import { useLanguage } from '@/composables/useLanguage'

defineOptions({ name: 'AgoraUsageView' })
const { t } = useLanguage()

const nowMonth = () => new Date().toISOString().slice(0, 7)
const month = ref(nowMonth())
const data = ref(null)
const loading = ref(true)
const error = ref('')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    data.value = await agoraUsageService.getUsage(month.value)
  } catch (e) {
    error.value = e.response?.data?.error || 'Could not load Agora usage.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
onActivated(() => { if (data.value) load() })

const shiftMonth = (delta) => {
  const [y, m] = month.value.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  const next = d.toISOString().slice(0, 7)
  if (next > nowMonth()) return
  month.value = next
  load()
}
const monthLabel = computed(() => {
  const [y, m] = month.value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
})
const atCurrent = computed(() => month.value >= nowMonth())

const fmt = (n) => Math.round(n ?? 0).toLocaleString()
const hours = (min) => `${(min / 60).toFixed(1)} h`

// Green while comfortable, amber past 70%, red past 90%.
const tone = computed(() => {
  const p = data.value?.percent_used ?? 0
  return p >= 90 ? 'bg-red-500' : p >= 70 ? 'bg-amber-500' : 'bg-[#006A3A]'
})
const barWidth = computed(() => `${Math.min(100, data.value?.percent_used ?? 0)}%`)
const willExceed = computed(() => data.value && data.value.is_current_month && data.value.projected_minutes > data.value.free_minutes)

const maxDaily = computed(() => Math.max(1, ...(data.value?.daily || []).map((d) => d.minutes)))
const kindEntries = computed(() => Object.entries(data.value?.by_kind || {}).sort((a, b) => b[1] - a[1]))
const kindLabel = { student: 'Students', teacher: 'Teachers', co_host: 'Speaking students', admin: 'Admins', recorder: 'OBS recorder' }
const dayNum = (iso) => Number(iso.slice(8))
const fmtDate = (iso) => (iso ? new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '')
</script>

<template>
  <div class="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0 min-h-0">
      <Header>
        <template #left>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white truncate">{{ t('Agora Usage') }}</h1>
        </template>
      </Header>

      <div class="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <main class="p-4 sm:p-8 flex-1 w-full max-w-6xl space-y-6">
          <!-- Title + month picker -->
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 class="text-2xl font-extrabold leading-tight text-slate-900 dark:text-white">{{ t('Agora usage') }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{{ t('Estimated from live class attendance. The Agora console is the source of truth for billing.') }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" @click="shiftMonth(-1)" aria-label="Previous month"
                class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"><ChevronLeft class="w-4 h-4" /></button>
              <span class="min-w-36 text-center text-sm font-bold text-slate-900 dark:text-white">{{ monthLabel }}</span>
              <button type="button" @click="shiftMonth(1)" :disabled="atCurrent" aria-label="Next month"
                class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"><ChevronRight class="w-4 h-4" /></button>
              <button type="button" @click="load" aria-label="Refresh"
                class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"><RefreshCw :class="['w-4 h-4', loading && 'animate-spin']" /></button>
            </div>
          </div>

          <p v-if="error" class="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" /> {{ error }}
          </p>

          <!-- Quota meter -->
          <section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6">
            <Skeleton v-if="loading && !data" class="h-24 w-full" />
            <template v-else-if="data">
              <div class="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('Minutes used') }}</p>
                  <p class="text-4xl font-extrabold text-slate-900 dark:text-white leading-none mt-1">
                    {{ fmt(data.used_minutes) }}
                    <span class="text-base font-bold text-slate-400"> / {{ fmt(data.free_minutes) }}</span>
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ data.overage_minutes ? t('Over the free plan') : t('Remaining') }}</p>
                  <p :class="['text-2xl font-extrabold leading-none mt-1', data.overage_minutes ? 'text-red-600' : 'text-[#006A3A] dark:text-emerald-400']">
                    {{ fmt(data.overage_minutes || data.remaining_minutes) }} <span class="text-sm font-bold">min</span>
                  </p>
                </div>
              </div>
              <div class="mt-4 h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div :class="['h-full rounded-full transition-all', tone]" :style="{ width: barWidth }" />
              </div>
              <div class="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{{ data.percent_used }}% {{ t('used') }}</span>
                <span v-if="data.is_current_month" :class="willExceed ? 'text-red-600 font-bold' : ''">
                  <TrendingUp class="inline w-3.5 h-3.5 -mt-0.5" />
                  {{ t('On pace for') }} {{ fmt(data.projected_minutes) }} {{ t('min this month') }}
                </span>
              </div>
              <p v-if="willExceed" class="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle class="w-4 h-4 shrink-0" /> {{ t('At this pace you will pass the free minutes before the month ends.') }}
              </p>
            </template>
          </section>

          <!-- Stat cards -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div v-for="c in [
              { label: t('Hours of video'), value: data ? hours(data.used_minutes) : '', icon: Clock },
              { label: t('Classes this month'), value: data ? data.classes.length : '', icon: Video },
              { label: t('In a class now'), value: data ? data.active_now : '', icon: Activity },
              { label: t('Daily average'), value: data ? fmt(data.used_minutes / Math.max(1, data.daily.filter(d => d.minutes).length)) + ' min' : '', icon: TrendingUp },
            ]" :key="c.label"
              class="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-5 py-4">
              <div>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ c.label }}</p>
                <Skeleton v-if="loading && !data" class="h-6 w-16 mt-1.5" />
                <p v-else class="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 leading-none">{{ c.value }}</p>
              </div>
              <component :is="c.icon" class="w-4 h-4 text-slate-400" />
            </div>
          </div>

          <!-- Daily chart -->
          <section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6">
            <h3 class="text-sm font-extrabold text-slate-900 dark:text-white mb-4">{{ t('Minutes per day') }}</h3>
            <Skeleton v-if="loading && !data" class="h-40 w-full" />
            <div v-else-if="data" class="flex items-end gap-[3px] h-40" role="img" :aria-label="t('Minutes per day')">
              <div v-for="d in data.daily" :key="d.date" class="group relative flex-1 h-full flex items-end" >
                <div class="w-full rounded-t bg-[#006A3A]/80 group-hover:bg-[#006A3A] transition-colors"
                  :style="{ height: d.minutes ? Math.max(3, (d.minutes / maxDaily) * 100) + '%' : '2px', opacity: d.minutes ? 1 : 0.25 }" />
                <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded-md bg-slate-900 text-white text-[11px] font-semibold px-2 py-1 z-10">
                  {{ fmtDate(d.date + 'T00:00:00Z') }} · {{ fmt(d.minutes) }} min
                </span>
              </div>
            </div>
            <div v-if="data" class="mt-2 flex justify-between text-[11px] text-slate-400">
              <span>1</span><span>{{ dayNum(data.daily[data.daily.length - 1].date) }}</span>
            </div>
          </section>

          <div class="grid lg:grid-cols-3 gap-6">
            <!-- By participant type -->
            <section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6">
              <h3 class="text-sm font-extrabold text-slate-900 dark:text-white mb-4">{{ t('Who used the minutes') }}</h3>
              <p v-if="data && !kindEntries.length" class="text-sm text-slate-400">{{ t('No usage yet this month.') }}</p>
              <ul v-else-if="data" class="space-y-3">
                <li v-for="[k, v] in kindEntries" :key="k">
                  <div class="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <span>{{ t(kindLabel[k] || k) }}</span><span>{{ fmt(v) }} min</span>
                  </div>
                  <div class="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div class="h-full rounded-full bg-[#ffce04]" :style="{ width: (v / Math.max(1, data.used_minutes)) * 100 + '%' }" />
                  </div>
                </li>
              </ul>
            </section>

            <!-- By class -->
            <section class="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 min-w-0">
              <h3 class="text-sm font-extrabold text-slate-900 dark:text-white mb-4">{{ t('Classes using the most minutes') }}</h3>
              <p v-if="data && !data.classes.length" class="text-sm text-slate-400">{{ t('No live classes yet this month.') }}</p>
              <div v-else-if="data" class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr><th class="py-2 pr-3">{{ t('Class') }}</th><th class="py-2 pr-3">{{ t('Teacher') }}</th><th class="py-2 pr-3 text-right">{{ t('People') }}</th><th class="py-2 text-right">{{ t('Minutes') }}</th></tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                    <tr v-for="c in data.classes" :key="c.live_class_id">
                      <td class="py-2.5 pr-3">
                        <p class="font-bold text-slate-900 dark:text-white line-clamp-1">{{ c.title }}</p>
                        <p class="text-[11px] text-slate-400">{{ c.course }}<template v-if="c.started_at"> · {{ fmtDate(c.started_at) }}</template></p>
                      </td>
                      <td class="py-2.5 pr-3">{{ c.teacher || '—' }}</td>
                      <td class="py-2.5 pr-3 text-right tabular-nums">{{ c.participants }}</td>
                      <td class="py-2.5 text-right tabular-nums font-bold">{{ fmt(c.minutes) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  </div>
</template>

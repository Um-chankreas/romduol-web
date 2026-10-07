<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, onActivated } from 'vue'
import { Activity, Video, Clock, TrendingUp, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Plus, Trash2, Pencil, MoreHorizontal, CheckCircle2, X, KeyRound } from 'lucide-vue-next'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'
import Footer from '@/components/layout/Footer.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import { agoraUsageService } from '@/services/agoraUsageService'
import { authService } from '@/services/authService'
import { useLanguage } from '@/composables/useLanguage'

defineOptions({ name: 'AgoraUsageView' })
const { t } = useLanguage()

const nowMonth = () => new Date().toISOString().slice(0, 7)
const month = ref(nowMonth())
const data = ref(null)
const loading = ref(true)
const error = ref('')

// ---- accounts ----
const isSuperAdmin = authService.getCurrentUser()?.role === 'super_admin'
const accounts = ref([])
const viewing = ref('')            // account whose usage is shown ('' = the active one)
const switching = ref('')
const notice = ref('')
const showAdd = ref(false)
const syncing = ref(null)           // account whose console minutes are being entered
const syncValue = ref(0)
const syncSaving = ref(false)
const syncError = ref('')
const editingId = ref('')          // '' = adding, otherwise the account being edited
const saving = ref(false)
const addError = ref('')
const form = reactive({ label: '', email: '', app_id: '', app_certificate: '', free_minutes: 10000 })

const errMsg = (e, fallback) => e.response?.data?.error || fallback
const loadAccounts = async () => {
  try { accounts.value = await agoraUsageService.listAccounts() } catch (e) { error.value = errMsg(e, 'Could not load Agora accounts.') }
}
const activeAccount = computed(() => accounts.value.find((a) => a.is_active))
// The account in use goes first; the rest keep their order.
const sortedAccounts = computed(() => [...accounts.value].sort((x, y) => Number(y.is_active) - Number(x.is_active)))

// Which card's ⋯ menu is open; any outside click closes it.
const menuFor = ref('')
const closeMenu = (e) => { if (!e.target.closest?.('.agora-menu')) menuFor.value = '' }
const maskId = (id) => (id ? `${id.slice(0, 4)}…${id.slice(-4)}` : '—')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    data.value = await agoraUsageService.getUsage(month.value, viewing.value || undefined)
  } catch (e) {
    error.value = errMsg(e, 'Could not load Agora usage.')
  } finally {
    loading.value = false
  }
}
const refreshAll = () => Promise.all([loadAccounts(), load()])
onMounted(() => { refreshAll(); document.addEventListener('click', closeMenu) })
onBeforeUnmount(() => document.removeEventListener('click', closeMenu))
onActivated(() => { if (data.value) refreshAll() })

const view = (a) => { viewing.value = a.id; load() }

const switchTo = async (a) => {
  if (!window.confirm(`${t('Switch live classes to')} "${a.label}"?\n\n${t('Classes that start from now on will use this account. A class that is already running keeps its current one.')}`)) return
  switching.value = a.id
  error.value = ''
  notice.value = ''
  try {
    accounts.value = await agoraUsageService.activateAccount(a.id)
    viewing.value = ''
    notice.value = `${t('Now using')} "${a.label}" ${t('for new live classes.')}`
    await load()
  } catch (e) {
    error.value = errMsg(e, 'Could not switch account.')
  } finally {
    switching.value = ''
  }
}

const makeEditable = async () => {
  if (!window.confirm(`${t('Make the default account editable?')}\n\n${t('It is copied into the database (the certificate is stored encrypted) so you can edit or delete it like the others. Usage and running classes carry over.')}`)) return
  error.value = ''
  try {
    accounts.value = await agoraUsageService.makeEnvEditable()
    notice.value = t('The default account is now editable.')
    await load()
  } catch (e) {
    error.value = errMsg(e, 'Could not make the account editable.')
  }
}

const removeAcc = async (a) => {
  if (!window.confirm(`${t('Remove')} "${a.label}"?`)) return
  error.value = ''
  try {
    accounts.value = await agoraUsageService.removeAccount(a.id)
    if (viewing.value === a.id) { viewing.value = ''; await load() }
  } catch (e) {
    error.value = errMsg(e, 'Could not remove account.')
  }
}

const openSync = (a) => {
  syncing.value = a
  syncValue.value = a.used_minutes
  syncError.value = ''
}
const saveSync = async () => {
  syncSaving.value = true
  syncError.value = ''
  try {
    accounts.value = await agoraUsageService.setUsedMinutes(syncing.value.id, Number(syncValue.value))
    notice.value = `${t('Usage updated for')} "${syncing.value.label}".`
    syncing.value = null
    await load()
  } catch (e) {
    syncError.value = errMsg(e, 'Could not update usage.')
  } finally {
    syncSaving.value = false
  }
}

const openAdd = () => {
  editingId.value = ''
  Object.assign(form, { label: '', email: '', app_id: '', app_certificate: '', free_minutes: 10000 })
  addError.value = ''
  showAdd.value = true
}
const openEdit = (a) => {
  editingId.value = a.id
  Object.assign(form, { label: a.label, email: a.email || '', app_id: a.app_id || '', app_certificate: '', free_minutes: a.free_minutes })
  addError.value = ''
  showAdd.value = true
}
const saveAccount = async () => {
  saving.value = true
  addError.value = ''
  try {
    if (editingId.value) {
      // The certificate is never sent back, so a blank box means "keep the stored one".
      const body = { label: form.label, email: form.email, app_id: form.app_id, free_minutes: form.free_minutes }
      if (form.app_certificate) body.app_certificate = form.app_certificate
      accounts.value = await agoraUsageService.updateAccount(editingId.value, body)
      notice.value = t('Account updated.')
    } else {
      accounts.value = await agoraUsageService.addAccount({ ...form })
      notice.value = t('Account added. Press "Use this account" when you want new classes to switch to it.')
    }
    showAdd.value = false
    form.app_certificate = ''
    if (viewing.value === editingId.value || !viewing.value) await load()
  } catch (e) {
    addError.value = errMsg(e, 'Could not add account.')
  } finally {
    saving.value = false
  }
}

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

          <p v-if="notice" class="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 class="w-4 h-4 mt-0.5 shrink-0" /> {{ notice }}
          </p>

          <!-- Agora accounts: switch when one runs out -->
          <section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 class="text-sm font-extrabold text-slate-900 dark:text-white">{{ t('Agora accounts') }}</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ t('New live classes use the account marked Active. Switch when its free minutes run out.') }}</p>
              </div>
              <button v-if="isSuperAdmin" type="button" @click="openAdd"
                class="inline-flex items-center gap-1.5 bg-[#006A3A] hover:bg-[#005A31] text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer">
                <Plus class="w-4 h-4" /> {{ t('Add account') }}
              </button>
            </div>
            <Skeleton v-if="!accounts.length" class="h-24 w-full" />
            <div v-else class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div v-for="a in sortedAccounts" :key="a.id"
                :class="['relative rounded-2xl border p-4 flex flex-col gap-3 transition',
                  a.is_active
                    ? 'bg-[#006A3A] border-[#006A3A] text-white shadow-md shadow-emerald-900/10'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700']">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p :class="['font-bold truncate', a.is_active ? 'text-white' : 'text-slate-900 dark:text-white']">{{ a.label }}</p>
                    <p v-if="a.email" :class="['text-[11px] truncate', a.is_active ? 'text-white/80' : 'text-slate-500 dark:text-slate-400']" :title="a.email">{{ a.email }}</p>
                    <p :class="['text-[11px] flex items-center gap-1', a.is_active ? 'text-white/60' : 'text-slate-400']"><KeyRound class="w-3 h-3" /> {{ maskId(a.app_id) }}</p>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <span v-if="a.is_active" class="px-2 py-0.5 rounded-full bg-[#ffce04] text-[#3d3000] text-[10px] font-bold uppercase tracking-wide">{{ t('Active') }}</span>

                    <!-- ⋯ menu -->
                    <div class="agora-menu relative">
                      <button type="button" @click.stop="menuFor = menuFor === a.id ? '' : a.id" :aria-expanded="menuFor === a.id" :aria-label="t('More options')"
                        :class="['p-1.5 rounded-lg cursor-pointer transition', a.is_active ? 'text-white hover:bg-white/15' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800']">
                        <MoreHorizontal class="w-4 h-4" />
                      </button>
                      <div v-if="menuFor === a.id" class="absolute right-0 top-full mt-1 z-30 w-48 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg py-1 text-slate-700 dark:text-slate-200">
                        <button type="button" @click="menuFor = ''; view(a)"
                          class="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                          <Activity class="w-3.5 h-3.5" /> {{ t('View usage') }}</button>
                        <template v-if="isSuperAdmin">
                          <button type="button" @click="menuFor = ''; openSync(a)"
                            class="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                            <RefreshCw class="w-3.5 h-3.5" /> {{ t('Update usage') }}</button>
                          <template v-if="a.source === 'db'">
                            <button type="button" @click="menuFor = ''; openEdit(a)"
                              class="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                              <Pencil class="w-3.5 h-3.5" /> {{ t('Edit') }}</button>
                            <div class="my-1 border-t border-slate-100 dark:border-slate-700" />
                            <button type="button" @click="menuFor = ''; removeAcc(a)" :disabled="a.is_active"
                              :title="a.is_active ? t('Switch to another account before deleting this one') : ''"
                              class="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer">
                              <Trash2 class="w-3.5 h-3.5" /> {{ t('Delete') }}</button>
                          </template>
                          <template v-else>
                            <div class="my-1 border-t border-slate-100 dark:border-slate-700" />
                            <button type="button" @click="menuFor = ''; makeEditable()"
                              class="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                              <Pencil class="w-3.5 h-3.5" /> {{ t('Make editable') }}</button>
                            <p class="px-3 pb-2 text-[11px] text-slate-400">{{ t('Set in the server .env') }}</p>
                          </template>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div :class="['flex justify-between text-xs font-semibold', a.is_active ? 'text-white' : 'text-slate-600 dark:text-slate-300']">
                    <span>{{ fmt(a.used_minutes) }} / {{ fmt(a.free_minutes) }} min</span>
                    <span :class="a.percent_used >= 90 ? (a.is_active ? 'text-[#ffce04]' : 'text-red-600') : ''">{{ a.percent_used }}%</span>
                  </div>
                  <div :class="['mt-1 h-2 rounded-full overflow-hidden', a.is_active ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800']">
                    <div :class="['h-full rounded-full', a.is_active ? 'bg-[#ffce04]' : a.percent_used >= 90 ? 'bg-red-500' : a.percent_used >= 70 ? 'bg-amber-500' : 'bg-[#006A3A]']"
                      :style="{ width: Math.min(100, a.percent_used) + '%' }" />
                  </div>
                  <p v-if="a.percent_used >= 100" :class="['mt-1 text-[11px] font-bold', a.is_active ? 'text-[#ffce04]' : 'text-red-600']">{{ t('Free minutes used up') }}</p>
                </div>

                <p v-if="a.is_active" class="mt-auto flex items-center gap-1.5 text-xs font-bold text-white/90">
                  <CheckCircle2 class="w-4 h-4" /> {{ t('In use for new classes') }}
                </p>
                <button v-else-if="isSuperAdmin" type="button" @click="switchTo(a)" :disabled="switching === a.id"
                  class="mt-auto w-full py-2 rounded-xl bg-[#006A3A] hover:bg-[#005A31] disabled:opacity-50 text-white text-xs font-bold cursor-pointer">
                  {{ switching === a.id ? t('Switching…') : t('Use this account') }}
                </button>
              </div>
            </div>
            <p class="mt-4 text-[11px] text-slate-400">{{ t('A class that is already running stays on the account it started with, so students and the teacher never end up in different rooms.') }}</p>
          </section>

          <!-- Quota meter -->
          <section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6">
            <Skeleton v-if="loading && !data" class="h-24 w-full" />
            <template v-else-if="data">
              <div class="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('Minutes used') }} · <b class="text-slate-700 dark:text-slate-200">{{ data.account.label }}</b></p>
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
                <span>{{ data.percent_used }}% {{ t('used') }}<template v-if="data.adjustment_minutes"> · {{ fmt(data.adjustment_minutes) }} {{ t('min synced from Agora') }}</template></span>
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

        <!-- Update usage from the Agora console -->
        <div v-if="syncing" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]" @click.self="!syncSaving && (syncing = null)">
          <form class="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-6 space-y-4" @submit.prevent="saveSync">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-extrabold text-slate-900 dark:text-white">{{ t('Update usage') }} · {{ syncing.label }}</h3>
              <button type="button" @click="syncing = null" class="p-1 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Close"><X class="w-4 h-4" /></button>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('Minutes were only counted here after tracking began. Enter what the Agora console shows as used this month (Usage → RTC monthly minutes) and this page will match it, then keep counting on top.') }}</p>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-200">{{ t('Minutes used this month (from Agora)') }}
              <input v-model.number="syncValue" type="number" min="0" step="1" required autofocus
                class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#006A3A]" />
            </label>
            <p v-if="syncing.adjustment_minutes" class="text-[11px] text-slate-400">{{ t('Currently includes') }} {{ fmt(syncing.adjustment_minutes) }} {{ t('min added manually.') }}</p>
            <p v-if="syncError" class="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" /> {{ syncError }}
            </p>
            <div class="flex justify-end gap-2 pt-1">
              <button type="button" @click="syncing = null" :disabled="syncSaving"
                class="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">{{ t('Cancel') }}</button>
              <button type="submit" :disabled="syncSaving"
                class="px-5 py-2 rounded-xl bg-[#006A3A] hover:bg-[#005A31] disabled:opacity-50 text-white text-sm font-bold cursor-pointer">{{ syncSaving ? t('Saving…') : t('Save') }}</button>
            </div>
          </form>
        </div>

        <!-- Add account -->
        <div v-if="showAdd" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]" @click.self="!saving && (showAdd = false)">
          <form class="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-6 space-y-4" @submit.prevent="saveAccount">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-extrabold text-slate-900 dark:text-white">{{ editingId ? t('Edit Agora account') : t('Add Agora account') }}</h3>
              <button type="button" @click="showAdd = false" class="p-1 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Close"><X class="w-4 h-4" /></button>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ editingId ? t('Leave the App Certificate empty to keep the one already stored.') : t('Copy the App ID and App Certificate from your project in the Agora console. The certificate is stored encrypted and is never shown again.') }}</p>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-200">{{ t('Name') }}
              <input v-model="form.label" required maxlength="60" placeholder="Account 2"
                class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#006A3A]" />
            </label>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-200">{{ t('Agora account email') }}
              <input v-model="form.email" type="email" required autocomplete="off" placeholder="name@example.com"
                class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#006A3A]" />
            </label>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-200">App ID
              <input v-model="form.app_id" required autocomplete="off" spellcheck="false" maxlength="32"
                class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono font-normal focus:outline-none focus:ring-2 focus:ring-[#006A3A]" />
            </label>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-200">App Certificate
              <input v-model="form.app_certificate" type="password" :required="!editingId" :placeholder="editingId ? '••••••••••••••••' : ''" autocomplete="new-password" spellcheck="false" maxlength="32"
                class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono font-normal focus:outline-none focus:ring-2 focus:ring-[#006A3A]" />
            </label>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-200">{{ t('Free minutes per month') }}
              <input v-model.number="form.free_minutes" type="number" min="1" required
                class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#006A3A]" />
            </label>
            <p v-if="addError" class="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" /> {{ addError }}
            </p>
            <div class="flex justify-end gap-2 pt-1">
              <button type="button" @click="showAdd = false" :disabled="saving"
                class="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">{{ t('Cancel') }}</button>
              <button type="submit" :disabled="saving"
                class="px-5 py-2 rounded-xl bg-[#006A3A] hover:bg-[#005A31] disabled:opacity-50 text-white text-sm font-bold cursor-pointer">{{ saving ? t('Saving…') : editingId ? t('Save changes') : t('Add account') }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

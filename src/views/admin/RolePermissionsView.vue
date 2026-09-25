<script setup>
import { ref, computed, onMounted } from 'vue'
import { LayoutDashboard, CalendarDays, FileText, Scissors, Minimize2, ShieldCheck, Check, RotateCcw, Info } from 'lucide-vue-next'
import { authService } from '@/services/authService'
import { permissionsService } from '@/services/permissionsService'
import Sidebar from '@/components/layout/Sidebar.vue'
import Header from '@/components/layout/Header.vue'
import Breadcrumb from '@/components/layout/Breadcrumb.vue'

defineOptions({ name: 'RolePermissionsView' })

// Same feature set the per-user override modal on the Roles page uses (see
// lms-backend/src/utils/permissions.js). Deliberately excludes Student
// Management / Roles & Permissions themselves, which stay strictly
// role-gated.
const FEATURE_OPTIONS = [
  { key: 'dashboard', label: 'Dashboard', description: 'Overview stats and activity', icon: LayoutDashboard },
  { key: 'schedule', label: 'Schedule', description: 'Class calendar and sessions', icon: CalendarDays },
  { key: 'latex_to_text', label: 'LaTeX to Text', description: 'Convert LaTeX documents', icon: FileText },
  { key: 'trim_video', label: 'Trim Video', description: 'Cut clips from recordings', icon: Scissors },
  { key: 'compress_video', label: 'Compress Video', description: 'Shrink video file size', icon: Minimize2 },
]
const ROLE_DEFAULT_ROLES = ['student', 'teacher', 'admin', 'super_admin']
const ROLE_LABELS = { student: 'Student', teacher: 'Teacher', admin: 'Admin', super_admin: 'Super Admin' }

const isSuperAdmin = authService.getCurrentUser()?.role === 'super_admin'

// The table below reads matrix[role][feature] with no guard, so the ref
// needs every cell present from the start — {} would throw (undefined[key])
// the moment it renders, before the fetch resolves or if it ever fails,
// taking the whole page down (an uncaught render error aborts mounting the
// entire component tree, not just this section).
const emptyMatrix = () => Object.fromEntries(
  ROLE_DEFAULT_ROLES.map(r => [r, Object.fromEntries(FEATURE_OPTIONS.map(f => [f.key, false]))])
)
const matrix = ref(emptyMatrix())
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const savedAt = ref(0)

// Snapshot of the last loaded/saved matrix, so we can show an "unsaved
// changes" state and offer Discard.
const snapshot = ref(JSON.stringify(emptyMatrix()))
const isDirty = computed(() => JSON.stringify(matrix.value) !== snapshot.value)
const commit = (m) => {
  matrix.value = m
  snapshot.value = JSON.stringify(m)
}
const discard = () => { matrix.value = JSON.parse(snapshot.value) }

const enabledCount = (role) => FEATURE_OPTIONS.filter(f => matrix.value[role]?.[f.key]).length
const toggle = (role, key) => {
  if (!isSuperAdmin || saving.value) return
  matrix.value[role][key] = !matrix.value[role][key]
}

const fetchDefaults = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await permissionsService.getRoleDefaults()
    commit(res?.matrix || emptyMatrix())
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to load role defaults.'
  } finally {
    loading.value = false
  }
}

const save = async () => {
  saving.value = true
  error.value = ''
  try {
    const updates = []
    for (const role of ROLE_DEFAULT_ROLES) {
      for (const { key } of FEATURE_OPTIONS) {
        updates.push({ role, feature_key: key, allowed: !!matrix.value[role]?.[key] })
      }
    }
    const res = await permissionsService.updateRoleDefaults(updates)
    commit(res?.matrix || matrix.value)
    savedAt.value = Date.now()
    setTimeout(() => { if (Date.now() - savedAt.value >= 2500) savedAt.value = 0 }, 2600)
    // Role defaults just moved for every account with that role, including
    // possibly the signed-in admin's own — refresh the cached "mine" map so
    // the sidebar reflects it without a manual reload.
    permissionsService.clearCache()
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to save role defaults.'
  } finally {
    saving.value = false
  }
}

onMounted(fetchDefaults)
</script>

<template>
  <div class="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0">
      <Header>
        <template #left>
          <Breadcrumb :items="[{ label: 'Roles & Permissions' }, { label: 'Permissions' }]" />
        </template>
      </Header>

      <main class="p-4 sm:p-8 flex-1 w-full max-w-5xl">
        <!-- Page header -->
        <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div class="flex items-start gap-3">
            <div class="hidden sm:flex w-11 h-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#006A3A] dark:bg-emerald-500/10 dark:text-emerald-400">
              <ShieldCheck class="w-5 h-5" />
            </div>
            <div>
              <h1 class="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Permissions</h1>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                Default feature access for each role. Individual users can be overridden from the Roles page.
              </p>
            </div>
          </div>

          <div v-if="isSuperAdmin" class="flex items-center gap-2">
            <span
              v-if="savedAt && !isDirty"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
            >
              <Check class="w-3.5 h-3.5" /> Saved
            </span>
            <span
              v-else-if="isDirty"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500" /> Unsaved changes
            </span>
            <button
              v-if="isDirty"
              @click="discard"
              :disabled="saving"
              class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw class="w-3.5 h-3.5" /> Discard
            </button>
            <button
              @click="save"
              :disabled="saving || loading || !isDirty"
              class="px-4 py-2.5 rounded-xl bg-[#006A3A] hover:bg-[#005A31] text-white text-xs font-bold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              {{ saving ? 'Saving...' : 'Save changes' }}
            </button>
          </div>
        </div>

        <div
          v-if="!isSuperAdmin"
          class="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400"
        >
          <Info class="w-4 h-4 shrink-0" /> View only — only a super admin can change role defaults.
        </div>

        <div
          v-if="error"
          class="mb-4 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
        >
          {{ error }}
        </div>

        <!-- Matrix -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left min-w-[640px]">
              <thead>
                <tr class="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800">
                  <th class="py-3.5 pl-6 pr-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Feature
                  </th>
                  <th v-for="r in ROLE_DEFAULT_ROLES" :key="r" class="py-3.5 px-3 text-center w-32">
                    <div class="text-xs font-bold text-slate-800 dark:text-slate-100">{{ ROLE_LABELS[r] }}</div>
                    <div class="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                      {{ loading ? '—' : `${enabledCount(r)} of ${FEATURE_OPTIONS.length}` }}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr
                  v-for="feature in FEATURE_OPTIONS"
                  :key="feature.key"
                  class="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td class="py-4 pl-6 pr-3">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <component :is="feature.icon" class="w-4 h-4" />
                      </div>
                      <div class="min-w-0">
                        <div class="text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{{ feature.label }}</div>
                        <div class="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{{ feature.description }}</div>
                      </div>
                    </div>
                  </td>
                  <td v-for="r in ROLE_DEFAULT_ROLES" :key="r" class="py-4 px-3 text-center">
                    <div v-if="loading" class="mx-auto w-9 h-5 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    <button
                      v-else
                      type="button"
                      role="switch"
                      :aria-checked="matrix[r][feature.key]"
                      :aria-label="`${feature.label} for ${ROLE_LABELS[r]}`"
                      :disabled="!isSuperAdmin || saving"
                      @click="toggle(r, feature.key)"
                      :class="[
                        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                        matrix[r][feature.key] ? 'bg-[#006A3A] dark:bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700',
                        isSuperAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                      ]"
                    >
                      <span
                        :class="[
                          'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                          matrix[r][feature.key] ? 'translate-x-[18px]' : 'translate-x-0.5',
                        ]"
                      />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

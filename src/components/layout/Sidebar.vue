<template>
  <aside class="w-64 shrink-0 border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between px-4 py-5 min-h-screen transition-colors">
    <div>
      <!-- BRAND LOGO & NAME -->
      <div class="flex items-center gap-3 mb-8 px-2">
        <img
          src="@/assets/logo/RS_logo.png"
          alt="Romduol Scholars Logo"
          class="w-11 h-11 object-contain shrink-0"
        />
        <div class="flex flex-col justify-center">
          <h2 class="!text-[#016a36] font-extrabold text-lg tracking-widest uppercase leading-none">
            ROMDUOL
          </h2>
          <span class="!text-[#ffce04] font-extrabold text-[11px] tracking-[0.22em] uppercase leading-tight mt-1">
            SCHOLARS
          </span>
        </div>
      </div>

      <nav class="space-y-1">
        <router-link v-for="item in topItems" :key="item.to" :to="item.to" :class="navClass(item.active)">
          <component :is="item.icon" :class="iconClass(item.active)" />
          <span class="truncate">{{ item.label }}</span>
        </router-link>

        <!-- Roles & Permissions group: the parent only gets a tint when one of
             its children is active; the child itself carries the highlight. -->
        <div v-if="isAdmin">
          <button
            type="button"
            @click="rolesMenuOpen = !rolesMenuOpen"
            :aria-expanded="rolesMenuOpen"
            :class="[
              'group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-colors cursor-pointer',
              isRolesSectionActive
                ? 'text-[#006A3A] dark:text-emerald-400'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white',
            ]"
          >
            <KeyRound
              :class="[
                'w-[18px] h-[18px] shrink-0',
                isRolesSectionActive ? 'text-[#006A3A] dark:text-emerald-400' : 'text-slate-400 group-hover:text-[#006A3A] dark:text-slate-500 dark:group-hover:text-emerald-400',
              ]"
            />
            <span class="flex-1 truncate">Roles & Permissions</span>
            <ChevronDown class="w-4 h-4 shrink-0 opacity-60 transition-transform" :class="{ 'rotate-180': rolesMenuOpen }" />
          </button>
          <div v-if="rolesMenuOpen" class="mt-1 mb-1 ml-[21px] pl-3 border-l border-slate-200 dark:border-slate-700 space-y-0.5">
            <router-link
              v-for="sub in rolesSubItems"
              :key="sub.to"
              :to="sub.to"
              :class="subClass(route.path === sub.to)"
            >
              <span
                v-if="route.path === sub.to"
                class="absolute -left-[13px] top-1.5 bottom-1.5 w-0.5 rounded-full bg-[#006A3A] dark:bg-emerald-400"
              />
              {{ sub.label }}
            </router-link>
          </div>
        </div>

        <template v-if="toolItems.length">
          <p class="px-3 pt-5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tools</p>
          <router-link v-for="item in toolItems" :key="item.to" :to="item.to" :class="navClass(item.active)">
            <component :is="item.icon" :class="iconClass(item.active)" />
            <span class="truncate">{{ item.label }}</span>
          </router-link>
        </template>

        <template v-if="isAdmin">
          <div class="my-4 border-t border-slate-100 dark:border-slate-800" />
          <a href="#" :class="navClass(false)">
            <Folder :class="iconClass(false)" />
            <span class="truncate">Resources</span>
          </a>
          <a href="#" :class="navClass(false)">
            <Settings :class="iconClass(false)" />
            <span class="truncate">Settings</span>
          </a>
        </template>
      </nav>
    </div>

    <!-- Pro Banner Card -->
    <div class="mt-6 rounded-2xl p-4 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-500/10 dark:to-slate-900 border border-emerald-100 dark:border-emerald-900/50">
      <div class="flex items-center gap-2 mb-1">
        <Sparkles class="w-4 h-4 text-[#ccb711]" />
        <p class="text-sm font-bold text-slate-900 dark:text-white">Upgrade to Pro</p>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">Unlock more tools and storage.</p>
      <button class="w-full bg-[#006A3A] hover:bg-[#005A31] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-sm cursor-pointer">
        Go Premium
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  LayoutDashboard, Users, GraduationCap, KeyRound, FileText, Scissors,
  Minimize2, CalendarDays, Folder, Settings, ChevronDown, Sparkles,
} from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { authService } from '../../services/authService'
import { permissionsService } from '../../services/permissionsService'

const route = useRoute()

const isAdmin = computed(() => ['admin', 'super_admin'].includes(authService.getCurrentUser()?.role))

// Per-user overrides on top of role defaults (an admin can grant/revoke each
// of these individually — see permissionsService.js). Starts as {} so every
// gated item is hidden until the real map loads, rather than flashing items
// that then disappear.
const permissions = ref({})
onMounted(async () => {
  permissions.value = await permissionsService.getPermissions()
})

// The "Roles & Permissions" group expands to reveal its two sub-pages. Starts
// open when you're already on one of them (so a page refresh there doesn't
// hide the very link you're on), closed otherwise.
const isRolesSectionActive = computed(() => route.path === '/roles' || route.path === '/roles/permissions')
const rolesMenuOpen = ref(isRolesSectionActive.value)

// "My Classes" stays highlighted on every page that belongs to that section —
// not just the exact "/" list — so it doesn't go dark the moment you open a
// class, a chapter, or a quiz/assignment editor inside one.
const isMyClassesActive = computed(() =>
  route.path === '/'
  || route.path.startsWith('/courses/')
  || route.path.startsWith('/lessons/')
  || route.path.startsWith('/course/')
)

const navClass = (active) => [
  'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors',
  active
    ? 'bg-[#006A3A] text-white shadow-sm'
    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white',
]
const iconClass = (active) => [
  'w-[18px] h-[18px] shrink-0',
  active ? 'text-white' : 'text-slate-400 group-hover:text-[#006A3A] dark:text-slate-500 dark:group-hover:text-emerald-400',
]
const subClass = (active) => [
  'relative block pl-4 pr-3 py-2 rounded-lg text-[13px] font-semibold transition-colors',
  active
    ? 'bg-emerald-50 text-[#006A3A] dark:bg-emerald-500/10 dark:text-emerald-400'
    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white',
]

const topItems = computed(() => [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: permissions.value.dashboard, active: route.path === '/dashboard' },
  { to: '/', label: 'My Classes', icon: Users, show: true, active: isMyClassesActive.value },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays, show: permissions.value.schedule, active: route.path === '/schedule' },
  { to: '/students', label: 'Student Management', icon: GraduationCap, show: isAdmin.value, active: route.path === '/students' },
].filter(i => i.show))

const toolItems = computed(() => [
  { to: '/tools/latex-to-text', label: 'LaTeX to Text', icon: FileText, show: permissions.value.latex_to_text },
  { to: '/tools/trim-video', label: 'Trim Video', icon: Scissors, show: permissions.value.trim_video },
  { to: '/tools/compress-video', label: 'Compress Video', icon: Minimize2, show: permissions.value.compress_video },
].filter(i => i.show).map(i => ({ ...i, active: route.path === i.to })))

const rolesSubItems = [
  { to: '/roles', label: 'Roles' },
  { to: '/roles/permissions', label: 'Permissions' },
]
</script>
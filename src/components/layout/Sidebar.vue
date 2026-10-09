<template>
  <aside class="relative w-64 shrink-0 border-r border-[#005A31] dark:border-slate-800 bg-[#006A3A] dark:bg-[#004d2a] flex flex-col justify-between px-4 py-5 min-h-screen transition-colors">
    <!-- decorative circles -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div class="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-white/[0.06]"></div>
      <div class="absolute top-[38%] -right-24 w-72 h-72 rounded-full bg-black/[0.07]"></div>
      <div class="absolute top-[45%] -left-10 w-56 h-56 rounded-full bg-white/[0.05]"></div>
      <div class="absolute -bottom-24 -right-10 w-64 h-64 rounded-full bg-white/[0.06]"></div>
    </div>
    <div class="relative">
      <!-- BRAND LOGO & NAME -->
      <div class="flex items-center gap-3 mb-8 px-2">
        <img
          src="@/assets/logo/RS_logo.png"
          alt="Romduol Scholars Logo"
          class="w-11 h-11 object-contain shrink-0"
        />
        <div class="flex flex-col justify-center">
          <h2 class="!text-white font-extrabold text-lg tracking-widest uppercase leading-none">
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
          <span class="truncate flex-1">{{ t(item.label) }}</span>
          <span v-if="item.badge" class="inline-flex items-center gap-1 rounded-full bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5"><span class="w-1.5 h-1.5 rounded-full bg-white" />{{ item.badge }}</span>
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
                ? 'bg-white/10 text-white'
                : 'text-white/80 hover:bg-white/10 hover:text-white',
            ]"
          >
            <KeyRound
              :class="[
                'w-[18px] h-[18px] shrink-0',
                isRolesSectionActive ? 'text-white' : 'text-white/60 group-hover:text-white',
              ]"
            />
            <span class="flex-1 truncate">{{ t('Roles & Permissions') }}</span>
            <ChevronDown class="w-4 h-4 shrink-0 opacity-60 transition-transform" :class="{ 'rotate-180': rolesMenuOpen }" />
          </button>
          <div v-if="rolesMenuOpen" class="mt-1 mb-1 ml-[21px] pl-3 border-l border-white/20 space-y-0.5">
            <router-link
              v-for="sub in rolesSubItems"
              :key="sub.to"
              :to="sub.to"
              :class="subClass(route.path === sub.to)"
            >
              <span
                v-if="route.path === sub.to"
                class="absolute -left-[13px] top-1.5 bottom-1.5 w-0.5 rounded-full bg-[#ffce04]"
              />
              {{ t(sub.label) }}
            </router-link>
          </div>
        </div>

        <template v-if="toolItems.length">
          <p class="px-3 pt-5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/50">{{ t('Tools') }}</p>
          <router-link v-for="item in toolItems" :key="item.to" :to="item.to" :class="navClass(item.active)">
            <component :is="item.icon" :class="iconClass(item.active)" />
            <span class="truncate">{{ t(item.label) }}</span>
          </router-link>
        </template>

        <template v-if="isAdmin">
          <div class="my-4 border-t border-white/15" />
          <a href="#" :class="navClass(false)">
            <Folder :class="iconClass(false)" />
            <span class="truncate">{{ t('Resources') }}</span>
          </a>
          <a href="#" :class="navClass(false)">
            <Settings :class="iconClass(false)" />
            <span class="truncate">{{ t('Settings') }}</span>
          </a>
        </template>
      </nav>
    </div>

  </aside>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  LayoutDashboard, Users, GraduationCap, KeyRound, FileText, Clapperboard,
  CalendarDays, Folder, Settings, ChevronDown, Library, House, BookOpen, Activity,
} from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { useLanguage } from '../../composables/useLanguage'
import { authService } from '../../services/authService'
import { permissionsService } from '../../services/permissionsService'
import { liveClassService } from '../../services/liveClassService'

const route = useRoute()
const { t } = useLanguage()

const isStudent = computed(() => authService.getCurrentUser()?.role === 'student')
const isAdmin = computed(() => ['admin', 'super_admin'].includes(authService.getCurrentUser()?.role))

// Per-user overrides on top of role defaults (an admin can grant/revoke each
// of these individually — see permissionsService.js). Starts as {} so every
// gated item is hidden until the real map loads, rather than flashing items
// that then disappear.
const permissions = ref({})
// Students get a red LIVE badge on "Class" while one of their classes is on air.
const liveCount = ref(0)
let livePoll = null
const pollLive = async () => {
  try { liveCount.value = (await liveClassService.getMyLiveClasses('active')).length } catch { /* badge is optional */ }
}
onMounted(async () => {
  if (authService.getCurrentUser()?.role === 'student') {
    pollLive()
    livePoll = setInterval(pollLive, 30000)
  }
  permissions.value = await permissionsService.getPermissions()
})
onBeforeUnmount(() => clearInterval(livePoll))

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
    ? 'bg-white text-[#006A3A] shadow-sm'
    : 'text-white/80 hover:bg-white/10 hover:text-white',
]
const iconClass = (active) => [
  'w-[18px] h-[18px] shrink-0',
  active ? 'text-[#006A3A]' : 'text-white/60 group-hover:text-white',
]
const subClass = (active) => [
  'relative block pl-4 pr-3 py-2 rounded-lg text-[13px] font-semibold transition-colors',
  active
    ? 'bg-white/15 text-white'
    : 'text-white/70 hover:bg-white/10 hover:text-white',
]

const studentItems = computed(() => [
  { to: '/home', label: 'Home', icon: House, active: route.path === '/home' },
  { to: '/class', label: 'Class', icon: BookOpen, badge: liveCount.value > 0 ? 'LIVE' : '', active: route.path.startsWith('/class') || route.path.startsWith('/lessons/') || route.path.startsWith('/courses/') },
  { to: '/library', label: 'Library', icon: Library, active: route.path.startsWith('/library') },
])

const teacherItems = computed(() => [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: permissions.value.dashboard, active: route.path === '/dashboard' },
  { to: '/', label: 'My Classes', icon: Users, show: true, active: isMyClassesActive.value },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays, show: permissions.value.schedule, active: route.path === '/schedule' },
  { to: '/students', label: 'Student Management', icon: GraduationCap, show: isAdmin.value, active: route.path === '/students' },
  { to: '/agora-usage', label: 'Agora Usage', icon: Activity, show: isAdmin.value, active: route.path === '/agora-usage' },
  { to: '/library', label: 'Library', icon: Library, show: true, active: route.path === '/library' },
].filter(i => i.show))
// Students get their own short menu, like the mobile tabs.
const topItems = computed(() => (isStudent.value ? studentItems.value : teacherItems.value))

const toolItems = computed(() => [
  { to: '/tools/latex-to-text', label: 'LaTeX to Text', icon: FileText, show: permissions.value.latex_to_text },
  { to: '/tools/video-editor', label: 'Video Editor', icon: Clapperboard, show: permissions.value.trim_video || permissions.value.compress_video },
].filter(i => i.show).map(i => ({ ...i, active: route.path === i.to })))

const rolesSubItems = [
  { to: '/roles', label: 'Roles' },
  { to: '/roles/permissions', label: 'Permissions' },
]
</script>
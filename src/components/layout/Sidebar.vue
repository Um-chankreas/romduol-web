<template>
  <aside class="w-64 shrink-0 border-r border-slate-200/80 dark:border-slate-800 bg-[#f8fafd] dark:bg-slate-900 flex flex-col justify-between p-5 min-h-screen transition-colors">
    <div>
      <!-- BRAND LOGO & NAME -->
      <div class="flex items-center gap-3 mb-8 px-2">
        <!-- Logo Image -->
        <img 
          src="@/assets/logo/RS_logo.png" 
          alt="Romduol Scholars Logo" 
          class="w-11 h-11 object-contain shrink-0"
        />

        <!-- Stacked Text Branding in #ccb711 -->
        <div class="flex flex-col justify-center">
          <h2 class="!text-[#016a36] font-extrabold text-lg tracking-widest uppercase leading-none">
            ROMDUOL
          </h2>
          <span class="!text-[#ffce04] font-extrabold text-[11px] tracking-[0.22em] uppercase leading-tight mt-1">
            SCHOLARS
          </span>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="space-y-1.5">
        <router-link
          to="/dashboard"
          :class="[
            'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition',
            route.path === '/dashboard'
              ? 'bg-[#034d31] text-white shadow-sm'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
          ]"
        >
          <span>📊</span> Dashboard
        </router-link>
        <router-link
          to="/"
          :class="[
            'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition',
            route.path === '/'
              ? 'bg-[#034d31] text-white shadow-sm'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
          ]"
        >
          <span>👥</span> My Classes
        </router-link>
        <router-link
          v-if="isAdmin"
          to="/students"
          :class="[
            'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition',
            route.path === '/students'
              ? 'bg-[#034d31] text-white shadow-sm'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
          ]"
        >
          <span>🎓</span> Student Management
        </router-link>
        <a href="#" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition">
          <span>📅</span> Schedule
        </a>
        <a href="#" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition">
          <span>📁</span> Resources
        </a>
        <a href="#" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition mt-6">
          <span>⚙️</span> Settings
        </a>
      </nav>
    </div>

    <!-- Pro Banner Card -->
    <div class="bg-[#f8fafd] dark:bg-slate-800 rounded-2xl p-4 text-center border border-slate-200/80 dark:border-slate-700 shadow-xs">
      <p class="text-xs font-bold text-slate-900 dark:text-emerald-300 mb-2">Upgrade to Pro</p>
      <button class="w-full bg-[#034d31] hover:bg-[#023824] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-sm cursor-pointer">
        Go Premium
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { authService } from '../../services/authService'

const route = useRoute()

const isAdmin = computed(() => authService.getCurrentUser()?.role === 'admin')
</script>
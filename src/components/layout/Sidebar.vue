<template>
  <aside class="w-64 shrink-0 border-r border-emerald-900/10 dark:border-slate-800 bg-[#F1FCF0] dark:bg-slate-900 flex flex-col justify-between p-5 min-h-screen">
    <div>
      <!-- Brand Logo & Name -->
      <div class="flex items-center gap-3 mb-8 px-2">
        <div class="w-10 h-10 rounded-xl bg-[#034d31] text-amber-300 font-bold flex items-center justify-center text-xl shadow-sm shrink-0">
          🎓
        </div>
        <div>
          <h2 class="font-extrabold text-slate-900 dark:text-white text-base leading-tight">Romduol</h2>
          <span class="text-xs text-emerald-700 dark:text-emerald-400 font-bold">Scholars</span>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="space-y-1.5">
        <a href="#" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-200/50 dark:hover:bg-slate-800 transition">
          <span>📊</span> Dashboard
        </a>
        <a href="#" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-[#034d31] text-white shadow-sm">
          <span>👥</span> My Classes
        </a>
        <a href="#" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-200/50 dark:hover:bg-slate-800 transition">
          <span>📅</span> Schedule
        </a>
        <a href="#" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-200/50 dark:hover:bg-slate-800 transition">
          <span>📁</span> Resources
        </a>
        <a href="#" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-200/50 dark:hover:bg-slate-800 transition mt-6">
          <span>⚙️</span> Settings
        </a>
      </nav>
    </div>

    <!-- Pro Banner -->
    <div class="bg-emerald-200/60 dark:bg-slate-800 rounded-2xl p-4 text-center border border-emerald-300/40 dark:border-slate-700">
      <p class="text-xs font-bold text-slate-800 dark:text-emerald-300 mb-2">Upgrade to Pro</p>
      <button class="w-full bg-[#034d31] hover:bg-[#023824] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-sm">
        Go Premium
      </button>
    </div>
  </aside>
</template>
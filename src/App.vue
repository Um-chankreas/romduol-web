<template>
  <div class="min-h-screen bg-[#F1FCF0] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
    <router-view v-slot="{ Component, route }">
      <keep-alive :include="keepAliveViews" :max="10">
        <component :is="Component" :key="route.fullPath" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script setup>
// Views listed here (by their `name` option) stay mounted when you navigate
// away, so coming back to them shows the cached page instantly instead of
// re-fetching and flashing a loading state. CourseDetailView gets a separate
// cache entry per course id (keyed by route.fullPath), so `max` caps total
// cached instances and evicts the least-recently-used one once exceeded.
const keepAliveViews = ['ClassesView', 'DashboardView', 'CourseDetailView'];
</script>
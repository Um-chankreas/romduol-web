<script setup>
// items: [{ label, to? }] — every item except the last is a link (needs `to`);
// the last always renders as the current, non-clickable page.
defineProps({
  items: { type: Array, default: () => [] },
})
</script>

<template>
  <nav class="flex items-center gap-1.5 min-w-0 overflow-hidden" aria-label="Breadcrumb">
    <template v-for="(item, i) in items" :key="i">
      <router-link
        v-if="item.to && i < items.length - 1"
        :to="item.to"
        class="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-[#006A3A] dark:hover:text-emerald-400 truncate transition"
      >
        {{ item.label }}
      </router-link>
      <span
        v-else
        class="text-sm font-bold text-slate-900 dark:text-white truncate"
        :aria-current="i === items.length - 1 ? 'page' : undefined"
      >
        {{ item.label }}
      </span>
      <svg
        v-if="i < items.length - 1"
        class="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </template>
  </nav>
</template>

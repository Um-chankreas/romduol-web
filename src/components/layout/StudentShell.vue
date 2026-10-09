<script setup>
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'
import Breadcrumb from './Breadcrumb.vue'
import Footer from './Footer.vue'

// The frame every student page sits in: fixed sidebar + header, with only the
// content (and footer) scrolling — same shell the rest of the portal uses.
defineProps({
  breadcrumb: { type: Array, default: () => [] },
})
</script>

<template>
  <div class="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
    <Sidebar class="hidden md:flex" />

    <div class="flex-1 flex flex-col min-w-0 min-h-0">
      <Header>
        <template #left>
          <Breadcrumb :items="breadcrumb" />
        </template>
      </Header>

      <div class="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <main class="p-4 sm:p-8 flex-1 w-full max-w-6xl mx-auto">
          <slot />
        </main>
        <Footer />
      </div>
    </div>
  </div>
</template>

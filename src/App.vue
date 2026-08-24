<script setup>
import { useAuthStore } from '@/stores/auth'
import LoginView from './views/auth/LoginView.vue'

const authStore = useAuthStore()
</script>

<template>
  <div class="min-h-screen bg-[#F1FCF0] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
    <LoginView 
      v-if="!authStore.isAuthenticated" 
    />
    <router-view 
      v-else 
      @logout="authStore.logout" 
    />
  </div>
</template>
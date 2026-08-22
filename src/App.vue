<script setup>
import { ref } from 'vue'
import LoginView from './views/auth/LoginView.vue'

const isAuthenticated = ref(true)
</script>

<template>
  <div class="min-h-screen bg-[#F1FCF0] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
    <LoginView 
      v-if="!isAuthenticated" 
      @login-success="isAuthenticated = true" 
    />
    <router-view v-else @logout="isAuthenticated = false" />
  </div>
</template>
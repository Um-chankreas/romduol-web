<script setup>
import { ref } from 'vue';
import LoginView from './views/auth/LoginView.vue';
import DashboardView from './views/dashboard/DashboardView.vue';
import LiveStreamView from './views/live/LiveStreamView.vue';

const isAuthenticated = ref(true); // default true for preview
const isStreaming = ref(false);
const activeStreamTitle = ref('');

const startLiveStream = (title) => {
  activeStreamTitle.value = title;
  isStreaming.value = true;
};
</script>

<template>
  <LoginView 
    v-if="!isAuthenticated" 
    @login-success="isAuthenticated = true" 
  />

  <LiveStreamView 
    v-else-if="isStreaming" 
    :initialChannel="activeStreamTitle"
    @back-to-dashboard="isStreaming = false" 
  />

  <DashboardView 
    v-else 
    @start-live="startLiveStream"
    @logout="isAuthenticated = false" 
  />
</template>
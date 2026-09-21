<template>
  <div class="min-h-dvh w-full bg-slate-900 font-sans">
    <SaveRecordingModal :live-class-id="route.params.id" />
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';
import SaveRecordingModal from '../../components/modals/SaveRecordingModal.vue';

// Standalone fallback for /live/:id/save-recording. The normal flow shows the
// same dialog over the live room right after the teacher ends the class.
const route = useRoute();
</script>

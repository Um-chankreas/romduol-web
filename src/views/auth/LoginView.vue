<script setup>
import { ref } from 'vue';
import { useTheme } from '../../composables/useTheme';
import BaseInput from '../../components/ui/BaseInput.vue';
import BaseButton from '../../components/ui/BaseButton.vue';

const emit = defineEmits(['login-success']);
const { isDark, toggleTheme } = useTheme();

const teacherId = ref('');
const username = ref('');

const handleSubmit = () => {
  // Emit event to parent (App.vue) upon clicking "Access Dashboard"
  emit('login-success');
};
</script>

<template>
  <div class="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-[#F1FCF0] dark:bg-slate-950 transition-colors duration-200">
    <!-- Theme Switcher -->
    <button 
      @click="toggleTheme" 
      type="button"
      class="mb-5 px-4 py-1.5 rounded-full border border-emerald-900/10 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:opacity-80 transition cursor-pointer"
    >
      {{ isDark ? '☀️ Light Mode' : '🌙 Dark Mode' }}
    </button>

    <!-- Educator Portal Card -->
    <div class="w-full max-w-[560px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] px-10 py-6 shadow-xl text-center flex flex-col items-center">
      
      <!-- Brand Logo -->
      <div class="w-12 h-12 mb-2 rounded-xl bg-emerald-800/10 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-800 dark:text-emerald-400 font-bold text-xl">
        🎓
      </div>

      <h1 
        class="text-2xl font-bold tracking-tight" 
        :style="{ color: isDark ? '#ffffff' : '#0f172a' }"
      >
        Educator Portal
      </h1>

      <p class="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
        Secure access to your classroom management dashboard.
      </p>

      <!-- Form -->
      <form class="w-full flex flex-col gap-3.5 text-left" @submit.prevent="handleSubmit">
        <BaseInput 
          v-model="teacherId" 
          label="Teacher ID" 
          placeholder="e.g. EDU-9942" 
        />
        
        <BaseInput 
          v-model="username" 
          label="Username" 
          placeholder="Network Username"
        >
          <template #action>
            <a href="#" class="text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:underline">
              Forgot ID?
            </a>
          </template>
        </BaseInput>

        <BaseButton type="submit" class="mt-1">
          Access Dashboard &rarr;
        </BaseButton>
      </form>

      <!-- SSO Footer -->
      <div class="w-full mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
        <span>🛡️</span> SSO Secured Connection
      </div>
    </div>
  </div>
</template>
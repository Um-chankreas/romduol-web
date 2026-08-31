<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '../../services/authService'; // Path to your authService
import { useTheme } from '../../composables/useTheme';
import BaseInput from '../../components/ui/BaseInput.vue';
import BaseButton from '../../components/ui/BaseButton.vue';

const router = useRouter();
const { isDark, toggleTheme } = useTheme();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const handleSubmit = async () => {
  error.value = '';
  loading.value = true;

  try {
    await authService.login(email.value, password.value);
    // Admins land on the student portal; everyone else on their classes.
    const role = authService.getCurrentUser()?.role;
    router.push(role === 'admin' ? '/students' : '/');
  } catch (err) {
    error.value = err.response?.data?.message || 'Invalid email or password.';
  } finally {
    loading.value = false;
  }
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

      <!-- API Error Alert -->
      <div 
        v-if="error" 
        class="w-full mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium text-left"
      >
        {{ error }}
      </div>

      <!-- Form -->
      <form class="w-full flex flex-col gap-3.5 text-left" @submit.prevent="handleSubmit">
        <BaseInput 
          v-model="email" 
          type="email"
          label="Email Address" 
          placeholder="teacher@school.com" 
          required
        />
        
        <BaseInput 
          v-model="password" 
          type="password"
          label="Password" 
          placeholder="••••••••"
          required
        >
          <template #action>
            <a href="#" class="text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:underline">
              Forgot password?
            </a>
          </template>
        </BaseInput>

        <BaseButton 
          type="submit" 
          :disabled="loading"
          class="mt-1 cursor-pointer disabled:opacity-50"
        >
          <span v-if="loading">Authenticating...</span>
          <span v-else>Access Dashboard &rarr;</span>
        </BaseButton>
      </form>

      <!-- SSO Footer -->
      <div class="w-full mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
        <span>🛡️</span> SSO Secured Connection
      </div>
    </div>
  </div>
</template>
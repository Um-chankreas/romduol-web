<script setup>
import Footer from '../../components/layout/Footer.vue'
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '../../services/authService'; // Path to your authService
import { useTheme } from '../../composables/useTheme';
import { useLanguage } from '../../composables/useLanguage';
import rsLogo from '../../assets/logo/RS_logo.png';
import rsTextLogo from '../../assets/logo/rs_text_logo.png';
import BaseInput from '../../components/ui/BaseInput.vue';
import BaseButton from '../../components/ui/BaseButton.vue';

const router = useRouter();
const { isDark, toggleTheme } = useTheme();
const { lang, setLang, t } = useLanguage();

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
    // The API explains 4xx failures in `error` (wrong password, too many
    // attempts, suspended account). 5xx / network errors get a generic line
    // rather than raw server internals.
    const status = err.response?.status;
    error.value = status >= 400 && status < 500 && err.response.data?.error
      ? err.response.data.error
      : status ? t('Something went wrong. Please try again.') : t('Cannot reach the server. Check your connection.');
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen w-full flex flex-col bg-[#F1FCF0] dark:bg-slate-950 transition-colors duration-200">
    <!-- Header -->
    <header class="w-full px-6 sm:px-8 py-4 flex items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
      <img :src="rsTextLogo" alt="Romduol Scholars" class="h-10 w-auto object-contain" />
      <div class="flex items-center gap-3.5">
        <div class="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-0.5" role="group" aria-label="Language">
          <button v-for="l in [{ c: 'en', l: 'EN' }, { c: 'km', l: 'ខ្មែរ' }]" :key="l.c" type="button" @click="setLang(l.c)"
            :aria-pressed="lang === l.c"
            :class="['px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer',
              lang === l.c ? 'bg-[#006A3A] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white']">{{ l.l }}</button>
        </div>
        <button @click="toggleTheme" type="button" title="Toggle Theme"
          class="p-2 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition shadow-xs cursor-pointer">
          <span class="text-base leading-none block">{{ isDark ? '☀️' : '🌙' }}</span>
        </button>
      </div>
    </header>

    <div class="relative flex-1 w-full flex flex-col items-center justify-center p-6 overflow-hidden bg-gradient-to-b from-[#F1FCF0] via-white to-emerald-50 dark:from-slate-950 dark:via-slate-950 dark:to-[#06140f]">
    <!-- soft decorative glows -->
    <div class="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full bg-emerald-400/20 dark:bg-emerald-500/10 blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-amber-300/25 dark:bg-amber-400/10 blur-3xl"></div>
    <!-- Educator Portal Card -->
    <div class="w-full max-w-[560px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] px-10 py-8 shadow-2xl shadow-emerald-900/10 dark:shadow-black/40 backdrop-blur text-center flex flex-col items-center">
      
      <!-- Brand Logo -->
      <img :src="rsLogo" alt="Romduol Scholars" class="w-16 h-16 mb-2 object-contain drop-shadow-sm" />

      <h1 
        class="text-2xl font-bold tracking-tight" 
        :style="{ color: isDark ? '#ffffff' : '#0f172a' }"
      >
        {{ t('Educator Portal') }}
      </h1>

      <p class="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
        {{ t('Secure access to your classroom management dashboard.') }}
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
          :label="t('Email Address')" 
          placeholder="teacher@school.com" 
          required
        />
        
        <BaseInput 
          v-model="password" 
          type="password"
          :label="t('Password')" 
          placeholder="••••••••"
          required
        >
          <template #action>
            <a href="#" class="text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:underline">
              {{ t('Forgot password?') }}
            </a>
          </template>
        </BaseInput>

        <BaseButton 
          type="submit" 
          :disabled="loading"
          class="mt-1 cursor-pointer disabled:opacity-50"
        >
          <span v-if="loading">{{ t('Authenticating...') }}</span>
          <span v-else>{{ t('Access Dashboard') }} &rarr;</span>
        </BaseButton>
      </form>

      <!-- SSO Footer -->
      <div class="w-full mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
        <span>🛡️</span> {{ t('SSO Secured Connection') }}
      </div>
    </div>
    </div>
    <Footer />
  </div>
</template>

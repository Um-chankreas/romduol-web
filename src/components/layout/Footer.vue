<template>
  <footer class="mt-auto">
    <div class="bg-[#f5f8f6] dark:bg-slate-900 border-t border-slate-200/70 dark:border-slate-800">
      <div class="px-6 sm:px-8 py-10 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <!-- Brand + about -->
        <div>
          <img :src="rsTextLogo" alt="Romduol Scholars" class="h-10 w-auto object-contain" />
          <p class="mt-5 max-w-sm text-[13px] leading-6 text-slate-600 dark:text-slate-400">{{ t(aboutText) }}</p>
        </div>

        <!-- Programs -->
        <div>
          <p class="text-sm font-semibold text-[#0f3d26] dark:text-white">{{ t('Programs') }}</p>
          <ul class="mt-4 space-y-3 text-[13px] text-slate-600 dark:text-slate-400">
            <li v-for="p in programs" :key="p">{{ t(p) }}</li>
          </ul>
        </div>

        <!-- Contact -->
        <div>
          <p class="text-sm font-semibold text-[#0f3d26] dark:text-white">{{ t('Get in touch') }}</p>
          <ul class="mt-4 space-y-3 text-[13px] text-slate-700 dark:text-slate-300">
            <li>
              <a :href="`mailto:${company.email}`" class="flex items-center gap-3 hover:text-[#006A3A] dark:hover:text-emerald-400 transition">
                <span class="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </span>
                {{ company.email }}
              </a>
            </li>
            <li>
              <a :href="company.phoneHref" class="flex items-center gap-3 hover:text-[#006A3A] dark:hover:text-emerald-400 transition">
                <span class="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </span>
                {{ company.phone }}
              </a>
            </li>
          </ul>
          <div class="mt-4 flex flex-wrap gap-2.5">
            <a :href="company.telegram" target="_blank" rel="noopener"
               class="inline-flex items-center gap-2 rounded-full bg-[#0f3d26] px-4 py-2 text-xs font-semibold text-white hover:bg-[#006A3A] transition">
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              Telegram
            </a>
            <a :href="company.facebook" target="_blank" rel="noopener"
               class="inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-[#006A3A] hover:text-[#006A3A] dark:hover:text-emerald-400 transition">
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>
              Facebook
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom bar -->
    <div class="bg-[#0f3d26] dark:bg-[#07281a]">
      <div class="px-6 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/75">
        <p>© {{ new Date().getFullYear() }} Romduol Scholars. {{ t('All rights reserved.') }}</p>
        <div class="flex items-center gap-6">
          <router-link to="/support" class="hover:text-white transition">{{ t('Support') }}</router-link>
          <router-link to="/privacy-policy" class="hover:text-white transition">{{ t('Privacy Policy') }}</router-link>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { useLanguage } from '../../composables/useLanguage'
const { t } = useLanguage()
import rsTextLogo from '../../assets/logo/rs_text_logo.png';

const company = {
  email: 'info@romduolscholars.com',
  phone: '+855 (0)12 242 687',
  phoneHref: 'tel:+85512242687',
  telegram: 'https://t.me/RomduolScholars',
  facebook: 'https://web.facebook.com/romduolscholars',
};

const programs = ['Olympiad Mathematics', 'Olympiad Physics', 'IELTS', 'HSK']

const aboutText =
  'Founded by a former Olympian and scholar, Romduol Scholars bridges gaps in Cambodian ' +
  'education through extracurricular learning, emerging fields, and international curriculums.';
</script>

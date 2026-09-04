<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useTheme } from '../../composables/useTheme';
import rsTextLogo from '../../assets/logo/rs_text_logo.png';

const { isDark, toggleTheme } = useTheme();

// ─── Company details ─────────────────────────────────────────────────────────
const company = {
  legalName: 'Romduol Scholars',
  country: 'Cambodia',
  email: 'info@romduolscholars.com',
  website: 'https://www.romduolscholars.com',
  phone: '+855 (0)12 242 687',
  phoneHref: 'tel:+85512242687',
  telegram: 'https://t.me/RomduolScholars',
  facebook: 'https://web.facebook.com/romduolscholars',
  lastUpdated: '4 September 2026',
  // Typical time we aim to reply to a support request.
  responseTime: '1–2 business days',
};

const aboutText =
  'Founded by a former Olympian & Scholar, Romduol Scholars aims to bridge many gaps ' +
  'in Cambodian education — particularly to develop the education industry through ' +
  'extracurricular learning, introducing students to emerging fields, and raising the ' +
  'educational standard by bringing in international curriculums such as Olympiad ' +
  'mathematics & physics, IELTS, and HSK.';
// ─────────────────────────────────────────────────────────────────────────────

const sections = [
  { id: 'contact', label: '1. Contact support' },
  { id: 'hours', label: '2. Hours & response time' },
  { id: 'faq', label: '3. Common questions' },
  { id: 'account', label: '4. Account & data deletion' },
  { id: 'report', label: '5. Report a problem or abuse' },
];

const faqs = [
  {
    q: 'How do I reset my password?',
    a: 'On the sign-in screen, tap “Forgot password” and enter your account email. ' +
       'We will send you a link to set a new password. If the email does not arrive, ' +
       'check your spam folder or contact us and we will reset it for you.',
  },
  {
    q: 'My camera or microphone does not work in a live class.',
    a: 'Open your device Settings, find Romduol Scholars, and make sure Camera and ' +
       'Microphone permissions are allowed. Then fully close and reopen the app and ' +
       'rejoin the class.',
  },
  {
    q: 'I cannot join a live class or the video keeps freezing.',
    a: 'Live classes need a stable internet connection. Try switching between Wi-Fi and ' +
       'mobile data, move closer to your router, or rejoin the class. If the problem ' +
       'continues, tell us the class name and the time it happened.',
  },
  {
    q: 'A lesson, quiz, or course is missing.',
    a: 'Make sure you are signed in with the correct account and that you have been ' +
       'added to the right class by your teacher. If it is still missing, contact us ' +
       'with your account email and the name of the class.',
  },
  {
    q: 'How do I update the app?',
    a: 'Open the App Store (iOS) or Google Play (Android), search for Romduol Scholars, ' +
       'and tap Update if it is available. Using the latest version fixes most issues.',
  },
];

// ─── Scroll-spy: highlight the active section in the table of contents ────────
const activeId = ref(sections[0].id);

const onScroll = () => {
  const line = 120; // px from the top of the viewport (just below the header)
  let current = sections[0].id;
  for (const s of sections) {
    const el = document.getElementById(s.id);
    if (el && el.getBoundingClientRect().top <= line) current = s.id;
  }
  activeId.value = current;
};

onMounted(() => {
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
});

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));

const scrollTo = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
</script>

<template>
  <div class="support-page min-h-screen text-left bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 transition-colors duration-200">

    <!-- ── Sticky header ─────────────────────────────────────────────────── -->
    <header
      class="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md"
    >
      <div class="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <router-link to="/" class="flex items-center group">
          <img :src="rsTextLogo" alt="Romduol Scholars" class="h-10 sm:h-12 w-auto object-contain" />
        </router-link>

        <button
          @click="toggleTheme"
          type="button"
          title="Toggle theme"
          class="h-9 w-9 grid place-items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <span class="text-base leading-none">{{ isDark ? '☀️' : '🌙' }}</span>
        </button>
      </div>
    </header>

    <!-- ── Hero ──────────────────────────────────────────────────────────── -->
    <section class="border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-b from-emerald-50/70 to-white dark:from-emerald-950/20 dark:to-slate-950">
      <div class="mx-auto max-w-6xl px-5 sm:px-8 py-14 sm:py-20">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
          Help
        </p>
        <h1 class="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Support
        </h1>
        <p class="mt-4 max-w-2xl text-[15px] sm:text-base leading-relaxed text-slate-600 dark:text-slate-400">
          Need help with the Romduol Scholars mobile app or website? This page explains how to
          reach us and answers the questions we hear most often.
        </p>
        <div class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
          <span>Last updated: <strong class="text-slate-700 dark:text-slate-300">{{ company.lastUpdated }}</strong></span>
          <span class="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
          <span>Operated by <strong class="text-slate-700 dark:text-slate-300">{{ company.legalName }}</strong>, {{ company.country }}</span>
        </div>

        <div class="mt-8 flex flex-wrap gap-3">
          <a
            :href="`mailto:${company.email}`"
            class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            Email support
          </a>
          <a
            :href="company.telegram"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M21.94 4.6 18.7 19.9c-.24 1.08-.88 1.35-1.79.84l-4.94-3.64-2.38 2.29c-.26.26-.48.48-.99.48l.35-5.02 9.13-8.25c.4-.35-.09-.55-.61-.2L6.58 13.2l-4.87-1.52c-1.06-.33-1.08-1.06.22-1.57l19.05-7.34c.88-.33 1.65.2 1.36 1.83z"/></svg>
            Message on Telegram
          </a>
        </div>
      </div>
    </section>

    <!-- ── Body: sticky TOC + content ────────────────────────────────────── -->
    <div class="mx-auto max-w-6xl px-5 sm:px-8 py-12 lg:py-16 lg:grid lg:grid-cols-[240px_1fr] lg:gap-14">

      <!-- Table of contents -->
      <aside class="hidden lg:block">
        <nav class="sticky top-24">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
            On this page
          </p>
          <ul class="space-y-1 border-l border-slate-200 dark:border-slate-800">
            <li v-for="s in sections" :key="s.id">
              <button
                type="button"
                @click="scrollTo(s.id)"
                :class="[
                  'block w-full text-left -ml-px border-l-2 pl-4 py-1.5 text-[13px] leading-snug transition cursor-pointer',
                  activeId === s.id
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600',
                ]"
              >
                {{ s.label }}
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <!-- Content -->
      <article class="min-w-0 max-w-2xl">
        <p class="text-[15px] leading-7 text-slate-600 dark:text-slate-400">
          We want <strong class="text-slate-800 dark:text-slate-200">Romduol Scholars</strong> to work well
          for every student and teacher. If something is broken, confusing, or missing, contact us using
          any of the options below and we will help.
        </p>

        <!-- 1 -->
        <section :id="sections[0].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">1. Contact Support</h2>
          <p class="mt-4 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            The fastest way to reach us is by email. Please include your account email, your device
            and app version, and a short description of the problem (screenshots help).
          </p>
          <div class="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-2 text-[15px]">
            <p><span class="text-slate-500 dark:text-slate-400">Email:</span> <a :href="`mailto:${company.email}`" class="font-medium text-emerald-700 dark:text-emerald-400 hover:underline">{{ company.email }}</a></p>
            <p><span class="text-slate-500 dark:text-slate-400">Phone:</span> <a :href="company.phoneHref" class="font-medium text-emerald-700 dark:text-emerald-400 hover:underline">{{ company.phone }}</a></p>
            <p><span class="text-slate-500 dark:text-slate-400">Telegram:</span> <a :href="company.telegram" target="_blank" rel="noopener" class="font-medium text-emerald-700 dark:text-emerald-400 hover:underline">@RomduolScholars</a></p>
            <p><span class="text-slate-500 dark:text-slate-400">Facebook:</span> <a :href="company.facebook" target="_blank" rel="noopener" class="font-medium text-emerald-700 dark:text-emerald-400 hover:underline">facebook.com/romduolscholars</a></p>
            <p><span class="text-slate-500 dark:text-slate-400">Website:</span> <a :href="company.website" class="font-medium text-emerald-700 dark:text-emerald-400 hover:underline">{{ company.website }}</a></p>
            <p><span class="text-slate-500 dark:text-slate-400">Operator:</span> <span class="font-medium text-slate-800 dark:text-slate-200">{{ company.legalName }}</span>, {{ company.country }}</p>
          </div>
        </section>

        <!-- 2 -->
        <section :id="sections[1].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">2. Hours &amp; Response Time</h2>
          <p class="mt-4 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            Support is available Monday to Friday, 8:00 AM – 5:00 PM (Cambodia time, ICT / GMT+7).
            We usually reply within <strong class="text-slate-800 dark:text-slate-200">{{ company.responseTime }}</strong>.
            Messages sent on weekends or public holidays are answered on the next business day.
          </p>
        </section>

        <!-- 3 -->
        <section :id="sections[2].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">3. Common Questions</h2>
          <div class="mt-4 space-y-3">
            <details
              v-for="item in faqs"
              :key="item.q"
              class="group rounded-xl border border-slate-200 dark:border-slate-800 p-4"
            >
              <summary class="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900 dark:text-white">
                {{ item.q }}
                <span class="shrink-0 text-slate-400 transition group-open:rotate-45">＋</span>
              </summary>
              <p class="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{{ item.a }}</p>
            </details>
          </div>
        </section>

        <!-- 4 -->
        <section :id="sections[3].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">4. Account &amp; Data Deletion</h2>
          <p class="mt-4 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            You can request deletion of your account and associated personal data at any time by
            emailing <a :href="`mailto:${company.email}`" class="text-emerald-700 dark:text-emerald-400 hover:underline">{{ company.email }}</a>
            from the address on your account, with the subject line “Delete my account”. Once we
            verify the request, we delete or anonymise your personal data within 30–90 days, except
            where we must keep certain records to comply with the law. For full details, see our
            <router-link to="/privacy-policy" class="text-emerald-700 dark:text-emerald-400 hover:underline">Privacy Policy</router-link>.
          </p>
        </section>

        <!-- 5 -->
        <section :id="sections[4].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">5. Report a Problem or Abuse</h2>
          <p class="mt-4 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            To report a bug, inappropriate content, or the behaviour of another user in a class,
            email <a :href="`mailto:${company.email}`" class="text-emerald-700 dark:text-emerald-400 hover:underline">{{ company.email }}</a>
            with as much detail as you can — the class name, the time it happened, the people
            involved, and any screenshots. We take safety reports seriously and will respond
            promptly.
          </p>
        </section>
      </article>
    </div>

    <!-- ── Footer ────────────────────────────────────────────────────────── -->
    <footer class="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
      <div class="mx-auto max-w-6xl px-5 sm:px-8 py-12">
        <div class="grid gap-10 md:grid-cols-[1.6fr_1fr]">

          <!-- Brand + about -->
          <div>
            <img :src="rsTextLogo" alt="Romduol Scholars" class="h-11 w-auto object-contain" />
            <p class="mt-4 max-w-xl text-[13.5px] leading-6 text-slate-500 dark:text-slate-400">
              {{ aboutText }}
            </p>
          </div>

          <!-- Contact -->
          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Get in touch
            </p>
            <ul class="mt-4 space-y-2.5 text-sm">
              <li>
                <a :href="`mailto:${company.email}`" class="inline-flex items-center gap-2.5 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                  <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  {{ company.email }}
                </a>
              </li>
              <li>
                <a :href="company.phoneHref" class="inline-flex items-center gap-2.5 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                  <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  {{ company.phone }}
                </a>
              </li>
              <li>
                <a :href="company.telegram" target="_blank" rel="noopener" class="inline-flex items-center gap-2.5 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                  <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M21.94 4.6 18.7 19.9c-.24 1.08-.88 1.35-1.79.84l-4.94-3.64-2.38 2.29c-.26.26-.48.48-.99.48l.35-5.02 9.13-8.25c.4-.35-.09-.55-.61-.2L6.58 13.2l-4.87-1.52c-1.06-.33-1.08-1.06.22-1.57l19.05-7.34c.88-.33 1.65.2 1.36 1.83z"/></svg>
                  t.me/RomduolScholars
                </a>
              </li>
              <li>
                <a :href="company.facebook" target="_blank" rel="noopener" class="inline-flex items-center gap-2.5 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition">
                  <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>
                  Facebook
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Copyright © 2026 Romduol Scholars. All rights Reserved.
          </p>
          <div class="flex items-center gap-4">
            <router-link to="/support" class="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition">
              Support
            </router-link>
            <router-link to="/privacy-policy" class="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition">
              Privacy Policy
            </router-link>
          </div>
        </div>
      </div>
    </footer>

  </div>
</template>

<!--
  Same starter-CSS workaround as the Privacy Policy page: the leftover
  `src/style.css` ships unlayered element rules that (1) make #app a scroll
  container — breaking `position: sticky` — and (2) colour headings from the OS
  `prefers-color-scheme` instead of our `.dark` toggle. Neutralise both, scoped
  to this public page.
-->
<style>
html:has(.support-page),
body:has(.support-page),
#app:has(.support-page) {
  overflow: visible !important;
  display: block !important;
  text-align: left !important;
}

/* Headings: follow our own theme, not the OS setting. */
.support-page h1,
.support-page h2,
.support-page h3 {
  color: #0f172a; /* slate-900 */
}
:root.dark .support-page h1,
:root.dark .support-page h2,
:root.dark .support-page h3 {
  color: #fff;
}

/* Links inside prose: use the page's emerald, not the starter's purple accent. */
.support-page article a {
  color: #047857; /* emerald-700 */
}
:root.dark .support-page article a {
  color: #34d399; /* emerald-400 */
}
</style>

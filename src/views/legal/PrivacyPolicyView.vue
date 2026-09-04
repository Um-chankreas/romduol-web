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
  lastUpdated: '3 September 2026',
  // Days after account deletion within which personal data is removed.
  retentionDays: '30–90',
};

const aboutText =
  'Founded by a former Olympian & Scholar, Romduol Scholars aims to bridge many gaps ' +
  'in Cambodian education — particularly to develop the education industry through ' +
  'extracurricular learning, introducing students to emerging fields, and raising the ' +
  'educational standard by bringing in international curriculums such as Olympiad ' +
  'mathematics & physics, IELTS, and HSK.';
// ─────────────────────────────────────────────────────────────────────────────

const sections = [
  { id: 'collect', label: '1. Information we collect' },
  { id: 'use', label: '2. How we use it' },
  { id: 'share', label: '3. How it is shared' },
  { id: 'retention', label: '4. Data retention' },
  { id: 'rights', label: '5. Your rights & choices' },
  { id: 'security', label: '6. Security' },
  { id: 'children', label: "7. Children's privacy" },
  { id: 'transfers', label: '8. International transfers' },
  { id: 'changes', label: '9. Changes to this policy' },
  { id: 'contact', label: '10. Contact us' },
];

const sharing = [
  {
    who: 'Supabase',
    role: 'Database, authentication & file storage',
    why: 'Hosts our database and the files you upload. Data may be stored on servers located outside Cambodia.',
  },
  {
    who: 'Agora',
    role: 'Real-time video provider',
    why: 'Carries the live audio and video streams during classes.',
  },
  {
    who: 'Other users in your class',
    role: 'Teachers & students',
    why: 'Your name, profile photo, and any content or messages you share are visible to the teacher and students in that class.',
  },
  {
    who: 'Legal & safety',
    role: 'Authorities, where required',
    why: 'If required by law, or to protect the rights, safety, and security of users or the public.',
  },
];

const collectedData = [
  ['Name', 'To create and display your account and profile'],
  ['Email address', 'Account sign-in, security notifications, support'],
  ['Password', 'Account authentication (stored only in hashed form)'],
  ['Role (student or teacher), school / class information', 'To give you the correct features and content'],
  ['Profile photo and other optional profile details', 'Only if you choose to add them'],
  ['Content you upload or create — lessons, videos, documents (PDF, Word, PowerPoint, images, video), assignments, quiz answers, and messages sent during classes', 'To provide the core teaching and learning features'],
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
  <div class="privacy-page min-h-screen text-left bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 transition-colors duration-200">

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
          Legal
        </p>
        <h1 class="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Privacy Policy
        </h1>
        <p class="mt-4 max-w-2xl text-[15px] sm:text-base leading-relaxed text-slate-600 dark:text-slate-400">
          How Romduol Scholars collects, uses, and protects your information when you use our
          mobile app and website — an online learning platform for students and teachers.
        </p>
        <div class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
          <span>Last updated: <strong class="text-slate-700 dark:text-slate-300">{{ company.lastUpdated }}</strong></span>
          <span class="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
          <span>Operated by <strong class="text-slate-700 dark:text-slate-300">{{ company.legalName }}</strong>, {{ company.country }}</span>
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
          This Privacy Policy explains how <strong class="text-slate-800 dark:text-slate-200">Romduol Scholars</strong>
          ("we", "us", "our") collects, uses, and protects your information when you use the
          Romduol Scholars mobile application and website (together, the "Service"). By using the
          Service you agree to this Policy.
        </p>

        <!-- 1 -->
        <section :id="sections[0].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">1. Information We Collect</h2>

          <h3 class="mt-6 mb-3 text-[15px] font-semibold text-slate-800 dark:text-slate-200">a. Information you provide</h3>
          <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-900 text-left">
                  <th class="p-3 font-semibold text-slate-700 dark:text-slate-300">Data</th>
                  <th class="p-3 font-semibold text-slate-700 dark:text-slate-300">Why we collect it</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="[data, why] in collectedData" :key="data" class="align-top">
                  <td class="p-3 text-slate-700 dark:text-slate-300">{{ data }}</td>
                  <td class="p-3 text-slate-600 dark:text-slate-400">{{ why }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 class="mt-8 mb-3 text-[15px] font-semibold text-slate-800 dark:text-slate-200">b. Camera and microphone (live classes)</h3>
          <p class="text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            When you join a live class, the Service accesses your device camera and microphone
            so you can take part in the real-time video session. Audio and video are streamed
            live to other participants in that class through our video provider (Agora). We do
            <strong class="text-slate-800 dark:text-slate-200">not</strong> record live classes
            unless the class host explicitly starts a recording; if a recording is made,
            participants are informed and it is stored as class content.
          </p>

          <h3 class="mt-8 mb-3 text-[15px] font-semibold text-slate-800 dark:text-slate-200">c. Information collected automatically</h3>
          <ul class="space-y-2 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            <li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></span>Basic device and log data — device type, operating system version, app version, and IP address — used for security, troubleshooting, and preventing abuse.</li>
            <li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></span>Authentication tokens stored on your device to keep you signed in.</li>
          </ul>
        </section>

        <!-- 2 -->
        <section :id="sections[1].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">2. How We Use Your Information</h2>
          <ul class="mt-4 space-y-2 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            <li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></span>To provide, operate, and maintain the Service;</li>
            <li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></span>To authenticate you and keep your account secure;</li>
            <li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></span>To deliver courses, lessons, live classes, quizzes, and related features;</li>
            <li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></span>To let teachers and students interact within their classes;</li>
            <li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></span>To respond to your support requests;</li>
            <li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></span>To detect, prevent, and address technical issues, fraud, or abuse;</li>
            <li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></span>To comply with legal obligations.</li>
          </ul>
          <div class="mt-5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-[15px] text-emerald-900 dark:text-emerald-200">
            We do <strong>not</strong> sell your personal information, and we do
            <strong>not</strong> use it for advertising.
          </div>
        </section>

        <!-- 3 -->
        <section :id="sections[2].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">3. How Your Information Is Shared</h2>
          <p class="mt-4 text-[15px] leading-7 text-slate-600 dark:text-slate-400">We share information only as described here:</p>
          <div class="mt-4 space-y-3">
            <div
              v-for="row in sharing"
              :key="row.who"
              class="rounded-xl border border-slate-200 dark:border-slate-800 p-4"
            >
              <div class="flex flex-wrap items-baseline gap-x-2">
                <span class="font-semibold text-slate-900 dark:text-white">{{ row.who }}</span>
                <span class="text-xs font-medium text-slate-400 dark:text-slate-500">— {{ row.role }}</span>
              </div>
              <p class="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-400">{{ row.why }}</p>
            </div>
          </div>
          <p class="mt-4 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            These providers are bound by their own privacy and security obligations and may only
            process data on our instructions.
          </p>
        </section>

        <!-- 4 -->
        <section :id="sections[3].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">4. Data Retention</h2>
          <p class="mt-4 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            We keep your personal information for as long as your account is active. If you delete
            your account, we delete or anonymise your personal data within
            <strong class="text-slate-800 dark:text-slate-200">{{ company.retentionDays }} days</strong>,
            except where we must keep certain records to comply with the law, resolve disputes, or
            enforce our agreements. Content you shared in a class may remain visible to that class
            if it is part of shared course material.
          </p>
        </section>

        <!-- 5 -->
        <section :id="sections[4].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">5. Your Rights and Choices</h2>
          <ul class="mt-4 space-y-3 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            <li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></span><span><strong class="text-slate-800 dark:text-slate-200">Access and correction:</strong> you can view and update your profile information in the app.</span></li>
            <li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></span><span><strong class="text-slate-800 dark:text-slate-200">Account deletion:</strong> you can request deletion of your account and associated personal data by emailing us at <a :href="`mailto:${company.email}`" class="text-emerald-700 dark:text-emerald-400 hover:underline">{{ company.email }}</a>. We action verified requests within a reasonable time.</span></li>
            <li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></span><span><strong class="text-slate-800 dark:text-slate-200">Camera / microphone:</strong> you can revoke these permissions in your device settings at any time; some live-class features will not work without them.</span></li>
          </ul>
        </section>

        <!-- 6 -->
        <section :id="sections[5].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">6. Security</h2>
          <p class="mt-4 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            We use industry-standard measures to protect your information, including encrypted
            connections (HTTPS/TLS), hashed passwords, and access controls. No method of
            transmission or storage is completely secure, so we cannot guarantee absolute security.
          </p>
        </section>

        <!-- 7 -->
        <section :id="sections[6].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">7. Children's Privacy</h2>
          <p class="mt-4 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            The Service is intended for use in an educational setting. It is not directed to
            children under 13, and we do not knowingly collect personal information from children
            under 13 without appropriate consent. Where students under 18 use the Service, we rely
            on their school and/or parent or guardian to provide consent and to supervise that use.
            If you believe a child has provided us personal information without proper consent,
            contact us at <a :href="`mailto:${company.email}`" class="text-emerald-700 dark:text-emerald-400 hover:underline">{{ company.email }}</a>
            and we will delete it.
          </p>
        </section>

        <!-- 8 -->
        <section :id="sections[7].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">8. International Data Transfers</h2>
          <p class="mt-4 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            Your information may be processed and stored on servers located outside your country of
            residence, including by our service providers. We take steps to ensure your information
            receives an adequate level of protection wherever it is processed.
          </p>
        </section>

        <!-- 9 -->
        <section :id="sections[8].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">9. Changes to This Policy</h2>
          <p class="mt-4 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            We may update this Policy from time to time. When we do, we will revise the
            "Last updated" date at the top of this page and, where appropriate, notify you in the
            app. Continued use of the Service after changes take effect means you accept the
            updated Policy.
          </p>
        </section>

        <!-- 10 -->
        <section :id="sections[9].id" class="scroll-mt-24 mt-14">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">10. Contact Us</h2>
          <p class="mt-4 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            If you have questions about this Privacy Policy or your data, contact us:
          </p>
          <div class="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-2 text-[15px]">
            <p><span class="text-slate-500 dark:text-slate-400">Email:</span> <a :href="`mailto:${company.email}`" class="font-medium text-emerald-700 dark:text-emerald-400 hover:underline">{{ company.email }}</a></p>
            <p><span class="text-slate-500 dark:text-slate-400">Phone:</span> <a :href="company.phoneHref" class="font-medium text-emerald-700 dark:text-emerald-400 hover:underline">{{ company.phone }}</a></p>
            <p><span class="text-slate-500 dark:text-slate-400">Telegram:</span> <a :href="company.telegram" target="_blank" rel="noopener" class="font-medium text-emerald-700 dark:text-emerald-400 hover:underline">@RomduolScholars</a></p>
            <p><span class="text-slate-500 dark:text-slate-400">Operator:</span> <span class="font-medium text-slate-800 dark:text-slate-200">{{ company.legalName }}</span>, {{ company.country }}</p>
            <p><span class="text-slate-500 dark:text-slate-400">Website:</span> <a :href="company.website" class="font-medium text-emerald-700 dark:text-emerald-400 hover:underline">{{ company.website }}</a></p>
          </div>
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
  The Vite starter leftover `src/style.css` is imported globally (main.js) and,
  being unlayered, its bare element rules beat Tailwind utilities:
    • `#app { overflow-x: hidden; text-align: center; display: flex }`
      turns #app into a scroll container, breaking `position: sticky`.
    • `h1, h2 { color: var(--text-h) }` follows the OS `prefers-color-scheme`,
      not our `.dark` toggle, so headings go white on a light page when the
      device is in dark mode.
  We neutralise both, scoped to this public page.
-->
<style>
html:has(.privacy-page),
body:has(.privacy-page),
#app:has(.privacy-page) {
  overflow: visible !important;
  display: block !important;
  text-align: left !important;
}

/* Headings: follow our own theme, not the OS setting. */
.privacy-page h1,
.privacy-page h2,
.privacy-page h3 {
  color: #0f172a; /* slate-900 */
}
:root.dark .privacy-page h1,
:root.dark .privacy-page h2,
:root.dark .privacy-page h3 {
  color: #fff;
}

/* Links inside prose: use the page's emerald, not the starter's purple accent. */
.privacy-page article a {
  color: #047857; /* emerald-700 */
}
:root.dark .privacy-page article a {
  color: #34d399; /* emerald-400 */
}
</style>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { useTheme } from '../../composables/useTheme';
import { useLanguage } from '../../composables/useLanguage';
import { authService } from '../../services/authService';
import EditProfileModal from '../modals/EditProfileModal.vue';

const { isDark, toggleTheme } = useTheme();
const { lang, setLang, t } = useLanguage();

const currentUser = ref(authService.getCurrentUser());

const displayName = computed(() => currentUser.value?.name || 'Teacher');
const displayRole = computed(() => currentUser.value?.role || 'Teacher');
const initials = computed(() =>
  (currentUser.value?.name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
);

/**
 * Profile Dropdown
 */
const showMenu = ref(false);

const handleClickOutside = (e) => {
  if (!e.target.closest('.profile-menu')) {
    showMenu.value = false;
  }
};

const toggleMenu = () => {
  showMenu.value = !showMenu.value;
  if (showMenu.value) {
    document.addEventListener('click', handleClickOutside);
  } else {
    document.removeEventListener('click', handleClickOutside);
  }
};

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

const handleLogout = () => {
  showMenu.value = false;
  authService.logout();
  // A full page load, not router.push: App.vue's <keep-alive> keeps pages
  // like My Classes mounted with the previous account's sidebar/header/data,
  // and the next person to log in would get that cached page back.
  window.location.href = '/login';
};

/**
 * Edit Profile Modal
 */
const showEditProfileModal = ref(false);
const savingProfile = ref(false);
const profileError = ref('');

const openEditProfile = () => {
  showMenu.value = false;
  profileError.value = '';
  showEditProfileModal.value = true;
};

const closeEditProfile = () => {
  if (savingProfile.value) return;
  showEditProfileModal.value = false;
};

const handleSaveProfile = async (data) => {
  try {
    savingProfile.value = true;
    profileError.value = '';

    await authService.updateProfile(data);
    currentUser.value = authService.getCurrentUser();

    showEditProfileModal.value = false;
  } catch (err) {
    profileError.value = err.response?.data?.error || err.response?.data?.message || 'Failed to update profile.';
  } finally {
    savingProfile.value = false;
  }
};
</script>

<template>
  <header class="sticky top-0 z-30 w-full px-6 sm:px-8 py-4 flex items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
    <div class="min-w-0 flex-1">
      <slot name="left" />
    </div>

    <div class="relative flex items-center gap-3.5 shrink-0">
      <!-- Language: English / Khmer -->
      <div class="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-0.5" role="group" aria-label="Language">
        <button v-for="l in [{ c: 'en', l: 'EN' }, { c: 'km', l: 'ខ្មែរ' }]" :key="l.c" type="button" @click="setLang(l.c)"
          :aria-pressed="lang === l.c"
          :class="['px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer',
            lang === l.c ? 'bg-[#006A3A] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white']">{{ l.l }}</button>
      </div>

      <button
        @click="toggleTheme"
        type="button"
        title="Toggle Theme"
        class="p-2 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition shadow-xs cursor-pointer"
      >
        <span v-if="isDark" class="text-base leading-none block">☀️</span>
        <span v-else class="text-base leading-none block">🌙</span>
      </button>

      <button
        type="button"
        class="relative p-2 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition shadow-xs cursor-pointer"
      >
        <span class="text-base leading-none block">🔔</span>
        <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
      </button>

      <!-- Profile Menu -->
      <div class="profile-menu relative ml-1">
        <button
          type="button"
          @click="toggleMenu"
          class="flex items-center gap-3 cursor-pointer"
        >
          <div class="text-right hidden sm:block">
            <p class="text-sm font-bold text-slate-900 dark:text-white leading-tight">{{ displayName }}</p>
            <p class="text-[11px] text-slate-700 dark:text-slate-400 font-medium mt-0.5 capitalize">{{ displayRole }}</p>
          </div>
          <div class="w-10 h-10 rounded-full bg-[#006A3A] text-white flex items-center justify-center font-bold text-sm ring-2 ring-emerald-600/30 shadow-sm shrink-0 overflow-hidden">
            <img v-if="currentUser?.avatar_url" :src="currentUser.avatar_url" alt="Avatar" class="w-full h-full object-cover" />
            <span v-else>{{ initials }}</span>
          </div>
        </button>

        <!-- Dropdown -->
        <div
          v-if="showMenu"
          class="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-lg overflow-hidden py-1.5 z-20"
        >
          <button
            @click="openEditProfile"
            class="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <span>👤</span> {{ t('Edit Profile') }}
          </button>

          <div class="my-1.5 border-t border-slate-100 dark:border-slate-700"></div>

          <button
            @click="handleLogout"
            class="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
          >
            <span>🚪</span> {{ t('Logout') }}
          </button>
        </div>
      </div>
    </div>

    <!-- EDIT PROFILE MODAL -->
    <EditProfileModal
      v-if="showEditProfileModal"
      :user="currentUser"
      :saving="savingProfile"
      :error="profileError"
      @close="closeEditProfile"
      @save="handleSaveProfile"
    />
  </header>
</template>

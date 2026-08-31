<template>
  <div class="flex flex-col h-dvh w-full bg-slate-900 text-slate-100 overflow-hidden font-sans">

    <!-- Class-ended banner -->
    <div
      v-if="liveClass.status === 'completed'"
      class="bg-red-600/90 text-white text-xs md:text-sm font-semibold px-4 py-2 text-center shrink-0"
    >
      This live class has ended.
      <span v-if="!isTeacher"> You will be returned shortly…</span>
    </div>

    <!-- Toast -->
    <div
      v-if="toast"
      class="absolute top-12 left-1/2 -translate-x-1/2 z-40 bg-slate-800 border border-slate-600 text-white text-xs md:text-sm font-semibold px-4 py-2 rounded-lg shadow-lg max-w-[90vw] text-center"
    >
      {{ toast }}
    </div>

    <!-- Main Content Area -->
    <main class="flex-1 relative p-2 md:p-4 overflow-hidden flex gap-4">

      <!-- Video Grid Container -->
      <div class="flex-1 flex flex-col relative h-full min-w-0">

        <!-- Info overlay (replaces the header) -->
        <div class="absolute top-2 left-2 right-2 md:top-3 md:left-3 md:right-3 z-30 flex items-start justify-between gap-2 pointer-events-none">
          <div class="flex items-center space-x-2 min-w-0 bg-slate-900/70 backdrop-blur pl-1.5 pr-2 py-1 rounded-lg">
            <img :src="brandLogo" alt="Romduol Scholars" class="h-5 w-5 md:h-6 md:w-6 object-contain shrink-0" />
            <span class="relative flex h-1.5 w-1.5 shrink-0">
              <span v-if="classActive" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span :class="classActive ? 'bg-red-500' : 'bg-amber-500'" class="relative inline-flex rounded-full h-1.5 w-1.5"></span>
            </span>
            <span :class="classActive ? 'text-red-400' : 'text-amber-400'" class="text-[9px] font-semibold uppercase tracking-wide shrink-0">
              {{ classActive ? 'Live' : 'Standby' }}
            </span>
            <span class="text-[11px] font-semibold text-slate-200 truncate">
              {{ liveClass.title || 'Live Streaming Room' }}
            </span>
          </div>

          <div class="flex items-center space-x-2 shrink-0 bg-slate-900/70 backdrop-blur px-2 py-1 rounded-lg">
            <span v-if="isScreenSharing" class="text-[10px] font-semibold text-[#ffce04] flex items-center space-x-1">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#ffce04] animate-pulse"></span>
              <span class="hidden sm:inline">Sharing</span>
            </span>
            <span class="hidden sm:inline text-[11px] font-medium text-slate-300 tabular-nums">{{ currentTime }}</span>
            <span
              class="inline-flex h-1.5 w-1.5 rounded-full"
              :class="socketConnected ? 'bg-emerald-500' : 'bg-slate-500'"
              :title="socketConnected ? 'Realtime connected' : 'Realtime offline'"
            ></span>
            <button
              @click="showMobileDrawer = !showMobileDrawer"
              class="lg:hidden pointer-events-auto flex items-center space-x-1 text-[11px] font-medium text-slate-200 cursor-pointer"
            >
              <span>👥</span>
              <span>{{ participants.length }}</span>
              <span v-if="stage.raised_hands.length" class="bg-amber-500 text-slate-950 rounded-full px-1 font-bold">
                {{ stage.raised_hands.length }}
              </span>
            </button>
          </div>
        </div>

        <!-- Brand watermark -->
        <img
          v-if="isConnected"
          :src="brandLogo"
          alt=""
          class="absolute bottom-3 right-3 z-30 h-6 w-6 md:h-8 md:w-8 object-contain opacity-40 pointer-events-none select-none"
        />

        <div v-if="!isConnected" class="absolute inset-0 flex flex-col items-center justify-center space-y-4 text-slate-400 bg-slate-900 z-10 rounded-2xl border border-slate-800 p-4 text-center">
          <div class="flex flex-col items-center space-y-2">
            <img :src="brandLogo" alt="Romduol Scholars" class="h-14 w-14 md:h-16 md:w-16 object-contain" />
            <div class="flex flex-col leading-none">
              <span class="text-[#016a36] font-extrabold text-base md:text-lg tracking-widest uppercase">Romduol</span>
              <span class="text-[#ffce04] font-extrabold text-[10px] md:text-xs tracking-[0.22em] uppercase mt-0.5">Scholars</span>
            </div>
          </div>
          <div class="w-8 h-8 md:w-10 md:h-10 border-4 border-[#016a36] border-t-transparent rounded-full animate-spin"></div>
          <p class="text-xs md:text-sm">Connecting to live session...</p>
          <p class="text-[10px] md:text-xs text-slate-500">{{ connectionStatus }}</p>
        </div>

        <!-- Responsive Grid Layout -->
        <div
          v-else
          class="w-full h-full grid gap-2 md:gap-4 transition-all duration-300 auto-rows-fr"
          :class="[
            remoteUsers.length === 0 ? 'grid-cols-1' : '',
            remoteUsers.length === 1 ? 'grid-cols-1 md:grid-cols-2' : '',
            remoteUsers.length >= 2 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : ''
          ]"
        >
          <!-- Local Video Tile (only when publishing) -->
          <div v-if="canPublish" class="relative w-full h-full min-h-[160px] bg-slate-950 rounded-xl md:rounded-2xl overflow-hidden border border-slate-800 shadow-xl group">
            <div id="local-player" class="relative w-full h-full bg-slate-900"></div>

            <div
              v-if="!videoEnabled && !isScreenSharing"
              class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-900"
            >
              <Avatar :name="userName" :src="userAvatar" />
              <span class="text-xs md:text-sm font-medium text-slate-300">{{ userName }} (You)</span>
            </div>

            <div class="absolute bottom-2 left-2 md:bottom-3 md:left-3 z-20 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-medium text-white flex items-center space-x-1.5">
              <span>{{ userName }} (You)</span>
              <span v-if="isTeacher" class="text-amber-400 font-bold">• Teacher</span>
              <span v-else-if="rtcRole === 'co_host'" class="text-[#34c27f] font-bold">• Speaker</span>
              <span v-if="!audioEnabled" class="text-red-400">🔇</span>
            </div>
          </div>

          <!-- Remote Video Tiles -->
          <div
            v-for="user in remoteUsers"
            :key="user.uid"
            class="relative w-full h-full min-h-[160px] bg-slate-950 rounded-xl md:rounded-2xl overflow-hidden border border-slate-800 shadow-xl"
          >
            <div :id="`remote-player-${user.uid}`" class="relative w-full h-full bg-slate-900"></div>

            <div v-if="!user.hasVideo || !user.videoReady" class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-900">
              <Avatar :name="resolveName(user.uid)" :src="avatarByUid(user.uid)" />
              <span class="text-xs md:text-sm font-medium text-slate-300">{{ resolveName(user.uid) }}</span>
            </div>

            <div class="absolute bottom-2 left-2 md:bottom-3 md:left-3 z-20 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-medium text-white">
              {{ resolveName(user.uid) }}
            </div>
          </div>

          <!-- Placeholder when subscriber and nobody is publishing -->
          <div
            v-if="!canPublish && remoteUsers.length === 0"
            class="relative w-full h-full min-h-[160px] bg-slate-950 rounded-xl md:rounded-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center text-slate-500 text-sm"
          >
            <div class="w-8 h-8 border-4 border-slate-700 border-t-slate-400 rounded-full animate-spin mb-3"></div>
            Waiting for the teacher's stream…
          </div>
        </div>

        <!-- Floating raised hands (Google-Meet style) -->
        <div class="absolute bottom-3 left-3 z-30 flex flex-col items-start gap-1.5 pointer-events-none">
          <transition-group name="hand" tag="div" class="flex flex-col items-start gap-1.5">
            <div
              v-for="rh in stage.raised_hands"
              :key="rh.user_id"
              class="flex items-center space-x-2 bg-amber-500 text-slate-950 text-[11px] md:text-xs font-bold px-2.5 py-1 rounded-full shadow-lg"
            >
              <span class="text-sm leading-none animate-bounce">✋</span>
              <span>{{ rh.user_id === currentUser?.id ? 'You' : rh.name }}</span>
            </div>
          </transition-group>
        </div>
      </div>

      <!-- Right Sidebar (Desktop) -->
      <aside class="hidden lg:flex w-72 bg-slate-800/90 border border-slate-700/50 rounded-2xl flex-col overflow-hidden shrink-0">
        <div class="p-4 border-b border-slate-700/50 bg-slate-800 flex justify-between items-center">
          <h2 class="text-white font-bold text-sm">Students</h2>
          <span class="bg-slate-700 text-slate-200 text-xs px-2 py-0.5 rounded-full font-semibold">{{ participants.length }}</span>
        </div>
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <ParticipantRow
            v-for="p in participants"
            :key="p.user_id"
            :participant="p"
            :is-self="p.user_id === currentUser?.id"
            :can-manage="isTeacher"
            @invite="invite(p.user_id)"
            @mute="mute(p.user_id)"
            @remove="remove(p.user_id)"
          />
        </div>
      </aside>

      <!-- Bottom Sheet Drawer (Mobile) -->
      <div
        v-if="showMobileDrawer"
        class="lg:hidden fixed inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end"
        @click.self="showMobileDrawer = false"
      >
        <div class="bg-slate-800 border-t border-slate-700 rounded-t-2xl max-h-[65vh] flex flex-col overflow-hidden">
          <div class="p-4 border-b border-slate-700/50 flex justify-between items-center">
            <h2 class="text-white font-bold text-sm">Students ({{ participants.length }})</h2>
            <button @click="showMobileDrawer = false" class="text-slate-400 hover:text-white text-lg">✕</button>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-2">
            <ParticipantRow
              v-for="p in participants"
              :key="p.user_id"
              :participant="p"
              :is-self="p.user_id === currentUser?.id"
              :can-manage="isTeacher"
              @invite="invite(p.user_id)"
              @mute="mute(p.user_id)"
              @remove="remove(p.user_id)"
            />
          </div>
        </div>
      </div>

    </main>

    <!-- Bottom Controls Bar -->
    <footer class="flex items-center justify-center space-x-2 md:space-x-4 px-3 md:px-6 py-3 bg-slate-800/90 border-t border-slate-700/50 z-20 shrink-0">
      <template v-if="canPublish">
        <button
          @click="toggleAudio"
          :title="audioEnabled ? 'Mute microphone' : 'Unmute microphone'"
          :class="[
            'p-2.5 md:p-3.5 rounded-full transition-all duration-200 shadow-md cursor-pointer',
            audioEnabled ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' : 'bg-red-600 text-white hover:bg-red-700'
          ]"
        >
          <svg v-if="audioEnabled" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        </button>

        <button
          @click="toggleVideo"
          :disabled="isScreenSharing"
          :title="isScreenSharing ? 'Camera unavailable while sharing screen' : (videoEnabled ? 'Turn camera off' : 'Turn camera on')"
          :class="[
            'p-2.5 md:p-3.5 rounded-full transition-all duration-200 shadow-md cursor-pointer',
            isScreenSharing ? 'opacity-40 cursor-not-allowed bg-slate-700 text-slate-400' :
            videoEnabled ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' : 'bg-red-600 text-white hover:bg-red-700'
          ]"
        >
          <svg v-if="videoEnabled" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </button>

        <button
          v-if="isTeacher"
          @click="toggleScreenShare"
          :class="[
            'hidden sm:block p-2.5 md:p-3.5 rounded-full transition-all duration-200 shadow-md cursor-pointer',
            isScreenSharing ? 'bg-[#016a36] text-white hover:bg-[#015a2d] ring-4 ring-[#016a36]/30' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
          ]"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>
      </template>

      <!-- Copy stream link (everyone) -->
      <button
        @click="copyMeetingLink"
        :title="linkCopied ? 'Link copied' : 'Copy stream link'"
        :class="[
          'p-2.5 md:p-3.5 rounded-full transition-all duration-200 shadow-md cursor-pointer',
          linkCopied ? 'bg-[#016a36] text-white' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
        ]"
      >
        <svg v-if="linkCopied" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
        </svg>
      </button>

      <!-- Student: while speaking -->
      <template v-if="!isTeacher && handStatus === 'speaking'">
        <button
          @click="stopSpeaking"
          :disabled="handBusy"
          class="px-3.5 md:px-5 py-2.5 md:py-3 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs md:text-sm transition shadow-md cursor-pointer disabled:opacity-40 flex items-center space-x-1.5"
        >
          <span class="text-base leading-none">🎤</span>
          <span>Stop speaking</span>
        </button>
      </template>

      <!-- Student: audience — raise hand and/or open voice -->
      <template v-else-if="!isTeacher">
        <button
          @click="toggleHand"
          :disabled="handBusy || !classActive"
          :title="handStatus === 'raised' ? 'Lower your hand' : 'Raise your hand'"
          :class="[
            'p-2.5 md:p-3.5 rounded-full transition-all duration-200 shadow-md cursor-pointer disabled:opacity-40',
            handStatus === 'raised' ? 'bg-amber-500 text-slate-950 hover:bg-amber-600' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
          ]"
        >
          <span class="text-base md:text-lg leading-none">✋</span>
        </button>
        <button
          @click="startSpeaking"
          :disabled="handBusy || !classActive"
          class="px-3.5 md:px-5 py-2.5 md:py-3 rounded-full bg-[#016a36] hover:bg-[#015a2d] text-white font-semibold text-xs md:text-sm transition shadow-md cursor-pointer disabled:opacity-40 flex items-center space-x-1.5"
        >
          <span class="text-base leading-none">🎤</span>
          <span>Speak</span>
        </button>
      </template>
      <span v-if="!isTeacher && handStatus === 'raised'" class="hidden sm:inline text-[10px] md:text-xs text-amber-400 font-semibold">
        Hand raised
      </span>

      <!-- Teacher: one button — Start, then End class (tears everything down). -->
      <button
        v-if="isTeacher"
        @click="classActive ? endClass() : startClass()"
        :disabled="statusBusy"
        :title="classActive ? 'End class for everyone' : 'Start class'"
        :class="[
          'p-2.5 md:p-3.5 rounded-full transition-all duration-200 shadow-lg cursor-pointer shrink-0 ml-2 md:ml-4 disabled:opacity-50',
          classActive ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30' : 'bg-[#016a36] hover:bg-[#015a2d] text-white shadow-[#016a36]/30'
        ]"
      >
        <svg v-if="statusBusy" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
        </svg>
        <!-- classActive: hang-up phone; else: play -->
        <svg v-else-if="classActive" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.7A.996.996 0 010 13c0-.28.11-.53.29-.71C3.34 9.4 7.46 8 12 8s8.66 1.4 11.71 4.29c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-1.82 1.75c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 00-2.66-1.85.998.998 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
        </svg>
        <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>

      <!-- Student: leave while the class keeps running for everyone else. -->
      <button
        v-else
        @click="leaveLiveClass"
        title="Leave the class"
        class="p-2.5 md:p-3.5 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all duration-200 shadow-lg shadow-red-600/30 cursor-pointer shrink-0 ml-2 md:ml-4"
      >
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.7A.996.996 0 010 13c0-.28.11-.53.29-.71C3.34 9.4 7.46 8 12 8s8.66 1.4 11.71 4.29c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-1.82 1.75c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 00-2.66-1.85.998.998 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
        </svg>
      </button>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { liveClassService } from '../../services/liveClassService';
import { authService } from '../../services/authService';
import { connectLiveClassSocket } from '../../services/liveClassSocket';
import { generateAgoraUid } from '../../utils/agoraUid';
import brandLogo from '@/assets/logo/RS_logo.png';

const props = defineProps({
  liveClassId: { type: String, default: '' }
});

const emit = defineEmits(['left-class']);
const route = useRoute();
const router = useRouter();

const targetClassId = computed(() => props.liveClassId || route.params.id);

const currentUser = authService.getCurrentUser();
const isTeacher = ref(currentUser?.role === 'teacher');
const userName = ref(currentUser?.name || 'User');
const userAvatar = ref(currentUser?.avatar || currentUser?.avatar_url || '');

const liveClass = ref({});
const participants = ref([]);   // [{ user_id, name, avatar_url, agora_uid, role, joined_at, speaking, hand_raised }]
const stage = ref({ speakers: [], raised_hands: [] });
const classActive = ref(false);

// 'teacher' | 'student' | 'co_host' — decides whether we publish media.
const rtcRole = ref(isTeacher.value ? 'teacher' : 'student');
const canPublish = computed(() => rtcRole.value === 'teacher' || rtcRole.value === 'co_host');

// UI
const showMobileDrawer = ref(false);
const linkCopied = ref(false);
const currentTime = ref('');
const toast = ref('');
let toastTimer = null;
const statusBusy = ref(false);
const handBusy = ref(false);

const flash = (msg, ms = 3500) => {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ''), ms);
};

// Realtime
const socketConnected = ref(false);
let socketConn = null;
let pollTimer = null;

// This student's own stage status: 'none' | 'raised' | 'speaking'
const handStatus = ref('none');

// Agora
let agoraEngine = null;
let localAudioTrack = null;
let localVideoTrack = null;
let screenTrack = null;
let isPublishing = false;
const remoteUsers = ref([]);
const isConnected = ref(false);
const connectionStatus = ref('');
const audioEnabled = ref(true);
const videoEnabled = ref(true);
const isScreenSharing = ref(false);

let hasLeft = false;
let clockTimer;

const updateClock = () => {
  currentTime.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ---- name / avatar resolution for remote tiles --------------------------
const infoByUid = computed(() => {
  const map = {};
  const add = (uid, name, avatar) => {
    if (uid == null) return;
    map[uid] = { name: name || map[uid]?.name, avatar_url: avatar || map[uid]?.avatar_url || '' };
  };
  for (const p of participants.value) add(p.agora_uid ?? generateAgoraUid(p.user_id), p.name, p.avatar_url);
  for (const s of [...stage.value.speakers, ...stage.value.raised_hands]) add(s.agora_uid, s.name, s.avatar_url);
  return map;
});
const resolveName = (uid) => infoByUid.value[uid]?.name || `User ${uid}`;
const avatarByUid = (uid) => infoByUid.value[uid]?.avatar_url || '';
const initialOf = (name) => (name || '').trim().charAt(0).toUpperCase();

// ---- avatar / initials fallback tile ------------------------------------
const Avatar = {
  props: {
    name: { type: String, default: '' },
    src: { type: String, default: '' },
    size: { type: String, default: 'lg' },   // 'sm' | 'lg'
  },
  setup(p) {
    const broken = ref(false);
    return () => {
      const dims = p.size === 'sm'
        ? 'w-10 h-10 md:w-12 md:h-12 text-sm md:text-base'
        : 'w-16 h-16 md:w-24 md:h-24 text-2xl md:text-4xl';
      const shell = `${dims} rounded-full border-2 border-[#016a36] shadow-lg shrink-0`;
      if (p.src && !broken.value) {
        return h('img', {
          src: p.src, alt: p.name,
          class: `${shell} object-cover`,
          onError: () => { broken.value = true; },
        });
      }
      const letter = initialOf(p.name);
      return h('div', {
        class: `${shell} bg-[#016a36] text-white font-bold flex items-center justify-center select-none overflow-hidden`,
      }, letter || h('img', { src: brandLogo, alt: '', class: 'w-1/2 h-1/2 object-contain' }));
    };
  },
};

// ---- inline participant row component ------------------------------------
const ParticipantRow = {
  props: {
    participant: { type: Object, required: true },
    isSelf: Boolean,
    canManage: Boolean,
  },
  emits: ['mute', 'remove', 'invite'],
  setup(p, { emit: e }) {
    return () => {
      const part = p.participant;
      const isT = part.role === 'teacher';
      const badges = [];
      if (part.hand_raised) badges.push(h('span', { class: 'text-amber-400 text-sm leading-none', title: 'Hand raised' }, '✋'));
      if (part.speaking) badges.push(h('span', { class: 'text-[#34c27f] text-sm leading-none', title: 'Speaking' }, '🎤'));
      if (isT) badges.push(h('span', { class: 'text-amber-400 font-bold text-[10px] uppercase bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20' }, 'Teacher'));

      const controls = [];
      if (p.canManage && !isT && part.hand_raised && !part.speaking) {
        controls.push(h('button', {
          class: 'text-[10px] font-bold px-2 py-1 rounded-md bg-[#016a36] hover:bg-[#015a2d] text-white cursor-pointer',
          onClick: () => e('invite'),
        }, 'Invite to speak'));
      }
      if (p.canManage && !isT && part.speaking) {
        controls.push(h('button', {
          class: 'text-[10px] font-bold px-2 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white cursor-pointer',
          onClick: () => e('mute'),
        }, 'Mute'));
      }
      if (p.canManage && !isT && (part.speaking || part.hand_raised)) {
        controls.push(h('button', {
          class: 'text-[10px] font-bold px-2 py-1 rounded-md bg-slate-600 hover:bg-red-600 text-white cursor-pointer',
          onClick: () => e('remove'),
        }, part.speaking ? 'Remove' : 'Lower'));
      }

      return h('div', { class: 'p-2.5 bg-slate-700/50 hover:bg-slate-700 rounded-xl text-white text-xs flex flex-col gap-2 transition' }, [
        h('div', { class: 'flex items-center justify-between gap-2' }, [
          h('div', { class: 'flex items-center space-x-2 truncate' }, [
            h('span', {}, isT ? '👨‍🏫' : '👨‍🎓'),
            h('span', { class: 'truncate font-medium' }, part.name + (p.isSelf ? ' (You)' : '')),
          ]),
          h('div', { class: 'flex items-center gap-1.5 shrink-0' }, badges),
        ]),
        controls.length ? h('div', { class: 'flex gap-2' }, controls) : null,
      ]);
    };
  },
};

// ========================================================================
// Lifecycle
// ========================================================================
onMounted(async () => {
  updateClock();
  clockTimer = setInterval(updateClock, 1000);

  if (!targetClassId.value) {
    connectionStatus.value = 'Error: No class ID';
    return;
  }

  try {
    connectionStatus.value = 'Loading class details...';
    await refreshDetails();

    connectionStatus.value = 'Fetching Agora token...';
    const tokenRes = await liveClassService.getAgoraToken(targetClassId.value);
    const tokenData = tokenRes.data || tokenRes;

    const appId = tokenData.appId || tokenData.app_id;
    const token = tokenData.token;
    const channel = tokenData.channel || tokenData.channel_name;
    const serverUid = tokenData.uid;
    if (tokenData.role) rtcRole.value = tokenData.role;

    if (!appId || !token || !channel || serverUid === undefined) {
      throw new Error('Incomplete Agora credentials returned from backend');
    }

    await initializeAgora(appId, channel, token, serverUid);

    // Realtime layer — subscribe once, then just listen.
    connectSocket();
    await refreshStage();

    // Fallback poll only while the socket is down (participants + stage have
    // no other push then). Cheap GETs.
    pollTimer = setInterval(() => {
      if (socketConnected.value) return;
      refreshDetails().catch(() => {});
      refreshStage().catch(() => {});
    }, 8000);
  } catch (err) {
    console.error('Failed to initialize live stream:', err);
    connectionStatus.value = `Error: ${err.response?.data?.error || err.message}`;
  }
});

onBeforeUnmount(() => {
  clearInterval(clockTimer);
  clearInterval(pollTimer);
  leaveLiveClass();
});

// ========================================================================
// REST fallbacks (socket is the primary source)
// ========================================================================
function mergeStageFlags(list) {
  const speaking = new Set(stage.value.speakers.map(s => s.user_id));
  const raised = new Set(stage.value.raised_hands.map(s => s.user_id));
  return list.map(p => ({ ...p, speaking: speaking.has(p.user_id), hand_raised: raised.has(p.user_id) }));
}

async function refreshDetails() {
  const res = await liveClassService.getLiveClassDetails(targetClassId.value);
  const data = res.data?.liveClass || res.data || res;
  liveClass.value = data;
  classActive.value = data.status === 'active';

  const rows = (data.participants || []).map(p => ({
    user_id: p.id || p.user_id,
    name: p.name || 'Student',
    avatar_url: p.avatar || p.avatar_url || null,
    agora_uid: generateAgoraUid(p.id || p.user_id),
    role: p.role || 'student',
    joined_at: p.joined_at,
  }));
  if (!rows.some(p => p.user_id === currentUser?.id)) {
    rows.push({
      user_id: currentUser?.id,
      name: userName.value,
      avatar_url: userAvatar.value,
      agora_uid: generateAgoraUid(currentUser?.id),
      role: currentUser?.role || 'student',
    });
  }
  participants.value = mergeStageFlags(rows);

  if (data.status === 'completed' && !isTeacher.value) scheduleAutoLeave();
}

async function refreshStage() {
  try {
    const res = await liveClassService.getStage(targetClassId.value);
    const s = res.data?.stage || res.data || {};
    stage.value = { speakers: s.speakers || [], raised_hands: s.raised_hands || [] };
    participants.value = mergeStageFlags(participants.value);

    if (!isTeacher.value) {
      const mine = stage.value.speakers.some(x => x.user_id === currentUser?.id)
        ? 'speaking'
        : stage.value.raised_hands.some(x => x.user_id === currentUser?.id)
          ? 'raised'
          : 'none';
      if (mine !== handStatus.value) await applyHandUpdate(mine);
    }
  } catch (err) {
    console.warn('refreshStage failed:', err?.response?.data?.error || err.message);
  }
}

// ========================================================================
// Socket.IO realtime
// ========================================================================
function connectSocket() {
  socketConn = connectLiveClassSocket(targetClassId.value, {
    onState: (state) => {
      socketConnected.value = true;
      if (state.status) applyClassStatus(state.status);
      if (state.stage) stage.value = { speakers: state.stage.speakers || [], raised_hands: state.stage.raised_hands || [] };
      if (Array.isArray(state.participants)) participants.value = state.participants;
      if (state.hand && state.hand !== handStatus.value) applyHandUpdate(state.hand);
    },
    onParticipants: (list) => { participants.value = list; },
    onStage: (s) => {
      stage.value = s;
      participants.value = mergeStageFlags(participants.value);
    },
    onHandRaised: (userId, name) => {
      if (userId !== currentUser?.id) flash(`✋ ${name} raised their hand`, 4000);
    },
    onHandLowered: () => {},
    onHandUpdate: (status) => { applyHandUpdate(status); },
    onForceMute: () => { forceMuteSelf(); },
    onClassStatus: (status) => { applyClassStatus(status); },
    onError: (msg) => { console.warn('Live socket:', msg); socketConnected.value = false; },
  });
  socketConn.socket.on('disconnect', () => { socketConnected.value = false; });
  socketConn.socket.on('connect', () => { socketConnected.value = true; });
}

function applyClassStatus(status) {
  liveClass.value = { ...liveClass.value, status };
  classActive.value = status === 'active';
  if (status === 'completed' && !isTeacher.value) scheduleAutoLeave();
}

let autoLeaveTimer = null;
function scheduleAutoLeave() {
  if (autoLeaveTimer) return;
  autoLeaveTimer = setTimeout(() => leaveLiveClass(), 4000);
}

// Student: react to our own stage status changing.
async function applyHandUpdate(status) {
  const prev = handStatus.value;
  handStatus.value = status;
  if (isTeacher.value) return;

  try {
    if (status === 'speaking' && !canPublish.value) {
      await upgradeToCoHost();
    } else if (status !== 'speaking' && rtcRole.value === 'co_host') {
      await downgradeFromCoHost();
      if (prev === 'speaking') {
        flash('The teacher removed you as a speaker.', 4000);
      }
    }
  } catch (err) {
    console.error('applyHandUpdate failed:', err);
  }
}

// Teacher asked us to mute (soft — not a ban). Turn our mic off; the student
// can tap the mic button to unmute again immediately.
async function forceMuteSelf() {
  if (!localAudioTrack || !audioEnabled.value) return;
  audioEnabled.value = false;
  try { await localAudioTrack.setEnabled(false); } catch (_) { /* noop */ }
  flash('The teacher muted your mic. Tap the mic to unmute.', 4000);
}

// ========================================================================
// Agora
// ========================================================================
async function initializeAgora(appId, channel, token, numericUid) {
  connectionStatus.value = 'Creating Agora client...';
  agoraEngine = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

  agoraEngine.on('user-published', handleUserPublished);
  agoraEngine.on('user-unpublished', handleUserUnpublished);
  agoraEngine.on('user-left', (user) => {
    remoteUsers.value = remoteUsers.value.filter(u => u.uid !== user.uid);
  });
  agoraEngine.on('token-privilege-will-expire', renewAgoraToken);

  connectionStatus.value = 'Joining channel...';
  await agoraEngine.join(appId, channel, token, numericUid);

  if (canPublish.value) {
    connectionStatus.value = 'Requesting camera access...';
    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
    localVideoTrack = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: { width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    connectionStatus.value = 'Publishing media...';
    await agoraEngine.publish([localAudioTrack, localVideoTrack]);
    isPublishing = true;
  }

  isConnected.value = true;
  await nextTick();
  if (localVideoTrack) localVideoTrack.play('local-player', { fit: 'cover' });
}

async function renewAgoraToken() {
  try {
    const res = await liveClassService.getAgoraToken(targetClassId.value);
    const data = res.data || res;
    if (data.token) await agoraEngine.renewToken(data.token);
    if (data.role) rtcRole.value = data.role;
  } catch (err) {
    console.error('Token renew failed:', err);
  }
}

function upsertRemote(uid, patch) {
  const i = remoteUsers.value.findIndex(u => u.uid === uid);
  if (i === -1) {
    remoteUsers.value.push({ uid, hasVideo: false, hasAudio: false, videoReady: false, ...patch });
  } else {
    remoteUsers.value[i] = { ...remoteUsers.value[i], ...patch };
  }
}

const handleUserPublished = async (user, mediaType) => {
  await agoraEngine.subscribe(user, mediaType);

  if (mediaType === 'video') {
    upsertRemote(user.uid, { hasVideo: true, videoReady: false });
    await nextTick();
    await user.videoTrack.play(`remote-player-${user.uid}`, { fit: 'cover' });
    upsertRemote(user.uid, { videoReady: true });
  }

  if (mediaType === 'audio') {
    // Keep an avatar tile for a camera-off participant who still has audio.
    upsertRemote(user.uid, { hasAudio: true });
    user.audioTrack.play();
  }
};

const handleUserUnpublished = (user, mediaType) => {
  const i = remoteUsers.value.findIndex(u => u.uid === user.uid);
  if (i === -1) return;

  if (mediaType === 'video') {
    // Camera off — keep the tile, show the avatar instead of dropping them.
    if (remoteUsers.value[i].hasAudio) {
      remoteUsers.value[i] = { ...remoteUsers.value[i], hasVideo: false, videoReady: false };
    } else {
      remoteUsers.value.splice(i, 1);
    }
  } else if (mediaType === 'audio') {
    if (remoteUsers.value[i].hasVideo) {
      remoteUsers.value[i] = { ...remoteUsers.value[i], hasAudio: false };
    } else {
      remoteUsers.value.splice(i, 1);
    }
  }
};

// ---- co-host upgrade / downgrade (student) ------------------------------
// Tracks are kept alive across stop/start (setEnabled toggles the camera)
// so re-opening voice never re-acquires hardware — the part that fails on
// mobile.
async function upgradeToCoHost() {
  if (isPublishing) return;
  isPublishing = true;
  try {
    connectionStatus.value = 'Enabling your mic & camera...';
    const res = await liveClassService.getAgoraToken(targetClassId.value);
    const data = res.data || res;
    if (data.token) await agoraEngine.renewToken(data.token);
    rtcRole.value = data.role || 'co_host';

    if (!localAudioTrack) {
      localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
    } else {
      await localAudioTrack.setEnabled(true);
    }
    if (!localVideoTrack) {
      localVideoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
    } else {
      await localVideoTrack.setEnabled(true);
    }

    const alreadyUp = agoraEngine.localTracks || [];
    const toPublish = [localAudioTrack, localVideoTrack].filter(t => t && !alreadyUp.includes(t));
    if (toPublish.length) await agoraEngine.publish(toPublish);

    audioEnabled.value = true;
    videoEnabled.value = true;
    await nextTick();
    localVideoTrack.play('local-player', { fit: 'cover' });
  } catch (err) {
    console.error('Co-host upgrade failed:', err);
    isPublishing = false;
    throw err;
  }
}

async function downgradeFromCoHost() {
  try {
    const published = (agoraEngine.localTracks || []).filter(Boolean);
    if (published.length) await agoraEngine.unpublish(published);
    await localVideoTrack?.setEnabled(false);
    await localAudioTrack?.setEnabled(false);
    isScreenSharing.value = false;
    rtcRole.value = 'student';
  } catch (err) {
    console.error('Co-host downgrade failed:', err);
  } finally {
    isPublishing = false;
  }
}

// ========================================================================
// Controls
// ========================================================================
const toggleAudio = async () => {
  if (!localAudioTrack) return;
  audioEnabled.value = !audioEnabled.value;
  await localAudioTrack.setEnabled(audioEnabled.value);
};

const toggleVideo = async () => {
  if (isScreenSharing.value || !localVideoTrack) return;
  videoEnabled.value = !videoEnabled.value;
  await localVideoTrack.setEnabled(videoEnabled.value);
};

const toggleScreenShare = async () => {
  try {
    if (!isScreenSharing.value) {
      screenTrack = await AgoraRTC.createScreenVideoTrack({
        encoderConfig: '1080p_1',
        optimizationMode: 'detail',
      }, 'auto');

      const track = Array.isArray(screenTrack) ? screenTrack[0] : screenTrack;
      if (localVideoTrack) await agoraEngine.unpublish(localVideoTrack);
      await agoraEngine.publish(track);

      await nextTick();
      track.play('local-player', { fit: 'cover' });
      isScreenSharing.value = true;
      track.on('track-ended', handleStopScreenShare);
    } else {
      await handleStopScreenShare();
    }
  } catch (err) {
    console.error('Failed to toggle screen share:', err);
  }
};

const handleStopScreenShare = async () => {
  if (!isScreenSharing.value) return;
  if (screenTrack) {
    const track = Array.isArray(screenTrack) ? screenTrack[0] : screenTrack;
    await agoraEngine.unpublish(track);
    track.close();
    screenTrack = null;
  }
  if (localVideoTrack) {
    await agoraEngine.publish(localVideoTrack);
    await nextTick();
    localVideoTrack.play('local-player', { fit: 'cover' });
  }
  isScreenSharing.value = false;
};

const showActionError = (err, fallback) => {
  console.error(fallback, err);
  flash(err?.response?.data?.error || fallback);
};

// Student: toggle the silent raised-hand signal (no publishing).
const toggleHand = async () => {
  if (handBusy.value) return;
  handBusy.value = true;
  try {
    if (handStatus.value === 'raised') {
      await liveClassService.lowerHand(targetClassId.value);
      handStatus.value = 'none';
    } else if (handStatus.value === 'none') {
      const res = await liveClassService.raiseHand(targetClassId.value);
      handStatus.value = res.data?.status || 'raised';
    }
  } catch (err) {
    showActionError(err, 'Could not update your hand. Try again.');
  } finally {
    handBusy.value = false;
  }
};

// Student: open your voice immediately — no teacher approval.
const startSpeaking = async () => {
  if (handBusy.value) return;
  handBusy.value = true;
  try {
    await liveClassService.speak(targetClassId.value);
    handStatus.value = 'speaking';
    await upgradeToCoHost();
  } catch (err) {
    showActionError(err, 'Could not open your microphone. Try again.');
  } finally {
    handBusy.value = false;
  }
};

// Student: stop speaking -> back to audience.
const stopSpeaking = async () => {
  if (handBusy.value) return;
  handBusy.value = true;
  try {
    await liveClassService.lowerHand(targetClassId.value);
    handStatus.value = 'none';
    if (rtcRole.value === 'co_host') await downgradeFromCoHost();
  } catch (err) {
    showActionError(err, 'Could not stop speaking. Try again.');
  } finally {
    handBusy.value = false;
  }
};

// Teacher: pull a raised hand straight onto the stage.
const invite = async (userId) => {
  try {
    await liveClassService.inviteSpeaker(targetClassId.value, userId);
  } catch (err) {
    showActionError(err, 'Could not invite this student.');
  }
};

// Teacher: ask a speaker to mute (soft — student can unmute themselves).
const mute = async (userId) => {
  try {
    await liveClassService.muteSpeaker(targetClassId.value, userId);
    flash('Asked to mute.', 1800);
  } catch (err) {
    showActionError(err, 'Could not mute this speaker.');
  }
};

// Teacher: drop a student off the stage (speaker or raised hand).
const remove = async (userId) => {
  try {
    await liveClassService.removeSpeaker(targetClassId.value, userId);
  } catch (err) {
    showActionError(err, 'Could not update this participant.');
  }
};

// Teacher: start the class.
const startClass = async () => {
  if (statusBusy.value) return;
  statusBusy.value = true;
  try {
    await liveClassService.startLiveClass(targetClassId.value);
    applyClassStatus('active');
  } catch (err) {
    console.error('Failed to start class:', err);
    showActionError(err, 'Could not start the class.');
  } finally {
    statusBusy.value = false;
  }
};

// Teacher: end the class for everyone. This also removes every participant
// server-side and pushes class:status "completed" (students auto-leave), so
// there is no separate Leave for the teacher — we just tear down and go.
const endClass = async () => {
  if (statusBusy.value) return;
  if (!window.confirm('End class for everyone? All students will be removed.')) return;
  statusBusy.value = true;
  try {
    await liveClassService.endLiveClass(targetClassId.value);
  } catch (err) {
    console.error('End class error:', err);
  } finally {
    applyClassStatus('completed');
    await teardownAndExit();   // no POST /:id/leave for the teacher — end covers it
    statusBusy.value = false;
  }
};

const copyMeetingLink = () => {
  navigator.clipboard.writeText(window.location.href);
  linkCopied.value = true;
  setTimeout(() => (linkCopied.value = false), 2500);
};

// Tear down Agora + socket and navigate away. Shared by the student's Leave,
// the teacher's End class, and component unmount.
async function teardownAndExit() {
  const alreadyGone = hasLeft;
  hasLeft = true;
  clearInterval(pollTimer);
  if (autoLeaveTimer) clearTimeout(autoLeaveTimer);

  try {
    if (!alreadyGone) {
      socketConn?.disconnect();   // emits live-class:unsubscribe
      if (screenTrack) {
        const track = Array.isArray(screenTrack) ? screenTrack[0] : screenTrack;
        try { track.stop(); } catch (_) { /* noop */ }
        track.close();
      }
      try { localAudioTrack?.stop(); localVideoTrack?.stop(); } catch (_) { /* noop */ }
      localAudioTrack?.close();
      localVideoTrack?.close();
      if (agoraEngine) await agoraEngine.leave();
    }
  } catch (err) {
    console.error('Teardown error:', err);
  } finally {
    emit('left-class');
    if (route.name === 'LiveStream') router.push('/');
  }
}

// Student leaves while the class keeps running.
const leaveLiveClass = async () => {
  const alreadyGone = hasLeft;
  try {
    if (!alreadyGone && !isTeacher.value && targetClassId.value) {
      await liveClassService.leaveLiveClass(targetClassId.value);
    }
  } catch (err) {
    console.error('Error while leaving class:', err);
  }
  await teardownAndExit();
};
</script>

<style scoped>
/* Ensure Agora's dynamically created divs and video tags expand properly */
#local-player :deep(div),
#local-player :deep(video),
[id^="remote-player-"] :deep(div),
[id^="remote-player-"] :deep(video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
}

.hand-enter-active,
.hand-leave-active {
  transition: all 0.25s ease;
}
.hand-enter-from,
.hand-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>

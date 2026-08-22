<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue';
import { useRoute } from 'vue-router';
import AgoraRTC from 'agora-rtc-sdk-ng';

const route = useRoute();

// Credentials & Param definitions
const appId = '90f0e5a8c82643fcb78693895d820267';
const token = '007eJxTYPDID18csCDln4yu0Z39XbXdple/PHynforF4EjwrSm2GskKDJYGaQappokWyRZGZibGaclJ5hZmlsYWlqYpFkYGRmbmRoodWQ2BjAx3xMOZGRkgEMQXZSjKT8kvzdHNySxL1U3OSSwu1k1JLWNgAAB78CS2';
const channelName = computed(() => route.params.channelName || 'rcn-btfd-rdc');

const userName = 'Chankreas';
const userEmail = 'chankreasum@gmail.com';
const userAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250';
const uid = Math.floor(Math.random() * 10000);

// UI States
const isConnected = ref(false);
const audioEnabled = ref(true);
const videoEnabled = ref(true);
const isHandRaised = ref(false);
const showLinkModal = ref(true);
const linkCopied = ref(false);
const currentTime = ref('');

// WebRTC Engine Variables
let agoraEngine = null;
let localAudioTrack = null;
let localVideoTrack = null;
const remoteUsers = ref([]);

// Clock Timer
const updateClock = () => {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const joinChannel = async () => {
  try {
    agoraEngine = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp9' });

    agoraEngine.on('user-published', async (user, mediaType) => {
      await agoraEngine.subscribe(user, mediaType);
      if (mediaType === 'video') {
        if (!remoteUsers.value.find(u => u.uid === user.uid)) {
          remoteUsers.value.push({ uid: user.uid, videoTrack: user.videoTrack });
        }
        await nextTick();
        user.videoTrack.play(`remote-player-${user.uid}`);
      }
      if (mediaType === 'audio') user.audioTrack.play();
    });

    agoraEngine.on('user-left', (user) => {
      remoteUsers.value = remoteUsers.value.filter(u => u.uid !== user.uid);
    });

    await agoraEngine.join(appId, channelName.value, token || null, uid);

    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    localVideoTrack = await AgoraRTC.createCameraVideoTrack();

    await agoraEngine.publish([localAudioTrack, localVideoTrack]);

    isConnected.value = true;

    await nextTick();
    localVideoTrack.play(`local-player-${uid}`);
  } catch (err) {
    console.error('Agora Connection Error:', err);
  }
};

const toggleAudio = async () => {
  if (localAudioTrack) {
    audioEnabled.value = !audioEnabled.value;
    await localAudioTrack.setEnabled(audioEnabled.value);
  }
};

const toggleVideo = async () => {
  if (localVideoTrack) {
    videoEnabled.value = !videoEnabled.value;
    await localVideoTrack.setEnabled(videoEnabled.value);
  }
};

const toggleHand = () => {
  isHandRaised.value = !isHandRaised.value;
};

const copyMeetingLink = () => {
  const meetingUrl = `meet.google.com/${channelName.value}`;
  navigator.clipboard.writeText(meetingUrl);
  linkCopied.value = true;
  setTimeout(() => (linkCopied.value = false), 2500);
};

const leaveChannel = async () => {
  if (localAudioTrack) await localAudioTrack.close();
  if (localVideoTrack) await localVideoTrack.close();
  if (agoraEngine) await agoraEngine.leave();
  window.close();
};

let timerId;
onMounted(() => {
  updateClock();
  timerId = setInterval(updateClock, 1000);
  joinChannel();
});

onBeforeUnmount(() => {
  clearInterval(timerId);
  leaveChannel();
});
</script>

<template>
  <div class="relative w-screen h-screen bg-[#111214] text-white font-sans overflow-hidden flex flex-col justify-between p-3 sm:p-4 select-none">
    
    <!-- TOP BAR -->
    <header class="flex justify-between items-center z-10 px-2 py-1">
      <div class="flex items-center gap-3 text-[#E3E2E6] text-sm font-medium">
        <span>{{ currentTime }}</span>
        <span class="text-slate-600">|</span>
        <span class="tracking-wide text-xs sm:text-sm">{{ channelName }}</span>
        <button class="hover:bg-white/10 p-1.5 rounded-full transition" title="Meeting Info">
          <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <div class="relative">
          <img :src="userAvatar" class="w-8 h-8 rounded-full border border-slate-700 object-cover" alt="User Avatar" />
          <span class="absolute -top-0.5 -right-0.5 bg-[#1e1e1e] text-[9px] font-bold px-1 rounded-full text-slate-300 border border-slate-700">1</span>
        </div>
      </div>
    </header>

    <!-- MAIN STAGE AREA -->
    <main class="relative flex-1 w-full my-2 rounded-2xl bg-[#3c4832] overflow-hidden flex items-center justify-center border border-white/5">
      
      <!-- Video Grid Container -->
      <div v-if="isConnected" class="w-full h-full grid gap-2 p-2" :class="remoteUsers.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'">
        
        <!-- Local User Video Stage -->
        <div class="relative w-full h-full rounded-xl overflow-hidden flex items-center justify-center">
          <div :id="`local-player-${uid}`" class="w-full h-full [&>div]:!w-full [&>div]:!h-full [&>video]:!object-cover"></div>
          
          <!-- Avatar Fallback when camera is disabled -->
          <div v-if="!videoEnabled" class="absolute inset-0 flex items-center justify-center bg-[#3c4832]">
            <img :src="userAvatar" class="w-24 h-24 rounded-full object-cover border-2 border-white/20 shadow-2xl" alt="Avatar" />
          </div>
        </div>

        <!-- Remote Participants -->
        <div v-for="user in remoteUsers" :key="user.uid" class="relative w-full h-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
          <div :id="`remote-player-${user.uid}`" class="w-full h-full [&>div]:!w-full [&>div]:!h-full [&>video]:!object-cover"></div>
        </div>
      </div>

      <!-- Connecting Spinner -->
      <div v-else class="text-center space-y-3">
        <div class="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-xs font-medium text-slate-300">Joining call...</p>
      </div>

      <!-- OVERLAY MODAL: Your meeting's ready -->
      <div 
        v-if="showLinkModal" 
        class="absolute bottom-4 left-4 z-30 w-80 bg-white text-slate-900 rounded-2xl p-5 shadow-2xl transition-all duration-300 border border-slate-100"
      >
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-base font-medium text-slate-900">Your meeting's ready</h2>
          <button @click="showLinkModal = false" class="text-slate-500 hover:text-slate-800 p-1 rounded-full hover:bg-slate-100 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <button @click="copyMeetingLink" class="w-full bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium text-xs py-2.5 px-4 rounded-full flex items-center justify-center gap-2 transition shadow-sm mb-3">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
          Add others
        </button>

        <p class="text-[11px] text-slate-600 mb-2">Or share this meeting link with others you want in the meeting</p>

        <div class="flex items-center justify-between bg-[#f0f4f9] rounded-lg px-3 py-2 text-xs font-medium text-slate-800 mb-3 border border-slate-200/60">
          <span class="truncate mr-2">meet.google.com/{{ channelName }}</span>
          <button @click="copyMeetingLink" class="p-1 hover:bg-slate-200 rounded text-slate-700 transition" :title="linkCopied ? 'Copied!' : 'Copy link'">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          </button>
        </div>

        <div class="flex items-center gap-2 text-[10px] text-slate-500 mb-2">
          <svg class="w-3.5 h-3.5 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>
          <span>People who use this meeting link must get your permission before they can join.</span>
        </div>

        <p class="text-[10px] text-slate-400 border-t border-slate-100 pt-2">Joined as {{ userEmail }}</p>
      </div>

    </main>

    <!-- BOTTOM CONTROL BAR -->
    <footer class="flex justify-between items-center z-10 px-2 py-1">
      
      <!-- Placeholder Left Spacer -->
      <div class="w-24 hidden md:block"></div>

      <!-- CENTER MEET CONTROLS -->
      <div class="flex items-center gap-2 bg-[#1e1e1e]/90 backdrop-blur-md px-3 py-2 rounded-full border border-white/5 shadow-xl mx-auto">
        
        <!-- Microphone Button -->
        <button 
          @click="toggleAudio" 
          class="w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer"
          :class="audioEnabled ? 'bg-[#3c4043] hover:bg-[#4a4e52] text-white' : 'bg-[#ea4335] text-white'"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
        </button>

        <!-- Camera Button -->
        <button 
          @click="toggleVideo" 
          class="w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer relative"
          :class="videoEnabled ? 'bg-[#3c4043] hover:bg-[#4a4e52] text-white' : 'bg-[#ea4335] text-white'"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          <span class="absolute -top-1 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-[#1e1e1e] flex items-center justify-center text-[8px] text-black font-extrabold">!</span>
        </button>

        <!-- Screen Share -->
        <button class="w-10 h-10 rounded-full bg-[#3c4043] hover:bg-[#4a4e52] text-white flex items-center justify-center transition cursor-pointer">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
        </button>

        <!-- Reactions / Emoji -->
        <button class="w-10 h-10 rounded-full bg-[#3c4043] hover:bg-[#4a4e52] text-white flex items-center justify-center transition cursor-pointer">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </button>

        <!-- Captions (CC) -->
        <button class="w-10 h-10 rounded-full bg-[#3c4043] hover:bg-[#4a4e52] text-white flex items-center justify-center font-bold text-xs transition cursor-pointer">
          CC
        </button>

        <!-- Raise Hand -->
        <button 
          @click="toggleHand" 
          class="w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer"
          :class="isHandRaised ? 'bg-blue-600 text-white' : 'bg-[#3c4043] hover:bg-[#4a4e52] text-white'"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5a1.5 1.5 0 013 0v5m0 0V3.5a1.5 1.5 0 013 0V12"></path></svg>
        </button>

        <!-- More Options (...) -->
        <button class="w-10 h-10 rounded-full bg-[#3c4043] hover:bg-[#4a4e52] text-white flex items-center justify-center transition cursor-pointer">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
        </button>

        <!-- End Call (Red Pill Button) -->
        <button 
          @click="leaveChannel" 
          class="w-14 h-10 rounded-full bg-[#ea4335] hover:bg-red-600 text-white flex items-center justify-center transition shadow-md cursor-pointer ml-1"
          title="Leave call"
        >
          <svg class="w-5 h-5 transform rotate-[135deg]" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
        </button>
      </div>

      <!-- RIGHT SIDE TOOLS -->
      <div class="hidden sm:flex items-center gap-2 bg-[#1e1e1e]/90 backdrop-blur-md px-3 py-2 rounded-full border border-white/5">
        <button class="p-2 rounded-full hover:bg-white/10 text-slate-300 transition" title="In-call messages">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
        </button>
        <button class="p-2 rounded-full hover:bg-white/10 text-slate-300 transition" title="Activities">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
        </button>
        <button class="p-2 rounded-full hover:bg-white/10 text-slate-300 transition" title="Host controls">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </button>
      </div>

    </footer>
  </div>
</template>
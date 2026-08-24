<template>
  <div class="flex flex-col h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
    
    <!-- Top Header Bar -->
    <header class="flex items-center justify-between px-6 py-4 bg-slate-800/80 backdrop-blur border-b border-slate-700/50 z-10">
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2">
          <span class="relative flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span class="text-xs font-semibold uppercase tracking-wider text-red-400">Live</span>
        </div>
        <h1 class="text-lg font-bold text-white truncate max-w-md">
          {{ liveClassTitle || 'Live Streaming Room' }}
        </h1>
      </div>

      <div class="flex items-center space-x-4">
        <span class="text-sm font-medium text-slate-400">{{ currentTime }}</span>
        <button 
          @click="copyMeetingLink" 
          class="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition"
        >
          <span>{{ linkCopied ? 'Link Copied!' : 'Copy Stream Link' }}</span>
        </button>
      </div>
    </header>

    <!-- Main Content Video Grid -->
    <main class="flex-1 relative p-4 overflow-hidden flex items-center justify-center">
      
      <!-- Screen Share Active Highlight Banner -->
      <div 
        v-if="isScreenSharing" 
        class="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-indigo-600/90 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg border border-indigo-400/30 backdrop-blur flex items-center space-x-2"
      >
        <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>You are sharing your screen</span>
      </div>

      <!-- Connecting State -->
      <div v-if="!isConnected" class="flex flex-col items-center justify-center space-y-4 text-slate-400">
        <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm">Connecting to live session...</p>
      </div>

      <!-- Video Grid Container -->
      <div 
        v-else 
        class="w-full h-full grid gap-4 transition-all duration-300"
        :class="[
          remoteUsers.length === 0 ? 'grid-cols-1' : '',
          remoteUsers.length === 1 ? 'grid-cols-1 md:grid-cols-2' : '',
          remoteUsers.length >= 2 ? 'grid-cols-2 lg:grid-cols-3' : ''
        ]"
      >
        <!-- Local User Video Tile -->
        <div class="relative w-full h-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl group">
          <div :id="`local-player-${uid}`" class="w-full h-full object-cover"></div>

          <!-- Video Off Overlay -->
          <div 
            v-if="!videoEnabled && !isScreenSharing" 
            class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900"
          >
            <img :src="userAvatar" :alt="userName" class="w-20 h-20 rounded-full border-2 border-indigo-500 shadow-lg mb-2" />
            <span class="text-sm font-medium text-slate-300">{{ userName }} (You)</span>
          </div>

          <!-- User Name Label -->
          <div class="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-lg text-xs font-medium text-white flex items-center space-x-2">
            <span>{{ userName }} (You)</span>
            <span v-if="isScreenSharing" class="text-indigo-400 font-semibold">• Screen</span>
            <span v-if="!audioEnabled" class="text-red-400">Muted</span>
          </div>

          <!-- Hand Raised Badge -->
          <div v-if="isHandRaised" class="absolute top-3 right-3 bg-amber-500 text-slate-950 px-2.5 py-1 rounded-full text-xs font-bold shadow-md">
            ✋ Raised Hand
          </div>
        </div>

        <!-- Remote Users Video Tiles -->
        <div 
          v-for="user in remoteUsers" 
          :key="user.uid" 
          class="relative w-full h-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl"
        >
          <div :id="`remote-player-${user.uid}`" class="w-full h-full object-cover"></div>
          <div class="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-lg text-xs font-medium text-white">
            User #{{ user.uid }}
          </div>
        </div>
      </div>
    </main>

    <!-- Bottom Controls Bar -->
    <footer class="flex items-center justify-center space-x-4 px-6 py-4 bg-slate-800/90 border-t border-slate-700/50 z-10">
      
      <!-- Toggle Microphone -->
      <button 
        @click="toggleAudio" 
        :class="[
          'p-3.5 rounded-full transition-all duration-200 shadow-md',
          audioEnabled ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'
        ]"
        :title="audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'"
      >
        <svg v-if="audioEnabled" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      </button>

      <!-- Toggle Camera -->
      <button 
        @click="toggleVideo" 
        :disabled="isScreenSharing"
        :class="[
          'p-3.5 rounded-full transition-all duration-200 shadow-md',
          isScreenSharing ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500' :
          videoEnabled ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'
        ]"
        :title="isScreenSharing ? 'Camera disabled while screen sharing' : videoEnabled ? 'Turn Off Camera' : 'Turn On Camera'"
      >
        <svg v-if="videoEnabled" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </button>

      <!-- Toggle Screen Share -->
      <button 
        @click="toggleScreenShare" 
        :class="[
          'p-3.5 rounded-full transition-all duration-200 shadow-md',
          isScreenSharing ? 'bg-indigo-600 text-white hover:bg-indigo-700 ring-4 ring-indigo-500/30' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
        ]"
        :title="isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>

      <!-- Raise/Lower Hand -->
      <button 
        @click="toggleHand" 
        :class="[
          'p-3.5 rounded-full transition-all duration-200 shadow-md',
          isHandRaised ? 'bg-amber-500 text-slate-950 hover:bg-amber-600' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
        ]"
        :title="isHandRaised ? 'Lower Hand' : 'Raise Hand'"
      >
        <span class="text-lg leading-none">✋</span>
      </button>

      <!-- Leave Stream Button -->
      <button 
        @click="leaveChannel" 
        class="px-5 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-red-600/30 flex items-center space-x-2 ml-4"
      >
        <span>Leave Call</span>
      </button>

    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { useLiveClassStore } from '@/stores/liveClass';

const route = useRoute();
const router = useRouter();
const liveClassStore = useLiveClassStore();

// Credentials & Live Session Details
const classId = computed(() => route.params.id);
const appId = ref('');
const token = ref('');
const channelName = ref('');
const liveClassTitle = ref('');

const userName = ref('Chankreas');
const userEmail = ref('chankreasum@gmail.com');
const userAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250';
const uid = ref(Math.floor(Math.random() * 10000));

// UI Component States
const isConnected = ref(false);
const audioEnabled = ref(true);
const videoEnabled = ref(true);
const isScreenSharing = ref(false);
const isHandRaised = ref(false);
const linkCopied = ref(false);
const currentTime = ref('');

// WebRTC Track & Client Engine Instances
let agoraEngine = null;
let localAudioTrack = null;
let localVideoTrack = null;
let screenTrack = null;
const remoteUsers = ref([]);

// Real-Time Header Clock
const updateClock = () => {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Initialize and Join Agora RTC Stream
const joinChannel = async () => {
  try {
    const response = await liveClassStore.joinClassSession(classId.value);
    
    if (!response.success) {
      console.error('Failed to obtain class credentials from API');
      return;
    }

    appId.value = response.data.appId;
    token.value = response.data.token;
    channelName.value = response.data.channel;
    liveClassTitle.value = response.data.liveClass?.title || 'Live Stream';

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

    await agoraEngine.join(appId.value, channelName.value, token.value, uid.value);

    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    localVideoTrack = await AgoraRTC.createCameraVideoTrack();

    await agoraEngine.publish([localAudioTrack, localVideoTrack]);

    isConnected.value = true;

    await nextTick();
    localVideoTrack.play(`local-player-${uid.value}`);
  } catch (err) {
    console.error('Agora Connection Error:', err);
  }
};

// Controls Logic
const toggleAudio = async () => {
  if (localAudioTrack) {
    audioEnabled.value = !audioEnabled.value;
    await localAudioTrack.setEnabled(audioEnabled.value);
  }
};

const toggleVideo = async () => {
  if (isScreenSharing.value) return;
  if (localVideoTrack) {
    videoEnabled.value = !videoEnabled.value;
    await localVideoTrack.setEnabled(videoEnabled.value);
  }
};

const toggleScreenShare = async () => {
  try {
    if (!isScreenSharing.value) {
      screenTrack = await AgoraRTC.createScreenVideoTrack({
        encoderConfig: '1080p_1',
        optimizationMode: 'detail',
      }, 'auto');

      await agoraEngine.unpublish(localVideoTrack);
      
      const trackToPublish = Array.isArray(screenTrack) ? screenTrack[0] : screenTrack;
      await agoraEngine.publish(trackToPublish);

      await nextTick();
      trackToPublish.play(`local-player-${uid.value}`);

      isScreenSharing.value = true;

      trackToPublish.on('track-ended', handleStopScreenShare);
    } else {
      await handleStopScreenShare();
    }
  } catch (err) {
    console.error('Failed to share screen:', err);
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
    localVideoTrack.play(`local-player-${uid.value}`);
  }

  isScreenSharing.value = false;
};

const toggleHand = () => {
  isHandRaised.value = !isHandRaised.value;
};

const copyMeetingLink = () => {
  navigator.clipboard.writeText(window.location.href);
  linkCopied.value = true;
  setTimeout(() => (linkCopied.value = false), 2500);
};

const leaveChannel = async () => {
  if (screenTrack) {
    const track = Array.isArray(screenTrack) ? screenTrack[0] : screenTrack;
    track.close();
  }
  if (localAudioTrack) await localAudioTrack.close();
  if (localVideoTrack) await localVideoTrack.close();
  if (agoraEngine) await agoraEngine.leave();

  if (classId.value) {
    await liveClassStore.leaveSession(classId.value);
  }

  if (window.history.length > 1) {
    router.push('/dashboard');
  } else {
    window.close();
  }
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
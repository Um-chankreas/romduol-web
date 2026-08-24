<template>
  <div class="flex flex-col h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
    
    <!-- Top Header Bar -->
    <header class="flex items-center justify-between px-6 py-4 bg-slate-800/80 backdrop-blur border-b border-slate-700/50 z-10">
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2">
          <span class="relative flex h-3 w-3">
            <span v-if="classActive" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span :class="classActive ? 'bg-red-500' : 'bg-amber-500'" class="relative inline-flex rounded-full h-3 w-3"></span>
          </span>
          <span :class="classActive ? 'text-red-400' : 'text-amber-400'" class="text-xs font-semibold uppercase tracking-wider">
            {{ classActive ? 'Live' : 'Standby' }}
          </span>
        </div>
        <div>
          <h1 class="text-lg font-bold text-white truncate max-w-md">
            {{ liveClass.title || 'Live Streaming Room' }}
          </h1>
          <p v-if="liveClass.channel_name" class="text-xs text-slate-400">
            Channel: <span class="font-mono text-emerald-400">{{ liveClass.channel_name }}</span>
          </p>
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <span class="text-sm font-medium text-slate-400">{{ currentTime }}</span>
        
        <!-- Copy Stream Link Button -->
        <button 
          @click="copyMeetingLink" 
          class="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition cursor-pointer"
        >
          <span>{{ linkCopied ? 'Link Copied!' : 'Copy Link' }}</span>
        </button>

        <!-- Teacher Controls: Start/End Class -->
        <button
          v-if="isTeacher"
          @click="toggleClassStatus"
          :class="[
            'px-4 py-1.5 text-xs rounded-lg font-bold transition shadow-md cursor-pointer',
            classActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          ]"
        >
          {{ classActive ? 'End Class' : 'Start Class' }}
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 relative p-4 overflow-hidden flex gap-4">
      
      <!-- Screen Share Active Banner -->
      <div 
        v-if="isScreenSharing" 
        class="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-indigo-600/90 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg border border-indigo-400/30 backdrop-blur flex items-center space-x-2"
      >
        <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>You are sharing your screen</span>
      </div>

      <!-- Video Grid Container -->
      <div class="flex-1 flex flex-col relative h-full">
        <!-- Connecting State Overlay -->
        <div v-if="!isConnected" class="absolute inset-0 flex flex-col items-center justify-center space-y-4 text-slate-400 bg-slate-900 z-10 rounded-2xl border border-slate-800">
          <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-sm">Connecting to live session...</p>
          <p class="text-xs text-slate-500">{{ connectionStatus }}</p>
        </div>

        <!-- Dynamic Grid Layout -->
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
            <!-- Video Container -->
            <div id="local-player" class="relative w-full h-full bg-slate-900"></div>

            <!-- Video Off Overlay -->
            <div 
              v-if="!videoEnabled && !isScreenSharing" 
              class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900"
            >
              <img :src="userAvatar" :alt="userName" class="w-20 h-20 rounded-full border-2 border-indigo-500 shadow-lg mb-2 object-cover" />
              <span class="text-sm font-medium text-slate-300">{{ userName }} (You)</span>
            </div>

            <!-- User Label -->
            <div class="absolute bottom-3 left-3 z-20 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-lg text-xs font-medium text-white flex items-center space-x-2">
              <span>{{ userName }} (You)</span>
              <span v-if="isTeacher" class="text-amber-400 font-bold">• Teacher</span>
              <span v-if="isScreenSharing" class="text-indigo-400 font-semibold">• Screen</span>
              <span v-if="!audioEnabled" class="text-red-400">Muted</span>
            </div>

            <!-- Hand Raised Badge -->
            <div v-if="isHandRaised" class="absolute top-3 right-3 z-20 bg-amber-500 text-slate-950 px-2.5 py-1 rounded-full text-xs font-bold shadow-md">
              ✋ Raised Hand
            </div>
          </div>

          <!-- Remote Users Video Tiles -->
          <div 
            v-for="user in remoteUsers" 
            :key="user.uid" 
            class="relative w-full h-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl"
          >
            <div :id="`remote-player-${user.uid}`" class="relative w-full h-full bg-slate-900"></div>
            
            <div v-if="!user.videoReady" class="absolute inset-0 z-10 flex items-center justify-center bg-slate-900">
              <span class="text-sm font-medium text-slate-400">{{ user.name }}</span>
            </div>

            <div class="absolute bottom-3 left-3 z-20 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-lg text-xs font-medium text-white">
              {{ user.name }}
            </div>
          </div>
        </div>
      </div>

      <!-- Right Sidebar: Participants List -->
      <div class="w-72 bg-slate-800/90 border border-slate-700/50 rounded-2xl flex flex-col overflow-hidden shrink-0">
        <div class="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800">
          <h2 class="text-white font-bold text-sm">Participants</h2>
          <span class="bg-slate-700 text-slate-200 text-xs px-2 py-0.5 rounded-full font-semibold">
            {{ participants.length }}
          </span>
        </div>

        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <div
            v-for="participant in participants"
            :key="participant.id || participant.uid"
            class="p-2.5 bg-slate-700/50 hover:bg-slate-700 rounded-xl text-white text-xs flex justify-between items-center transition"
          >
            <div class="flex items-center space-x-2 truncate">
              <span>{{ participant.role === 'teacher' ? '👨‍🏫' : '👨‍🎓' }}</span>
              <span class="truncate font-medium">{{ participant.name || `User ${participant.id || participant.uid}` }}</span>
            </div>
            <span v-if="participant.role === 'teacher'" class="text-amber-400 font-bold text-[10px] uppercase bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 shrink-0">
              Teacher
            </span>
          </div>
        </div>
      </div>

    </main>

    <!-- Bottom Controls Bar -->
    <footer class="flex items-center justify-center space-x-4 px-6 py-4 bg-slate-800/90 border-t border-slate-700/50 z-10">
      <button 
        @click="toggleAudio" 
        :class="[
          'p-3.5 rounded-full transition-all duration-200 shadow-md cursor-pointer',
          audioEnabled ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'
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
        :class="[
          'p-3.5 rounded-full transition-all duration-200 shadow-md cursor-pointer',
          isScreenSharing ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500' :
          videoEnabled ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'
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
        @click="toggleScreenShare" 
        :class="[
          'p-3.5 rounded-full transition-all duration-200 shadow-md cursor-pointer',
          isScreenSharing ? 'bg-indigo-600 text-white hover:bg-indigo-700 ring-4 ring-indigo-500/30' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
        ]"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>

      <button 
        @click="toggleHand" 
        :class="[
          'p-3.5 rounded-full transition-all duration-200 shadow-md cursor-pointer',
          isHandRaised ? 'bg-amber-500 text-slate-950 hover:bg-amber-600' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
        ]"
      >
        <span class="text-lg leading-none">✋</span>
      </button>

      <button 
        @click="leaveLiveClass" 
        class="px-5 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-red-600/30 flex items-center space-x-2 ml-4 cursor-pointer"
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
import { liveClassService } from '../../services/liveClassService';
import { authService } from '../../services/authService';

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
const userAvatar = ref(currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250');

const liveClass = ref({});
const participants = ref([]);
const classActive = ref(false);

let agoraEngine = null;
let localAudioTrack = null;
let localVideoTrack = null;
let screenTrack = null;

const remoteUsers = ref([]);
const isConnected = ref(false);
const connectionStatus = ref('');

const audioEnabled = ref(true);
const videoEnabled = ref(true);
const isScreenSharing = ref(false);
const isHandRaised = ref(false);
const linkCopied = ref(false);
const currentTime = ref('');

let timerId;

const updateClock = () => {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

onMounted(async () => {
  updateClock();
  timerId = setInterval(updateClock, 1000);

  if (!targetClassId.value) {
    connectionStatus.value = 'Error: No class ID';
    return;
  }

  try {
    connectionStatus.value = 'Loading class details...';

    // 1. Get Live Class Details
    const classRes = await liveClassService.getLiveClassDetails(targetClassId.value);
    const classData = classRes.data?.liveClass || classRes.data || classRes;
    
    liveClass.value = classData;
    participants.value = classData.participants || [];
    classActive.value = classData.status === 'active';

    connectionStatus.value = 'Fetching Agora token...';

    // 2. Fetch Agora Token
    const tokenRes = await liveClassService.getAgoraToken(targetClassId.value);
    const tokenData = tokenRes.data || tokenRes;

    const appId = tokenData.appId || tokenData.app_id;
    const token = tokenData.token;
    const channel = tokenData.channel || tokenData.channel_name;
    const serverUid = tokenData.uid; // 👈 CRITICAL: Backend-generated numeric UID

    if (!appId || !token || !channel || serverUid === undefined) {
      throw new Error('Incomplete Agora credentials returned from backend');
    }

    if (!participants.value.some(p => p.id === currentUser?.id)) {
      participants.value.push({
        id: currentUser?.id || serverUid,
        name: userName.value,
        role: currentUser?.role || 'student'
      });
    }

    // 3. Initialize Agora Engine with server-provided UID
    await initializeAgora(appId, channel, token, serverUid);

  } catch (err) {
    console.error('Failed to initialize live stream:', err);
    connectionStatus.value = `Error: ${err.message}`;
  }
});

const initializeAgora = async (appId, channel, token, numericUid) => {
  try {
    connectionStatus.value = 'Creating Agora client...';
    agoraEngine = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    agoraEngine.on('user-published', handleUserPublished);
    agoraEngine.on('user-unpublished', handleUserUnpublished);

    connectionStatus.value = 'Requesting camera access...';
    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    localVideoTrack = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: { width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    connectionStatus.value = 'Joining channel...';
    // Pass numericUid to match token signature
    await agoraEngine.join(appId, channel, token, numericUid);

    connectionStatus.value = 'Publishing media...';
    await agoraEngine.publish([localAudioTrack, localVideoTrack]);

    isConnected.value = true;
    connectionStatus.value = 'Playing video...';

    // Allow DOM grid to render #local-player
    await nextTick();
    
    if (localVideoTrack) {
      localVideoTrack.play('local-player', { fit: 'cover' });
    }

  } catch (err) {
    console.error('❌ Agora engine error:', err);
    connectionStatus.value = `Error: ${err.message}`;
  }
};

const handleUserPublished = async (user, mediaType) => {
  await agoraEngine.subscribe(user, mediaType);

  if (mediaType === 'video') {
    if (!remoteUsers.value.some(u => u.uid === user.uid)) {
      remoteUsers.value.push({
        uid: user.uid,
        name: `User ${user.uid}`,
        videoReady: false
      });
    }

    await nextTick();
    await user.videoTrack.play(`remote-player-${user.uid}`, { fit: 'cover' });

    const index = remoteUsers.value.findIndex(u => u.uid === user.uid);
    if (index !== -1) {
      remoteUsers.value[index].videoReady = true;
    }
  }

  if (mediaType === 'audio') {
    await user.audioTrack.play();
  }
};

const handleUserUnpublished = (user, mediaType) => {
  if (mediaType === 'video') {
    remoteUsers.value = remoteUsers.value.filter(u => u.uid !== user.uid);
  }
};

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
      trackToPublish.play('local-player', { fit: 'cover' });

      isScreenSharing.value = true;
      trackToPublish.on('track-ended', handleStopScreenShare);
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

const toggleHand = () => {
  isHandRaised.value = !isHandRaised.value;
};

const copyMeetingLink = () => {
  navigator.clipboard.writeText(window.location.href);
  linkCopied.value = true;
  setTimeout(() => (linkCopied.value = false), 2500);
};

const toggleClassStatus = async () => {
  try {
    if (classActive.value) {
      await liveClassService.endLiveClass(targetClassId.value);
      classActive.value = false;
    } else {
      await liveClassService.startLiveClass(targetClassId.value);
      classActive.value = true;
    }
  } catch (err) {
    console.error('Failed to toggle class status:', err);
  }
};

const leaveLiveClass = async () => {
  try {
    if (screenTrack) {
      const track = Array.isArray(screenTrack) ? screenTrack[0] : screenTrack;
      track.close();
    }
    if (localAudioTrack) localAudioTrack.close();
    if (localVideoTrack) localVideoTrack.close();
    if (agoraEngine) await agoraEngine.leave();

    if (targetClassId.value) {
      await liveClassService.leaveLiveClass(targetClassId.value);
    }
  } catch (err) {
    console.error('Error while leaving class:', err);
  } finally {
    emit('left-class');
    if (window.history.length > 1) {
      router.push('/dashboard');
    } else {
      window.close();
    }
  }
};

onBeforeUnmount(() => {
  clearInterval(timerId);
  leaveLiveClass();
});
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
</style>
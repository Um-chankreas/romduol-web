<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import AgoraRTC from 'agora-rtc-sdk-ng';

const route = useRoute();

// Credentials
const appId = '90f0e5a8c82643fcb78693895d820267';
const token = '007eJxTYPDID18csCDln4yu0Z39XbXdple/PHynforF4EjwrSm2GskKDJYGaQappokWyRZGZibGaclJ5hZmlsYWlqYpFkYGRmbmRoodWQ2BjAx3xMOZGRkgEMQXZSjKT8kvzdHNySxL1U3OSSwu1k1JLWNgAAB78CS2';
const channelName = route.params.channelName || 'rodoul-live-class-dev';
const classTitle = route.query.title || 'Live Classroom';

const userName = 'Dr. Sarah Jenkins';
const uid = Math.floor(Math.random() * 10000);

const isConnected = ref(false);
const audioEnabled = ref(true);
const videoEnabled = ref(true);
const error = ref(null);

let agoraEngine = null;
let localAudioTrack = null;
let localVideoTrack = null;
const remoteUsers = ref([]);

const joinChannel = async () => {
  try {
    error.value = null;

    agoraEngine = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp9' });
    
    agoraEngine.on('user-published', async (user, mediaType) => {
      await agoraEngine.subscribe(user, mediaType);
      if (mediaType === 'video') {
        if (!remoteUsers.value.find(u => u.uid === user.uid)) {
          remoteUsers.value.push({ uid: user.uid, name: `Student ${user.uid}`, videoTrack: user.videoTrack });
        }
        setTimeout(() => user.videoTrack.play(`remote-player-${user.uid}`), 100);
      }
      if (mediaType === 'audio') user.audioTrack.play();
    });

    agoraEngine.on('user-left', (user) => {
      remoteUsers.value = remoteUsers.value.filter(u => u.uid !== user.uid);
    });

    await agoraEngine.join(appId, channelName, token || null, uid);

    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    localVideoTrack = await AgoraRTC.createCameraVideoTrack();

    await localVideoTrack.play(`local-player-${uid}`);
    await agoraEngine.publish([localAudioTrack, localVideoTrack]);

    isConnected.value = true;
  } catch (err) {
    error.value = `Failed to connect: ${err.message}`;
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

const leaveChannel = async () => {
  if (localAudioTrack) await localAudioTrack.close();
  if (localVideoTrack) await localVideoTrack.close();
  if (agoraEngine) await agoraEngine.leave();
  window.close();
};

onMounted(() => {
  joinChannel();
});

onBeforeUnmount(() => {
  leaveChannel();
});
</script>

<template>
  <div class="relative w-screen h-screen bg-slate-950 text-white font-sans overflow-hidden flex flex-col justify-between p-4 sm:p-6 select-none">
    
    <!-- TOP BAR -->
    <header class="flex justify-between items-center z-10">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-[#034d31] text-amber-300 font-bold flex items-center justify-center text-lg shadow-md">
          🎓
        </div>
        <div>
          <h1 class="text-sm font-bold text-slate-100 tracking-wide">{{ classTitle }}</h1>
          <p class="text-xs text-slate-400 font-mono">{{ channelName }}</p>
        </div>
      </div>

      <div 
        class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border transition-all duration-300"
        :class="isConnected 
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'"
      >
        <span class="w-2 h-2 rounded-full animate-pulse" :class="isConnected ? 'bg-emerald-400' : 'bg-amber-400'"></span>
        {{ isConnected ? 'Live Connected' : 'Connecting...' }}
      </div>
    </header>

    <!-- STAGE AREA -->
    <main class="relative flex-1 w-full my-4 rounded-3xl bg-slate-900 border border-slate-800/80 overflow-hidden flex items-center justify-center">
      <div v-if="isConnected" class="w-full h-full grid gap-4 p-4" :class="remoteUsers.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'">
        <!-- Local User Tile -->
        <div class="relative w-full h-full min-h-[300px] rounded-2xl bg-slate-950 overflow-hidden border border-emerald-500/40 shadow-inner">
          <div :id="`local-player-${uid}`" class="w-full h-full object-cover"></div>
          
          <div v-if="!videoEnabled" class="absolute inset-0 flex items-center justify-center bg-emerald-950/40">
            <div class="w-20 h-20 rounded-full bg-[#034d31] text-amber-300 text-2xl font-bold flex items-center justify-center ring-4 ring-emerald-500/30">
              {{ userName.charAt(0) }}
            </div>
          </div>

          <div class="absolute bottom-3 left-3 bg-slate-950/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-2">
            <span>{{ userName }} (You)</span>
            <span v-if="!audioEnabled" class="text-rose-400 text-xs">🔇</span>
          </div>
        </div>

        <!-- Remote Users Tiles -->
        <div v-for="user in remoteUsers" :key="user.uid" class="relative w-full h-full min-h-[300px] rounded-2xl bg-slate-950 overflow-hidden border border-slate-800 shadow-inner">
          <div :id="`remote-player-${user.uid}`" class="w-full h-full object-cover"></div>
          <div class="absolute bottom-3 left-3 bg-slate-950/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-slate-200">
            {{ user.name || `Participant ${user.uid}` }}
          </div>
        </div>
      </div>

      <div v-else class="text-center space-y-4">
        <div class="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-sm font-semibold text-slate-300">Connecting to Agora RTC...</p>
      </div>
    </main>

    <!-- FLOATING CONTROLS -->
    <footer v-if="isConnected" class="relative z-30 flex items-center justify-between w-full max-w-md mx-auto bg-slate-900/90 border border-slate-800/90 backdrop-blur-xl px-6 py-3 rounded-full shadow-2xl">
      <button @click="toggleAudio" class="p-3.5 rounded-full transition cursor-pointer" :class="audioEnabled ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-rose-600 text-white'">
        <span>{{ audioEnabled ? '🎙️' : '🔇' }}</span>
      </button>

      <button @click="toggleVideo" class="p-3.5 rounded-full transition cursor-pointer" :class="videoEnabled ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-rose-600 text-white'">
        <span>{{ videoEnabled ? '📹' : '🙈' }}</span>
      </button>

      <button @click="leaveChannel" class="px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition cursor-pointer">
        <span>📞</span> End Class
      </button>
    </footer>

    <!-- Error Banner -->
    <div v-if="error" class="fixed top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl bg-rose-600 text-white font-bold text-xs shadow-2xl flex items-center gap-3">
      <span>❌ {{ error }}</span>
      <button @click="leaveChannel" class="px-2 py-1 rounded-lg bg-white/20 text-white text-[10px]">Close</button>
    </div>
  </div>
</template>
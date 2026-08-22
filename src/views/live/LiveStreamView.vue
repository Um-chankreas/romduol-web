<template>
  <div class="relative w-screen h-screen bg-slate-950 text-white font-sans overflow-hidden flex flex-col justify-between p-4 sm:p-6 select-none">
    
    <!-- TOP BAR: Meeting Code & Connection Status -->
    <header class="flex justify-between items-center z-10">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-[#034d31] text-amber-300 font-bold flex items-center justify-center text-lg shadow-md">
          🎓
        </div>
        <div>
          <h1 class="text-sm font-bold text-slate-100 tracking-wide">Live Classroom</h1>
          <p class="text-xs text-slate-400 font-mono">{{ channelName }}</p>
        </div>
      </div>

      <!-- Status Badge -->
      <div 
        class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border transition-all duration-300"
        :class="isConnected 
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'"
      >
        <span class="w-2 h-2 rounded-full animate-pulse" :class="isConnected ? 'bg-emerald-400' : 'bg-rose-400'"></span>
        {{ isConnected ? 'Live Connected' : 'Disconnected' }}
      </div>
    </header>

    <!-- JOIN SETUP CARD (Shown before connecting) -->
    <div v-if="!isConnected" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-5">
        <div class="text-center space-y-1">
          <h2 class="text-xl font-extrabold text-white">Join Live Stream</h2>
          <p class="text-xs text-slate-400">Configure your session parameters to start teaching.</p>
        </div>

        <form @submit.prevent="joinChannel" class="space-y-4">
          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-300">Channel Name</label>
            <input 
              v-model="channelName" 
              type="text" 
              placeholder="e.g. calculus-room-1"
              class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-300">Your Display Name</label>
            <input 
              v-model="userName" 
              type="text" 
              placeholder="e.g. Dr. Sarah Jenkins"
              class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-300">Agora App ID</label>
            <input 
              v-model="appId" 
              type="text" 
              class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-300">Token (Optional)</label>
            <input 
              v-model="token" 
              type="password" 
              placeholder="Temporary dev token"
              class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <!-- Error Alert -->
          <div v-if="error" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium">
            ⚠️ {{ error }}
          </div>

          <button 
            type="submit" 
            class="w-full py-3 rounded-xl bg-[#034d31] hover:bg-[#023824] text-white text-sm font-bold shadow-lg transition duration-200 cursor-pointer"
          >
            Start Classroom Session →
          </button>
        </form>
      </div>
    </div>

    <!-- MAIN STAGE / VIDEO VIEW (Google Meet Screen Style) -->
    <main class="relative flex-1 w-full my-4 rounded-3xl bg-slate-900 border border-slate-800/80 overflow-hidden flex items-center justify-center">
      
      <!-- Video Grid Container -->
      <div v-if="isConnected" class="w-full h-full grid gap-4 p-4" :class="remoteUsers.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'">
        
        <!-- Local User Tile -->
        <div class="relative w-full h-full min-h-[300px] rounded-2xl bg-slate-950 overflow-hidden border border-emerald-500/40 shadow-inner group">
          <div :id="`local-player-${uid}`" class="w-full h-full object-cover"></div>
          
          <!-- Fallback Avatar when camera is off -->
          <div v-if="!videoEnabled" class="absolute inset-0 flex items-center justify-center bg-emerald-950/40">
            <div class="w-20 h-20 rounded-full bg-[#034d31] text-amber-300 text-2xl font-bold flex items-center justify-center ring-4 ring-emerald-500/30">
              {{ userName.charAt(0) }}
            </div>
          </div>

          <!-- Bottom-Left Name Overlay (Google Meet Style) -->
          <div class="absolute bottom-3 left-3 bg-slate-950/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-2">
            <span>{{ userName }} (You)</span>
            <span v-if="!audioEnabled" class="text-rose-400 text-xs">🔇</span>
          </div>
        </div>

        <!-- Remote Users Tiles -->
        <div 
          v-for="user in remoteUsers" 
          :key="user.uid" 
          class="relative w-full h-full min-h-[300px] rounded-2xl bg-slate-950 overflow-hidden border border-slate-800 shadow-inner"
        >
          <div :id="`remote-player-${user.uid}`" class="w-full h-full object-cover"></div>

          <!-- Remote Overlay -->
          <div class="absolute bottom-3 left-3 bg-slate-950/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-slate-200">
            {{ user.name || `Participant ${user.uid}` }}
          </div>
        </div>
      </div>

      <!-- Idle Stage Background (Before Connect) -->
      <div v-else class="text-center space-y-3">
        <div class="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-4xl mx-auto text-slate-600">
          📹
        </div>
        <p class="text-sm font-medium text-slate-400">Classroom camera stage is inactive</p>
      </div>

      <!-- Bottom-Left Google Meet Style Safety Badge -->
      <div class="absolute bottom-4 left-4 z-20 hidden sm:flex items-center gap-3 bg-slate-900/90 border border-slate-700/80 px-4 py-2.5 rounded-2xl backdrop-blur-md text-xs max-w-sm">
        <span class="text-base">🛡️</span>
        <div>
          <p class="font-bold text-slate-200 leading-none">Encrypted Classroom</p>
          <p class="text-[11px] text-slate-400 mt-0.5">Stream is direct end-to-end RTC.</p>
        </div>
      </div>
    </main>

    <!-- FLOATING CONTROL TOOLBAR (Google Meet Bottom Dock) -->
    <footer v-if="isConnected" class="relative z-30 flex items-center justify-between w-full max-w-2xl mx-auto bg-slate-900/90 border border-slate-800/90 backdrop-blur-xl px-6 py-3 rounded-full shadow-2xl">
      
      <!-- Audio Toggle -->
      <button 
        @click="toggleAudio"
        :title="audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'"
        class="p-3.5 rounded-full transition cursor-pointer"
        :class="audioEnabled 
          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' 
          : 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30'"
      >
        <span class="text-base block leading-none">{{ audioEnabled ? '🎙️' : '🔇' }}</span>
      </button>

      <!-- Video Toggle -->
      <button 
        @click="toggleVideo"
        :title="videoEnabled ? 'Stop Camera' : 'Start Camera'"
        class="p-3.5 rounded-full transition cursor-pointer"
        :class="videoEnabled 
          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' 
          : 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30'"
      >
        <span class="text-base block leading-none">{{ videoEnabled ? '📹' : '🙈' }}</span>
      </button>

      <!-- Leave Call Button (Red End Call Icon) -->
      <button 
        @click="leaveChannel"
        title="Leave Meeting"
        class="px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition cursor-pointer"
      >
        <span>📞</span> Leave
      </button>
    </footer>

  </div>
</template>

<script>
import AgoraRTC from 'agora-rtc-sdk-ng';

export default {
  name: 'AgoraLiveStream',
  props: {
    // Optional props passed from Dashboard view
    initialChannel: {
      type: String,
      default: 'romduol-calculus-class'
    }
  },
  data() {
    return {
      appId: '90f0e5a8c82643fcb78693895d820267',
      token: '007eJxTYPDID18csCDln4yu0Z39XbXdple/PHynforF4EjwrSm2GskKDJYGaQappokWyRZGZibGaclJ5hZmlsYWlqYpFkYGRmbmRoodWQ2BjAx3xMOZGRkgEMQXZSjKT8kvzdHNySxL1U3OSSwu1k1JLWNgAAB78CS2',
      channelName: this.initialChannel || 'romduol-calculus-class',
      userName: 'Dr. Sarah Jenkins',
      uid: Math.floor(Math.random() * 10000),
      
      isConnected: false,
      audioEnabled: true,
      videoEnabled: true,
      error: null,
      
      agoraEngine: null,
      localAudioTrack: null,
      localVideoTrack: null,
      
      remoteUsers: []
    }
  },
  methods: {
    async joinChannel() {
      try {
        this.error = null;
        if (!this.appId || !this.channelName) {
          this.error = 'App ID and Channel Name are required.';
          return;
        }

        this.agoraEngine = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp9' });
        this.agoraEngine.on('user-published', this.handleUserPublished);
        this.agoraEngine.on('user-unpublished', this.handleUserUnpublished);
        this.agoraEngine.on('user-left', this.handleUserLeft);

        await this.agoraEngine.join(this.appId, this.channelName, this.token || null, this.uid);

        this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        this.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

        await this.localVideoTrack.play(`local-player-${this.uid}`);
        await this.agoraEngine.publish([this.localAudioTrack, this.localVideoTrack]);

        this.isConnected = true;
      } catch (err) {
        this.error = `Failed to join: ${err.message}`;
      }
    },
    async handleUserPublished(user, mediaType) {
      try {
        await this.agoraEngine.subscribe(user, mediaType);
        if (mediaType === 'video') {
          if (!this.remoteUsers.find(u => u.uid === user.uid)) {
            this.remoteUsers.push({ uid: user.uid, name: `Student ${user.uid}`, videoTrack: user.videoTrack });
          }
          setTimeout(() => user.videoTrack.play(`remote-player-${user.uid}`), 100);
        }
        if (mediaType === 'audio') user.audioTrack.play();
      } catch (err) {
        console.error('Subscribe error:', err);
      }
    },
    async handleUserUnpublished(user, mediaType) {
      console.log(`User ${user.uid} unpublished ${mediaType}`);
    },
    async handleUserLeft(user) {
      this.remoteUsers = this.remoteUsers.filter(u => u.uid !== user.uid);
    },
    async toggleAudio() {
      if (this.localAudioTrack) {
        this.audioEnabled = !this.audioEnabled;
        await this.localAudioTrack.setEnabled(this.audioEnabled);
      }
    },
    async toggleVideo() {
      if (this.localVideoTrack) {
        this.videoEnabled = !this.videoEnabled;
        await this.localVideoTrack.setEnabled(this.videoEnabled);
      }
    },
    async leaveChannel() {
      try {
        if (this.localAudioTrack) await this.localAudioTrack.close();
        if (this.localVideoTrack) await this.localVideoTrack.close();
        if (this.agoraEngine) await this.agoraEngine.leave();

        this.remoteUsers = [];
        this.isConnected = false;
        this.audioEnabled = true;
        this.videoEnabled = true;
        
        // Emit back to dashboard
        this.$emit('back-to-dashboard');
      } catch (err) {
        this.error = `Failed to leave: ${err.message}`;
      }
    }
  },
  beforeUnmount() {
    this.leaveChannel();
  }
}
</script>
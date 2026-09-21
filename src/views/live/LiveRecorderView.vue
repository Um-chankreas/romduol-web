<template>
  <!-- Chrome-free 16:9 view meant to be captured by OBS (Browser Source 1920x1080). -->
  <div class="h-dvh w-full bg-black text-slate-100 overflow-hidden font-sans relative">
    <div v-if="error" class="absolute inset-0 flex items-center justify-center p-6 text-center text-red-400 text-lg">
      {{ error }}
    </div>

    <div v-else-if="!connected" class="absolute inset-0 flex items-center justify-center text-slate-400">
      {{ status }}
    </div>

    <template v-else>
      <div
        class="w-full h-full grid gap-2 p-2"
        :class="users.length <= 1 ? 'grid-cols-1' : users.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'"
      >
        <div
          v-for="u in users"
          :key="u.uid"
          class="relative bg-slate-950 rounded-xl overflow-hidden"
        >
          <div :id="`rec-player-${u.uid}`" class="w-full h-full"></div>
          <div v-if="!u.hasVideo" class="absolute inset-0 flex items-center justify-center bg-slate-900">
            <img :src="brandLogo" alt="" class="h-24 w-24 object-contain opacity-70" />
          </div>
        </div>
      </div>

      <div
        v-if="!users.length"
        class="absolute inset-0 flex items-center justify-center text-slate-500 text-xl pointer-events-none"
      >
        Waiting for the teacher's stream…
      </div>

      <img :src="brandLogo" alt="" class="absolute bottom-4 right-4 h-12 w-12 object-contain opacity-50 pointer-events-none" />
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { API_BASE_URL } from '../../services/axios';
import brandLogo from '@/assets/logo/RS_logo.png';

// Plain axios (not the shared `api` instance): OBS has no login, and the shared
// instance's 401 handler would redirect to /login.
const route = useRoute();
const key = route.query.key;

const status = ref('Connecting…');
const error = ref('');
const connected = ref(false);
const users = ref([]); // [{ uid, hasVideo }]

let client = null;
let renewTimer = null;

const upsert = (uid, patch) => {
  const i = users.value.findIndex(u => u.uid === uid);
  if (i === -1) users.value.push({ uid, hasVideo: false, ...patch });
  else users.value[i] = { ...users.value[i], ...patch };
};

async function fetchToken() {
  const res = await axios.post(`${API_BASE_URL}/live-classes/${route.params.id}/recorder-token`, { key });
  return res.data.data;
}

onMounted(async () => {
  if (!key) {
    error.value = 'Missing recorder key. Copy the recorder link from the live class controls.';
    return;
  }
  try {
    const d = await fetchToken();
    // Match the mobile app's LiveBroadcasting profile; this view only watches.
    client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8', role: 'audience' });

    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'video') {
        upsert(user.uid, { hasVideo: true });
        await nextTick();
        user.videoTrack.play(`rec-player-${user.uid}`, { fit: 'contain' });
      } else {
        upsert(user.uid, {});
        user.audioTrack.play();
      }
    });
    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video') upsert(user.uid, { hasVideo: false });
    });
    // A native app muting / disabling its camera doesn't always unpublish it.
    client.on('user-info-updated', (uid, msg) => {
      if (msg === 'mute-video' || msg === 'disable-local-video') upsert(uid, { hasVideo: false });
    });
    client.on('user-left', (user) => {
      users.value = users.value.filter(u => u.uid !== user.uid);
    });
    client.on('token-privilege-will-expire', async () => {
      try { await client.renewToken((await fetchToken()).token); } catch (_) { /* noop */ }
    });

    await client.join(d.appId, d.channel, d.token, d.uid);
    connected.value = true;
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Failed to connect';
  }
});

onBeforeUnmount(() => {
  clearTimeout(renewTimer);
  client?.leave().catch(() => {});
});
</script>

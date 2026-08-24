<template>
  <div
    class="flex flex-col h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans"
  >

    <!-- HEADER -->
    <header
      class="flex items-center justify-between px-6 py-4 bg-slate-800/80 backdrop-blur border-b border-slate-700/50 z-10"
    >
      <div class="flex items-center space-x-3">

        <div
          class="flex items-center space-x-2"
        >
          <span
            class="relative flex h-3 w-3"
          >
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"
            ></span>

            <span
              class="relative inline-flex rounded-full h-3 w-3 bg-red-500"
            ></span>
          </span>

          <span
            class="text-xs font-semibold uppercase tracking-wider text-red-400"
          >
            Live
          </span>
        </div>

        <h1
          class="text-lg font-bold text-white truncate max-w-md"
        >
          {{ liveClassTitle || 'Live Streaming Room' }}
        </h1>
      </div>

      <div
        class="flex items-center space-x-4"
      >
        <span
          class="text-sm font-medium text-slate-400"
        >
          {{ currentTime }}
        </span>

        <button
          @click="copyMeetingLink"
          class="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition"
        >
          <span>
            {{
              linkCopied
                ? 'Link Copied!'
                : 'Copy Stream Link'
            }}
          </span>
        </button>

        <button
          v-if="isTeacher"
          @click="handleEndClass"
          :disabled="endingClass"
          class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-50"
        >
          {{
            endingClass
              ? 'Ending...'
              : 'End Class'
          }}
        </button>
      </div>
    </header>

    <!-- MAIN -->
    <main
      class="flex-1 relative p-4 overflow-hidden flex items-center justify-center"
    >

      <!-- Screen share banner -->
      <div
        v-if="isScreenSharing"
        class="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-indigo-600/90 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg border border-indigo-400/30 backdrop-blur flex items-center space-x-2"
      >
        <span
          class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
        ></span>

        <span>
          You are sharing your screen
        </span>
      </div>

      <!-- Error -->
      <div
        v-if="connectionError"
        class="absolute top-6 left-1/2 -translate-x-1/2 z-30 bg-red-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm"
      >
        {{ connectionError }}
      </div>

      <!-- Connecting -->
      <div
        v-if="!isConnected"
        class="flex flex-col items-center justify-center space-y-4 text-slate-400"
      >
        <div
          class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"
        ></div>

        <p class="text-sm">
          Connecting to live session...
        </p>
      </div>

      <!-- VIDEO GRID -->
      <div
        v-else
        class="w-full h-full grid gap-4 transition-all duration-300"
        :class="[
          remoteUsers.length === 0
            ? 'grid-cols-1'
            : '',

          remoteUsers.length === 1
            ? 'grid-cols-1 md:grid-cols-2'
            : '',

          remoteUsers.length >= 2
            ? 'grid-cols-2 lg:grid-cols-3'
            : ''
        ]"
      >

        <!-- LOCAL -->
        <div
          class="relative w-full h-full min-h-[300px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl group"
        >
          <div
            :id="`local-player-${uid}`"
            class="w-full h-full"
          ></div>

          <!-- Video off -->
          <div
            v-if="
              !videoEnabled &&
              !isScreenSharing
            "
            class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900"
          >
            <img
              :src="userAvatar"
              :alt="userName"
              class="w-20 h-20 rounded-full border-2 border-indigo-500 shadow-lg mb-2"
            />

            <span
              class="text-sm font-medium text-slate-300"
            >
              {{ userName }} (You)
            </span>
          </div>

          <!-- Label -->
          <div
            class="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-lg text-xs font-medium text-white flex items-center space-x-2"
          >
            <span>
              {{ userName }} (You)
            </span>

            <span
              v-if="isScreenSharing"
              class="text-indigo-400 font-semibold"
            >
              • Screen
            </span>

            <span
              v-if="!audioEnabled"
              class="text-red-400"
            >
              Muted
            </span>
          </div>

          <!-- Hand -->
          <div
            v-if="isHandRaised"
            class="absolute top-3 right-3 bg-amber-500 text-slate-950 px-2.5 py-1 rounded-full text-xs font-bold shadow-md"
          >
            ✋ Raised Hand
          </div>
        </div>

        <!-- REMOTE -->
        <div
          v-for="user in remoteUsers"
          :key="user.uid"
          class="relative w-full h-full min-h-[300px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl"
        >
          <div
            :id="`remote-player-${user.uid}`"
            class="w-full h-full"
          ></div>

          <div
            class="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-lg text-xs font-medium text-white"
          >
            User #{{ user.uid }}
          </div>
        </div>

      </div>
    </main>

    <!-- CONTROLS -->
    <footer
      class="flex items-center justify-center space-x-4 px-6 py-4 bg-slate-800/90 border-t border-slate-700/50 z-10"
    >

      <!-- MIC -->
      <button
        @click="toggleAudio"
        :class="[
          'p-3.5 rounded-full transition-all duration-200 shadow-md',
          audioEnabled
            ? 'bg-slate-700 text-slate-100 hover:bg-slate-600'
            : 'bg-red-500 text-white hover:bg-red-600'
        ]"
        :title="
          audioEnabled
            ? 'Mute Microphone'
            : 'Unmute Microphone'
        "
      >
        <span class="text-lg">
          {{ audioEnabled ? '🎤' : '🔇' }}
        </span>
      </button>

      <!-- CAMERA -->
      <button
        @click="toggleVideo"
        :disabled="isScreenSharing"
        :class="[
          'p-3.5 rounded-full transition-all duration-200 shadow-md',
          isScreenSharing
            ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
            : videoEnabled
              ? 'bg-slate-700 text-slate-100 hover:bg-slate-600'
              : 'bg-red-500 text-white hover:bg-red-600'
        ]"
      >
        <span class="text-lg">
          {{ videoEnabled ? '📹' : '🚫' }}
        </span>
      </button>

      <!-- SCREEN -->
      <button
        @click="toggleScreenShare"
        :class="[
          'p-3.5 rounded-full transition-all duration-200 shadow-md',
          isScreenSharing
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 ring-4 ring-indigo-500/30'
            : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
        ]"
      >
        <span class="text-lg">
          🖥️
        </span>
      </button>

      <!-- HAND -->
      <button
        @click="toggleHand"
        :class="[
          'p-3.5 rounded-full transition-all duration-200 shadow-md',
          isHandRaised
            ? 'bg-amber-500 text-slate-950 hover:bg-amber-600'
            : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
        ]"
      >
        <span class="text-lg">
          ✋
        </span>
      </button>

      <!-- LEAVE -->
      <button
        @click="leaveChannel"
        class="px-5 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-red-600/30 flex items-center space-x-2 ml-4"
      >
        <span>
          Leave Call
        </span>
      </button>

    </footer>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from 'vue';

import {
  useRoute,
  useRouter,
} from 'vue-router';

import AgoraRTC from 'agora-rtc-sdk-ng';

import { useLiveClassStore } from '@/stores/liveClass';

const route = useRoute();
const router = useRouter();

const liveClassStore =
  useLiveClassStore();

/* --------------------------------
 * CLASS
 * -------------------------------- */

const classId = computed(
  () => route.params.id
);

const appId = ref('');
const token = ref('');
const channelName = ref('');
const liveClassTitle = ref('');

/* --------------------------------
 * USER
 * -------------------------------- */

const userName = 'You';

const userAvatar =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250';

/*
 * IMPORTANT:
 * This UID is sent to backend when
 * requesting the Agora token.
 */
const uid = ref(
  Math.floor(
    Math.random() * 900000
  ) + 100000
);

/* --------------------------------
 * UI STATE
 * -------------------------------- */

const isConnected = ref(false);

const audioEnabled = ref(true);
const videoEnabled = ref(true);

const isScreenSharing =
  ref(false);

const isHandRaised =
  ref(false);

const linkCopied =
  ref(false);

const currentTime =
  ref('');

const connectionError =
  ref('');

const endingClass =
  ref(false);

/* --------------------------------
 * AGORA
 * -------------------------------- */

let agoraEngine = null;

let localAudioTrack = null;
let localVideoTrack = null;
let screenTrack = null;

const remoteUsers = ref([]);

/* --------------------------------
 * TEACHER
 * -------------------------------- */

const isTeacher = computed(() => {
  /*
   * Change this according to
   * how your auth user is stored.
   *
   * Example:
   * localStorage.getItem('role')
   */
  return localStorage.getItem('role') === 'teacher';
});

/* --------------------------------
 * CLOCK
 * -------------------------------- */

const updateClock = () => {
  const now = new Date();

  currentTime.value =
    now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
};

/* --------------------------------
 * JOIN AGORA
 * -------------------------------- */

const joinChannel = async () => {
  try {
    connectionError.value = '';

    if (!classId.value) {
      throw new Error(
        'Live class ID is missing'
      );
    }

    /*
     * 1. Ask backend for Agora token
     */
    const response =
      await liveClassStore.getAgoraCredentials(
        classId.value,
        uid.value
      );

    if (!response.success) {
      throw new Error(
        response.error ||
          'Failed to obtain Agora credentials'
      );
    }

    appId.value =
      response.data.appId;

    token.value =
      response.data.token;

    channelName.value =
      response.data.channel;

    liveClassTitle.value =
      response.data.liveClass?.title ||
      'Live Stream';

    /*
     * 2. Create Agora client
     */
    agoraEngine =
      AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8',
      });

    /*
     * 3. Remote user publishes
     */
    agoraEngine.on(
      'user-published',
      async (
        user,
        mediaType
      ) => {
        try {
          await agoraEngine.subscribe(
            user,
            mediaType
          );

          if (
            mediaType === 'video'
          ) {
            const existing =
              remoteUsers.value.find(
                (item) =>
                  item.uid === user.uid
              );

            if (!existing) {
              remoteUsers.value.push({
                uid: user.uid,
                videoTrack:
                  user.videoTrack,
              });
            } else {
              existing.videoTrack =
                user.videoTrack;
            }

            await nextTick();

            user.videoTrack.play(
              `remote-player-${user.uid}`
            );
          }

          if (
            mediaType === 'audio' &&
            user.audioTrack
          ) {
            user.audioTrack.play();
          }
        } catch (error) {
          console.error(
            'Failed to subscribe:',
            error
          );
        }
      }
    );

    /*
     * 4. Remote user leaves
     */
    agoraEngine.on(
      'user-left',
      (user) => {
        remoteUsers.value =
          remoteUsers.value.filter(
            (item) =>
              item.uid !== user.uid
          );
      }
    );

    /*
     * 5. Join Agora channel
     */
    await agoraEngine.join(
      appId.value,
      channelName.value,
      token.value,
      uid.value
    );

    /*
     * 6. Create microphone
     */
    localAudioTrack =
      await AgoraRTC.createMicrophoneAudioTrack();

    /*
     * 7. Create camera
     */
    localVideoTrack =
      await AgoraRTC.createCameraVideoTrack();

    /*
     * 8. Publish
     */
    await agoraEngine.publish([
      localAudioTrack,
      localVideoTrack,
    ]);

    isConnected.value = true;

    /*
     * 9. Play local video
     */
    await nextTick();

    localVideoTrack.play(
      `local-player-${uid.value}`
    );

  } catch (error) {
    console.error(
      'Agora connection error:',
      error
    );

    connectionError.value =
      error.response?.data?.error ||
      error.message ||
      'Failed to connect to live class';
  }
};

/* --------------------------------
 * AUDIO
 * -------------------------------- */

const toggleAudio = async () => {
  if (!localAudioTrack) {
    return;
  }

  audioEnabled.value =
    !audioEnabled.value;

  await localAudioTrack.setEnabled(
    audioEnabled.value
  );
};

/* --------------------------------
 * VIDEO
 * -------------------------------- */

const toggleVideo = async () => {
  if (
    isScreenSharing.value ||
    !localVideoTrack
  ) {
    return;
  }

  videoEnabled.value =
    !videoEnabled.value;

  await localVideoTrack.setEnabled(
    videoEnabled.value
  );
};

/* --------------------------------
 * SCREEN SHARE
 * -------------------------------- */

const toggleScreenShare = async () => {
  if (!agoraEngine) {
    return;
  }

  try {
    if (!isScreenSharing.value) {

      const result =
        await AgoraRTC.createScreenVideoTrack(
          {
            encoderConfig: '1080p_1',
            optimizationMode: 'detail',
          },
          'auto'
        );

      screenTrack = Array.isArray(result)
        ? result[0]
        : result;

      await agoraEngine.unpublish(
        localVideoTrack
      );

      await agoraEngine.publish(
        screenTrack
      );

      await nextTick();

      screenTrack.play(
        `local-player-${uid.value}`
      );

      isScreenSharing.value = true;

      screenTrack.on(
        'track-ended',
        handleStopScreenShare
      );

    } else {
      await handleStopScreenShare();
    }

  } catch (error) {
    console.error(
      'Screen sharing failed:',
      error
    );
  }
};

/* --------------------------------
 * STOP SCREEN SHARE
 * -------------------------------- */

const handleStopScreenShare =
  async () => {

    if (
      !isScreenSharing.value ||
      !agoraEngine
    ) {
      return;
    }

    try {
      if (screenTrack) {
        await agoraEngine.unpublish(
          screenTrack
        );

        screenTrack.close();
        screenTrack = null;
      }

      if (localVideoTrack) {
        await agoraEngine.publish(
          localVideoTrack
        );

        await nextTick();

        if (videoEnabled.value) {
          localVideoTrack.play(
            `local-player-${uid.value}`
          );
        }
      }

      isScreenSharing.value = false;

    } catch (error) {
      console.error(
        'Failed to stop screen sharing:',
        error
      );
    }
  };

/* --------------------------------
 * HAND
 * -------------------------------- */

const toggleHand = () => {
  isHandRaised.value =
    !isHandRaised.value;
};

/* --------------------------------
 * COPY LINK
 * -------------------------------- */

const copyMeetingLink = async () => {
  try {
    await navigator.clipboard.writeText(
      window.location.href
    );

    linkCopied.value = true;

    setTimeout(() => {
      linkCopied.value = false;
    }, 2500);

  } catch (error) {
    console.error(
      'Failed to copy link:',
      error
    );
  }
};

/* --------------------------------
 * CLEANUP AGORA
 * -------------------------------- */

const leaveAgora = async () => {
  try {
    if (screenTrack) {
      screenTrack.close();
      screenTrack = null;
    }

    if (localAudioTrack) {
      localAudioTrack.close();
      localAudioTrack = null;
    }

    if (localVideoTrack) {
      localVideoTrack.close();
      localVideoTrack = null;
    }

    if (agoraEngine) {
      await agoraEngine.leave();
      agoraEngine = null;
    }

    remoteUsers.value = [];
    isConnected.value = false;

  } catch (error) {
    console.error(
      'Agora cleanup error:',
      error
    );
  }
};

/* --------------------------------
 * LEAVE
 * -------------------------------- */

const leaveChannel = async () => {
  try {
    await leaveAgora();

    if (classId.value) {
      await liveClassStore.leaveClass(
        classId.value
      );
    }

    router.push('/dashboard');

  } catch (error) {
    console.error(
      'Leave class error:',
      error
    );

    router.push('/dashboard');
  }
};

/* --------------------------------
 * END CLASS
 * -------------------------------- */

const handleEndClass = async () => {
  if (
    !classId.value ||
    endingClass.value
  ) {
    return;
  }

  const confirmed =
    window.confirm(
      'Are you sure you want to end this live class?'
    );

  if (!confirmed) {
    return;
  }

  try {
    endingClass.value = true;

    await liveClassStore.endClass(
      classId.value
    );

    await leaveAgora();

    router.push('/dashboard');

  } catch (error) {
    console.error(
      'Failed to end class:',
      error
    );

    connectionError.value =
      error.response?.data?.error ||
      error.message ||
      'Failed to end class';

  } finally {
    endingClass.value = false;
  }
};

/* --------------------------------
 * MOUNT
 * -------------------------------- */

let timerId = null;

onMounted(() => {
  updateClock();

  timerId = setInterval(
    updateClock,
    1000
  );

  joinChannel();
});

/* --------------------------------
 * UNMOUNT
 * -------------------------------- */

onBeforeUnmount(async () => {
  if (timerId) {
    clearInterval(timerId);
  }

  await leaveAgora();
});
</script>
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

    <!-- Teacher: End class confirmation + optional OBS recording upload -->
    <SaveRecordingModal
      v-if="showEndClass"
      :live-class-id="targetClassId"
      :end-class-fn="performEndClass"
      :recording-active="recState === 'recording'"
      :stop-recording-fn="finishRecording"
      @cancel="showEndClass = false"
    />

    <!-- Teacher: class ended elsewhere — just offer to save the OBS recording -->
    <SaveRecordingModal v-if="showSaveRecording" :live-class-id="targetClassId" />

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
            <span v-if="recState === 'recording'" role="status" class="text-[10px] font-semibold text-red-400 flex items-center space-x-1">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              <span>Recording</span>
              <span class="tabular-nums text-red-300">{{ recClock }}</span>
            </span>
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

        <!-- Device / screen-share warnings: overlaid (no layout shift), shrink to a pill after a few seconds -->
        <div class="absolute top-11 md:top-14 left-2 md:left-3 right-2 md:right-3 z-30 flex flex-col items-start gap-1.5 pointer-events-none [&>*]:pointer-events-auto">
          <CollapsibleNotice :message="deviceNotice" label="Camera / mic" @dismiss="deviceNotice = ''" />
          <CollapsibleNotice :message="shareWarning" label="Screen share" role="alert" @dismiss="shareWarning = ''" />
          <div
            v-if="recState === 'finishing' || recSaving"
            role="status"
            class="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-900/90 backdrop-blur px-3 py-1 text-[11px] text-slate-200 shadow-md"
          >
            <span class="inline-block h-3 w-3 rounded-full border-2 border-slate-500 border-t-transparent animate-spin"></span>
            <span v-if="recSaving">{{ recSaving.stage }}<template v-if="recSaving.stage === STAGE_UPLOAD"> {{ recSaving.progress }}%</template></span>
            <span v-else>Finishing recording…</span>
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
          <div v-if="!connectionFailed" class="w-8 h-8 md:w-10 md:h-10 border-4 border-[#016a36] border-t-transparent rounded-full animate-spin"></div>
          <p class="text-xs md:text-sm">{{ connectionFailed ? "We couldn't connect to the live session." : 'Connecting to live session...' }}</p>
          <p class="text-[10px] md:text-xs text-slate-500">{{ connectionStatus }}</p>
          <button
            v-if="connectionFailed"
            @click="reloadPage"
            class="px-4 py-2 rounded-lg bg-[#016a36] hover:bg-[#015a2d] text-white text-xs md:text-sm font-semibold cursor-pointer"
          >
            Try again
          </button>
        </div>

        <!-- Main area: the presenter (whoever is sharing, else the teacher). It fills
             the whole area; everyone else lives in the Participants panel. -->
        <div v-else class="flex-1 min-h-0">
          <!-- Us: presenting / teacher -->
          <div v-if="mainKey === 'local'" :class="mainTileClass(talkingKeys.has('local'))">
            <div id="local-player" class="relative w-full h-full bg-slate-900"></div>

            <!-- Presenting: the capture is sent to everyone but never played back
                 here — it would show this page inside itself, endlessly. -->
            <div
              v-if="isScreenSharing"
              class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900 p-4 text-center"
            >
              <div class="h-14 w-14 md:h-16 md:w-16 rounded-full bg-[#016a36]/20 ring-1 ring-[#016a36]/50 grid place-items-center text-[#34c27f]">
                <svg class="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p class="text-sm md:text-base font-semibold text-white">You're presenting</p>
                <p class="text-xs text-slate-400 mt-0.5">Everyone can see your screen</p>
              </div>
              <button
                type="button"
                @click="toggleScreenShare"
                class="px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                Stop presenting
              </button>
            </div>

            <div v-if="!localHasVideo" class="absolute inset-0 z-10 flex items-center justify-center bg-slate-900">
              <Avatar :name="userName" :src="userAvatar" size="xl" :speaking="talkingKeys.has('local')" />
            </div>

            <div class="absolute bottom-2 left-2 md:bottom-3 md:left-3 z-20 max-w-[calc(100%-1rem)] bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-medium text-white flex items-center space-x-1.5">
              <span class="truncate">{{ userName }} (You)</span>
              <span v-if="isTeacher" class="text-amber-400 font-bold shrink-0">• Teacher</span>
              <span v-if="!audioEnabled" class="text-red-400 shrink-0">🔇</span>
            </div>
          </div>

          <!-- The teacher, seen from a student -->
          <div v-else-if="mainKey !== null" :key="mainKey" :class="mainTileClass(talkingKeys.has(mainKey))">
            <div :id="`remote-player-${mainKey}`" class="relative w-full h-full bg-slate-900"></div>

            <div v-if="!mainRemote?.hasVideo || !mainRemote?.videoReady" class="absolute inset-0 z-10 flex items-center justify-center bg-slate-900">
              <Avatar :name="resolveName(mainKey)" :src="avatarByUid(mainKey)" size="xl" :speaking="talkingKeys.has(mainKey)" />
            </div>

            <div class="absolute bottom-2 left-2 md:bottom-3 md:left-3 z-20 max-w-[calc(100%-1rem)] truncate bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-medium text-white">
              {{ resolveName(mainKey) }}<span class="text-amber-400 font-bold"> • Teacher</span>
            </div>
          </div>

          <!-- Nobody presenting yet -->
          <div
            v-else
            class="w-full h-full bg-slate-950 rounded-xl md:rounded-2xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center text-slate-500 text-sm"
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

      <!-- Right Sidebar (Desktop). Sized to its rows (max = the video area), then
           the list scrolls, so a short class doesn't leave a tall empty panel. -->
      <aside class="hidden lg:flex w-44 self-start max-h-full bg-slate-800/90 border border-slate-700/50 rounded-2xl flex-col overflow-hidden shrink-0 shadow-xl">
        <ParticipantsPanel
          :rows="participantRows"
          :can-manage="isTeacher"
          @invite="invite"
          @mute="mute"
        />
      </aside>

      <!-- Bottom Sheet Drawer (Mobile) -->
      <div
        v-if="showMobileDrawer"
        class="lg:hidden fixed inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end"
        @click.self="showMobileDrawer = false"
      >
        <div class="bg-slate-800 border-t border-slate-700 rounded-t-2xl max-h-[65vh] flex flex-col overflow-hidden">
          <ParticipantsPanel
            :rows="participantRows"
            :can-manage="isTeacher"
            :show-thumbs="false"
            :columns="3"
            @invite="invite"
            @mute="mute"
          >
            <template #actions>
              <button @click="showMobileDrawer = false" class="text-slate-400 hover:text-white text-lg cursor-pointer" aria-label="Close">✕</button>
            </template>
          </ParticipantsPanel>
        </div>
      </div>

    </main>

    <!-- Bottom Controls Bar -->
    <footer class="flex items-center justify-center space-x-2 md:space-x-4 px-3 md:px-6 py-3 bg-slate-800/90 border-t border-slate-700/50 z-20 shrink-0">
      <template v-if="canPublish">
        <!-- Microphone toggle + device picker -->
        <div class="relative flex items-center gap-0.5" data-device-menu>
        <button
          @click="toggleAudio"
          :title="!micAvailable ? 'No microphone available — click to retry' : (audioEnabled ? 'Mute microphone' : 'Unmute microphone')"
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
          @click="toggleDeviceMenu('mic')"
          title="Choose microphone"
          aria-haspopup="menu"
          :aria-expanded="openMenu === 'mic'"
          :class="[
            'h-8 w-6 grid place-items-center rounded-full transition cursor-pointer',
            openMenu === 'mic' ? 'bg-slate-600 text-white' : 'text-slate-300 hover:bg-slate-700'
          ]"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <div
          v-if="openMenu === 'mic'"
          role="menu"
          class="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-72 max-w-[90vw] bg-slate-800 border border-slate-600 rounded-xl shadow-2xl py-1.5 z-50"
        >
          <p class="px-3 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Microphone</p>
          <p v-if="!microphones.length" class="px-3 py-2 text-xs text-slate-300">No microphone found</p>
          <button
            v-for="(d, i) in microphones"
            :key="d.deviceId"
            role="menuitemradio"
            :aria-checked="d.deviceId === selectedMic"
            @click="pickDevice('mic', d.deviceId)"
            :class="['w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-700 cursor-pointer', d.deviceId === selectedMic ? 'text-white font-semibold' : 'text-slate-200']"
          >
            <span class="w-4 shrink-0 text-emerald-400">{{ d.deviceId === selectedMic ? '✓' : '' }}</span>
            <span class="truncate">{{ d.label || `Microphone ${i + 1}` }}</span>
          </button>
        </div>
        </div>

        <!-- Camera toggle + device picker -->
        <div class="relative flex items-center gap-0.5" data-device-menu>
        <button
          @click="toggleVideo"
          :disabled="isScreenSharing"
          :title="isScreenSharing ? 'Camera unavailable while sharing screen' : (!cameraAvailable ? 'No camera available — click to retry' : (videoEnabled ? 'Turn camera off' : 'Turn camera on'))"
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
          @click="toggleDeviceMenu('camera')"
          :disabled="isScreenSharing"
          title="Choose camera"
          aria-haspopup="menu"
          :aria-expanded="openMenu === 'camera'"
          :class="[
            'h-8 w-6 grid place-items-center rounded-full transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            openMenu === 'camera' ? 'bg-slate-600 text-white' : 'text-slate-300 hover:bg-slate-700'
          ]"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <div
          v-if="openMenu === 'camera'"
          role="menu"
          class="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-72 max-w-[90vw] bg-slate-800 border border-slate-600 rounded-xl shadow-2xl py-1.5 z-50"
        >
          <p class="px-3 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Camera</p>
          <p v-if="!cameras.length" class="px-3 py-2 text-xs text-slate-300">No camera found</p>
          <button
            v-for="(d, i) in cameras"
            :key="d.deviceId"
            role="menuitemradio"
            :aria-checked="d.deviceId === selectedCamera"
            @click="pickDevice('camera', d.deviceId)"
            :class="['w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-700 cursor-pointer', d.deviceId === selectedCamera ? 'text-white font-semibold' : 'text-slate-200']"
          >
            <span class="w-4 shrink-0 text-emerald-400">{{ d.deviceId === selectedCamera ? '✓' : '' }}</span>
            <span class="truncate">{{ d.label || `Camera ${i + 1}` }}</span>
          </button>
        </div>
        </div>

        <div v-if="isTeacher" class="relative group hidden sm:block">
          <button
            @click="toggleScreenShare"
            :aria-label="isScreenSharing ? 'Stop sharing screen' : 'Share screen'"
            aria-describedby="share-screen-tip"
            :class="[
              'block p-2.5 md:p-3.5 rounded-full transition-all duration-200 shadow-md cursor-pointer',
              isScreenSharing ? 'bg-[#016a36] text-white hover:bg-[#015a2d] ring-4 ring-[#016a36]/30' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
            ]"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>
          <div
            id="share-screen-tip"
            role="tooltip"
            class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-60 rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-[11px] leading-snug text-slate-200 shadow-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50"
          >
            <template v-if="isScreenSharing">Stop sharing your screen</template>
            <template v-else>
              <span class="font-semibold text-white">Share screen</span><br />
              Tip: share a specific window (like your slides or document) instead of your whole screen — it keeps students focused and avoids showing anything private.
            </template>
          </div>
        </div>
        <!-- Camera / mic / speaker picker -->
        <div class="relative">
          <button
            @click="showDevices = !showDevices; openMenu = null; if (showDevices) refreshDevices()"
            title="Camera & audio settings"
            :class="[
              'p-2.5 md:p-3.5 rounded-full transition-all duration-200 shadow-md cursor-pointer',
              showDevices ? 'bg-[#016a36] text-white' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
            ]"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          <div
            v-if="showDevices"
            class="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-72 max-w-[90vw] bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4 space-y-3 z-50"
          >
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold">Devices</h3>
              <button @click="showDevices = false" class="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <label class="block text-[11px] font-semibold text-slate-300">
              Camera
              <select
                :value="selectedCamera"
                @change="changeCamera($event.target.value)"
                :disabled="isScreenSharing"
                class="mt-1 w-full rounded-lg bg-slate-900 border border-slate-600 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-[#016a36] disabled:opacity-50"
              >
                <option v-if="!cameras.length" value="" disabled>No camera found</option>
                <option v-for="(d, i) in cameras" :key="d.deviceId" :value="d.deviceId">{{ d.label || `Camera ${i + 1}` }}</option>
              </select>
            </label>

            <label class="block text-[11px] font-semibold text-slate-300">
              Microphone
              <select
                :value="selectedMic"
                @change="changeMic($event.target.value)"
                class="mt-1 w-full rounded-lg bg-slate-900 border border-slate-600 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-[#016a36]"
              >
                <option v-if="!microphones.length" value="" disabled>No microphone found</option>
                <option v-for="(d, i) in microphones" :key="d.deviceId" :value="d.deviceId">{{ d.label || `Microphone ${i + 1}` }}</option>
              </select>
            </label>

            <label v-if="speakers.length" class="block text-[11px] font-semibold text-slate-300">
              Speaker
              <select
                :value="selectedSpeaker"
                @change="changeSpeaker($event.target.value)"
                class="mt-1 w-full rounded-lg bg-slate-900 border border-slate-600 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-[#016a36]"
              >
                <option v-for="(d, i) in speakers" :key="d.deviceId" :value="d.deviceId">{{ d.label || `Speaker ${i + 1}` }}</option>
              </select>
            </label>
          </div>
        </div>
      </template>

      <!-- Teacher: record in the browser (no OBS needed) -->
      <button
        v-if="isTeacher"
        @click="recState === 'recording' ? stopRecording() : startRecording()"
        :disabled="recState === 'starting' || recState === 'finishing' || !!recSaving"
        :title="recState === 'recording' ? 'Stop recording' : 'Record this class in your browser'"
        :aria-label="recState === 'recording' ? 'Stop recording' : 'Record'"
        :class="[
          'hidden sm:flex items-center gap-2 px-3.5 md:px-4 py-2.5 md:py-3 rounded-full text-xs font-semibold transition-all duration-200 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
          recState === 'recording' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
        ]"
      >
        <span v-if="recState === 'recording'" class="inline-block w-2.5 h-2.5 rounded-sm bg-white"></span>
        <span v-else class="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span>
        {{ recState === 'recording' ? 'Stop' : 'Record' }}
      </button>

      <!-- Teacher: copy the OBS recorder URL -->
      <button
        v-if="isTeacher"
        @click="copyRecorderLink"
        :title="recorderCopied ? 'Recorder link copied' : 'Copy OBS recorder link'"
        :class="[
          'hidden sm:block p-2.5 md:p-3.5 rounded-full transition-all duration-200 shadow-md cursor-pointer',
          recorderCopied ? 'bg-[#016a36] text-white' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
        ]"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" stroke-width="2" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      </button>

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
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { liveClassService } from '../../services/liveClassService';
import { authService } from '../../services/authService';
import { connectLiveClassSocket } from '../../services/liveClassSocket';
import { generateAgoraUid } from '../../utils/agoraUid';
import { createBrowserRecorder, isRecordingSupported } from '../../utils/browserRecorder';
import { saveRecordingToCourse, STAGE_UPLOAD } from '../../utils/saveRecording';
import { createLocalTracks, describeDeviceIssues, describeDeviceProblem } from '../../utils/agoraDevices';
import brandLogo from '@/assets/logo/RS_logo.png';
import SaveRecordingModal from '../../components/modals/SaveRecordingModal.vue';
import CollapsibleNotice from '../../components/live/CollapsibleNotice.vue';
import Avatar from '../../components/live/LiveAvatar.vue';
import ParticipantsPanel from '../../components/live/ParticipantsPanel.vue';

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
const recorderCopied = ref(false);
const showSaveRecording = ref(false);
const showEndClass = ref(false);
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
const connectionFailed = ref(false);
const audioEnabled = ref(true);
const videoEnabled = ref(true);
// Whether a real mic / camera track exists. Without one we're in view- or
// listen-only mode and the controls try to re-acquire the device on click.
const micAvailable = ref(false);
const cameraAvailable = ref(false);
const deviceNotice = ref('');
let deviceIssues = { audio: null, video: null };
const isScreenSharing = ref(false);

let hasLeft = false;
let clockTimer;

const updateClock = () => {
  currentTime.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ---- main area -----------------------------------------------------------
// One big tile: whoever is presenting. That's us if we're sharing or we're the
// teacher, otherwise the teacher's stream. Everyone else is a row in the
// Participants panel, not a tile. Keys: 'local' or an Agora uid; null = nobody yet.
const uidOf = (p) => p.agora_uid ?? generateAgoraUid(p.user_id);
const teacherUids = computed(() => new Set(participants.value.filter(p => p.role === 'teacher').map(uidOf)));
const localHasVideo = computed(() => canPublish.value && (isScreenSharing.value || videoEnabled.value));

const mainKey = computed(() => {
  if (canPublish.value && (isScreenSharing.value || isTeacher.value)) return 'local';
  return remoteUsers.value.find(u => teacherUids.value.has(u.uid))?.uid ?? null;
});
const mainRemote = computed(() => remoteUsers.value.find(u => u.uid === mainKey.value));
const isAlone = computed(() => participants.value.length <= 1 && remoteUsers.value.length === 0);

const TALKING_RING = 'border-emerald-400 shadow-[0_0_0_2px_rgba(52,211,153,0.55),0_0_20px_rgba(52,211,153,0.4)]';
const mainTileClass = (talking) => [
  'relative w-full h-full min-w-0 bg-slate-950 rounded-xl md:rounded-2xl overflow-hidden border shadow-xl transition-shadow duration-150',
  talking ? TALKING_RING : isAlone.value ? 'border-transparent' : 'border-slate-800',
];

// ---- attaching video to the page ----------------------------------------
// An Agora player is bound to one element. The presenter plays into the main
// tile; anyone else on camera plays into their row's thumbnail. When that
// element changes (new row, presenter changes) the video is attached again.
const attached = new Map();   // 'local' | uid -> { el, track }
const remoteVideoTarget = (uid) => (uid === mainKey.value ? `remote-player-${uid}` : `thumb-${uid}`);
const localVideoTarget = () => (mainKey.value === 'local' ? 'local-player' : 'thumb-local');

function attachVideo(key, track, targetId) {
  const el = track && document.getElementById(targetId);
  if (!el) return;
  const cur = attached.get(key);
  if (cur && cur.el === el && cur.track === track && el.querySelector('video')) return;
  track.play(el, { fit: 'cover' });
  attached.set(key, { el, track });
}

async function syncVideos() {
  await nextTick();
  for (const u of agoraEngine?.remoteUsers || []) {
    if (u.videoTrack) attachVideo(u.uid, u.videoTrack, remoteVideoTarget(u.uid));
  }
  if (localVideoTrack && !isScreenSharing.value) attachVideo('local', localVideoTrack, localVideoTarget());
}

// Re-attach whenever something that decides *where* a video goes changes.
watch(
  () => [
    mainKey.value,
    isConnected.value,
    videoEnabled.value,
    isScreenSharing.value,
    participants.value.map(p => p.user_id).join(),
    remoteUsers.value.map(u => `${u.uid}:${u.hasVideo}`).join(),
  ],
  () => { if (isConnected.value) syncVideos(); },
  { flush: 'post' },
);

// ---- who is talking ------------------------------------------------------
// Real-time levels straight from the local / remote audio tracks
// (getVolumeLevel(), 0–1). The client's "volume-indicator" event only fires
// every 2 s, which is too laggy for a ring that should follow the voice.
// Keys: 'local' for us, the Agora uid for everyone else.
const TALK_LEVEL = 0.06;      // above the noise floor of a quiet room
const TALK_HOLD_MS = 500;     // keep the ring through short pauses — no flicker
const SAMPLE_MS = 150;
const talkingKeys = ref(new Set());
const lastLoud = new Map();
let levelTimer = null;

function sampleVolumes() {
  const now = performance.now();
  const talking = new Set();
  const check = (key, level) => {
    if (level >= TALK_LEVEL) lastLoud.set(key, now);
    if (now - (lastLoud.get(key) ?? -Infinity) < TALK_HOLD_MS) talking.add(key);
  };
  check('local', localAudioTrack && audioEnabled.value ? localAudioTrack.getVolumeLevel() : 0);
  for (const u of agoraEngine?.remoteUsers || []) {
    if (u.audioTrack) check(u.uid, u.audioTrack.getVolumeLevel());
  }
  const prev = talkingKeys.value;
  if (talking.size !== prev.size || [...talking].some(k => !prev.has(k))) talkingKeys.value = talking;
}

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

// ---- participants panel rows ---------------------------------------------
// What the panel shows per person: whether their mic is open, a camera
// thumbnail if they're on camera, and the raise-hand queue.
const participantRows = computed(() => {
  const remoteByUid = new Map(remoteUsers.value.map(u => [u.uid, u]));
  const queue = stage.value.raised_hands.map(r => r.user_id);
  return participants.value.map((p) => {
    const isSelf = p.user_id === currentUser?.id;
    const uid = uidOf(p);
    const remote = remoteByUid.get(uid);
    const queuePos = queue.indexOf(p.user_id);
    const key = isSelf ? 'local' : uid;
    return {
      ...p,
      isSelf,
      // Real mic state: open right now. A remote mic that's muted (or never
      // enabled) isn't published, so hasAudio is false for them.
      mic: isSelf ? (canPublish.value && micAvailable.value && audioEnabled.value) : (!!remote?.hasAudio && !mutedAsked.value.has(p.user_id)),
      // Camera thumbnail in the row — except the presenter, who has the main tile.
      thumbId: `thumb-${isSelf ? 'local' : uid}`,
      videoOn: key !== mainKey.value && (isSelf ? (canPublish.value && videoEnabled.value) : !!(remote?.hasVideo && remote.videoReady)),
      handRaised: !!p.hand_raised || queuePos !== -1,
      handOrder: queuePos === -1 ? Infinity : queuePos,
    };
  });
});

// ========================================================================
// Lifecycle
// ========================================================================
onMounted(async () => {
  updateClock();
  clockTimer = setInterval(updateClock, 1000);

  if (!targetClassId.value) {
    connectionFailed.value = true;
    connectionStatus.value = 'No class ID';
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
    // Stop the spinner: a failed join must not look like "still connecting".
    connectionFailed.value = true;
    connectionStatus.value = err.response?.data?.error || err.message || 'Unknown error';
  }
});

// Teacher closing the tab mid-class: ask first. (The server also auto-ends a
// class whose teacher has been gone for a few minutes.)
const warnBeforeClose = (e) => {
  if (isTeacher.value && classActive.value && !hasLeft) {
    e.preventDefault();
    e.returnValue = '';
  }
};
window.addEventListener('beforeunload', warnBeforeClose);

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', warnBeforeClose);
  clearInterval(clockTimer);
  clearInterval(pollTimer);
  clearInterval(levelTimer);
  stopRecordingTimers();
  recorder?.dispose();
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
    await abortSpeaking(err);
  }
}

// We were put on stage (or tapped "speak") but have no usable microphone:
// tell the user why and hand the stage slot back so the teacher isn't left
// waiting on a silent speaker.
async function abortSpeaking(err) {
  if (!err?.userMessage) return false;
  flash(err.userMessage, 8000);
  handStatus.value = 'none';
  try { await liveClassService.lowerHand(targetClassId.value); } catch (_) { /* noop */ }
  return true;
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

/**
 * Open whichever of mic / camera we don't have yet, tolerating each one being
 * missing, blocked, or busy independently (see utils/agoraDevices.js). Never
 * throws for a device problem — it records it, updates the friendly notice, and
 * leaves the corresponding control in "retry on click" state.
 * `publish: false` lets the caller decide what to publish (co-host upgrade).
 */
async function acquireLocalTracks({ audio = !localAudioTrack, video = !localVideoTrack, publish = true } = {}) {
  const res = await createLocalTracks({
    audio,
    video,
    preferred: { audio: savedDevice('mic', 'microphoneId'), video: savedDevice('camera', 'cameraId') },
  });

  if (audio) {
    deviceIssues.audio = res.audioIssue;
    if (res.audioTrack) localAudioTrack = res.audioTrack;
    audioEnabled.value = !!localAudioTrack;
  }
  if (video) {
    deviceIssues.video = res.videoIssue;
    if (res.videoTrack) localVideoTrack = res.videoTrack;
    videoEnabled.value = !!localVideoTrack;
  }
  micAvailable.value = !!localAudioTrack;
  cameraAvailable.value = !!localVideoTrack;

  deviceNotice.value = describeDeviceIssues({ ...deviceIssues, presenter: isTeacher.value });

  // A camera track can't go out alongside an active screen share; it's
  // published when the share stops.
  const fresh = [res.audioTrack, isScreenSharing.value ? null : res.videoTrack].filter(Boolean);
  if (publish && fresh.length && agoraEngine) {
    await agoraEngine.publish(fresh);
    isPublishing = true;
  }
  // (Before the stage is on screen, initializeAgora attaches it once connected.)
  if (res.videoTrack && !isScreenSharing.value && isConnected.value) await syncVideos();
  if (audio || video) refreshDevices();
  return res;
}

async function initializeAgora(appId, channel, token, numericUid) {
  connectionStatus.value = 'Creating Agora client...';
  // Must match the mobile app's channel profile: Web "live" = Native
  // LiveBroadcasting (the app joins as LiveBroadcasting; Web "rtc" is the
  // Communication profile). Publishers are "host", everyone else "audience".
  agoraEngine = AgoraRTC.createClient({ mode: 'live', codec: 'vp8', role: canPublish.value ? 'host' : 'audience' });

  agoraEngine.on('user-published', handleUserPublished);
  agoraEngine.on('user-unpublished', handleUserUnpublished);
  agoraEngine.on('user-info-updated', handleUserInfoUpdated);
  agoraEngine.on('user-left', (user) => {
    remoteUsers.value = remoteUsers.value.filter(u => u.uid !== user.uid);
  });
  agoraEngine.on('token-privilege-will-expire', renewAgoraToken);

  connectionStatus.value = 'Joining channel...';
  await agoraEngine.join(appId, channel, token, numericUid);

  if (canPublish.value) {
    connectionStatus.value = 'Requesting camera and microphone access...';
    // A missing / blocked device must not block joining: whatever we can't
    // open just leaves us view- or listen-only.
    await acquireLocalTracks({ audio: true, video: true });
  }

  isConnected.value = true;
  clearInterval(levelTimer);
  levelTimer = setInterval(sampleVolumes, SAMPLE_MS);
  if (canPublish.value) refreshDevices();
  await syncVideos();
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
    attachVideo(user.uid, user.videoTrack, remoteVideoTarget(user.uid));
    upsertRemote(user.uid, { videoReady: true });
  }

  if (mediaType === 'audio') {
    // Keep an avatar tile for a camera-off participant who still has audio.
    upsertRemote(user.uid, { hasAudio: true });
    const who = participants.value.find(p => uidOf(p) === user.uid);
    if (who) setMutedAsked(who.user_id, false);   // they unmuted: show it as open again
    user.audioTrack.play();
    applySpeaker(user);
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

// A native (mobile) app can mute or disable its camera / mic *without*
// unpublishing — muteLocalVideoStream, enableLocalVideo(false). The SDK reports
// that as user-info-updated and only derives user-unpublished from it when its
// own bookkeeping says the state changed. Handle it directly too, so a tile can
// never be left showing the last frame of a camera that is off. Both paths end in
// the same idempotent handlers.
const MEDIA_OFF = { 'mute-video': 'video', 'disable-local-video': 'video', 'mute-audio': 'audio', 'disable-local-audio': 'audio' };
const MEDIA_ON = { 'unmute-video': 'video', 'enable-local-video': 'video', 'unmute-audio': 'audio', 'enable-local-audio': 'audio' };

const handleUserInfoUpdated = (uid, msg) => {
  console.debug('[live] user-info-updated', uid, msg);
  if (MEDIA_OFF[msg]) {
    handleUserUnpublished({ uid }, MEDIA_OFF[msg]);
    return;
  }
  const kind = MEDIA_ON[msg];
  if (!kind) return;
  // Back on: if the SDK says they're sending again but we haven't picked it up
  // (no user-published arrived), subscribe now.
  const sdkUser = agoraEngine?.remoteUsers.find(u => u.uid === uid);
  const mine = remoteUsers.value.find(u => u.uid === uid);
  const sending = kind === 'video' ? sdkUser?.hasVideo : sdkUser?.hasAudio;
  const known = kind === 'video' ? mine?.hasVideo : mine?.hasAudio;
  if (sdkUser && sending && !known) handleUserPublished(sdkUser, kind);
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
    await agoraEngine.setClientRole('host');   // live mode: only a host can publish

    if (localAudioTrack) await localAudioTrack.setEnabled(true);
    if (localVideoTrack) await localVideoTrack.setEnabled(true);
    // Open whatever is still missing, without publishing yet: speaking needs a
    // microphone, so if that's unavailable we bail out before going on stage.
    await acquireLocalTracks({ publish: false });

    if (!localAudioTrack) {
      const problem = describeDeviceProblem('audio', deviceIssues.audio || 'other');
      const e = new Error(`${problem} You can't speak without a microphone.`);
      e.userMessage = e.message;
      throw e;
    }

    const alreadyUp = agoraEngine.localTracks || [];
    const toPublish = [localAudioTrack, localVideoTrack].filter(t => t && !alreadyUp.includes(t));
    if (toPublish.length) await agoraEngine.publish(toPublish);

    audioEnabled.value = true;
    videoEnabled.value = !!localVideoTrack;
    await syncVideos();
  } catch (err) {
    console.error('Co-host upgrade failed:', err);
    isPublishing = false;
    if (err.userMessage) rtcRole.value = 'student'; // never got on stage
    throw err;
  }
}

async function downgradeFromCoHost() {
  try {
    const published = (agoraEngine.localTracks || []).filter(Boolean);
    if (published.length) await agoraEngine.unpublish(published);
    await localVideoTrack?.setEnabled(false);
    await localAudioTrack?.setEnabled(false);
    await agoraEngine.setClientRole('audience');   // after unpublish, as the SDK requires
    isScreenSharing.value = false;
    shareWarning.value = '';
    rtcRole.value = 'student';
  } catch (err) {
    console.error('Co-host downgrade failed:', err);
  } finally {
    isPublishing = false;
  }
}

// ========================================================================
// Device selection (camera / microphone / speaker), like Zoom or Meet
// ========================================================================
const showDevices = ref(false);
const cameras = ref([]);
const microphones = ref([]);
const speakers = ref([]);
const selectedCamera = ref('');
const selectedMic = ref('');
const selectedSpeaker = ref('');

const DEVICE_KEY = (kind) => `live.device.${kind}`;
const readDevice = (kind) => {
  try { return localStorage.getItem(DEVICE_KEY(kind)) || ''; } catch (_) { return ''; }
};
const savedDevice = (kind, optionName) => {
  const id = readDevice(kind);
  return id ? { [optionName]: id } : {};
};
const rememberDevice = (kind, id) => {
  try { localStorage.setItem(DEVICE_KEY(kind), id); } catch (_) { /* noop */ }
};

// Labels are blank until the browser has granted camera/mic permission, so
// this is called again once our tracks exist.
async function refreshDevices() {
  try {
    const [cams, mics, spk] = await Promise.all([
      AgoraRTC.getCameras().catch(() => []),
      AgoraRTC.getMicrophones().catch(() => []),
      AgoraRTC.getPlaybackDevices().catch(() => []),
    ]);
    cameras.value = cams;
    microphones.value = mics;
    speakers.value = spk;
    selectedCamera.value = localVideoTrack?.getMediaStreamTrack?.().getSettings?.().deviceId || selectedCamera.value || cams[0]?.deviceId || '';
    selectedMic.value = localAudioTrack?.getMediaStreamTrack?.().getSettings?.().deviceId || selectedMic.value || mics[0]?.deviceId || '';
    if (!selectedSpeaker.value) selectedSpeaker.value = readDevice('speaker') || spk[0]?.deviceId || '';
  } catch (err) {
    console.warn('refreshDevices failed:', err);
  }
}

// Chevron menus next to the mic / camera buttons (Meet-style).
const openMenu = ref(null); // 'mic' | 'camera' | null

function toggleDeviceMenu(kind) {
  showDevices.value = false;
  openMenu.value = openMenu.value === kind ? null : kind;
  if (openMenu.value) refreshDevices();
}

async function pickDevice(kind, deviceId) {
  openMenu.value = null;
  await (kind === 'mic' ? changeMic(deviceId) : changeCamera(deviceId));
}

const closeMenuOnOutsidePointer = (e) => {
  if (openMenu.value && !e.target.closest?.('[data-device-menu]')) openMenu.value = null;
};
const closeMenuOnEscape = (e) => { if (e.key === 'Escape') openMenu.value = null; };
onMounted(() => {
  document.addEventListener('pointerdown', closeMenuOnOutsidePointer);
  document.addEventListener('keydown', closeMenuOnEscape);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeMenuOnOutsidePointer);
  document.removeEventListener('keydown', closeMenuOnEscape);
});

// With a live track we hot-swap the device. With none (joined without that
// device, e.g. camera plugged in later) the choice is remembered first, so
// acquireLocalTracks() opens *that* device and publishes it.
async function changeCamera(deviceId) {
  selectedCamera.value = deviceId;
  rememberDevice('camera', deviceId);
  try {
    if (localVideoTrack) {
      await localVideoTrack.setDevice(deviceId);
    } else {
      await acquireLocalTracks({ audio: false, video: true });
      if (!localVideoTrack) flash(deviceNotice.value || 'Could not start that camera.', 5000);
    }
  } catch (err) {
    flash('Could not switch camera. Is it in use by another app?', 4000);
    console.error('setDevice(camera) failed:', err);
  }
}

async function changeMic(deviceId) {
  selectedMic.value = deviceId;
  rememberDevice('mic', deviceId);
  try {
    if (localAudioTrack) {
      await localAudioTrack.setDevice(deviceId);
    } else {
      await acquireLocalTracks({ audio: true, video: false });
      if (!localAudioTrack) flash(deviceNotice.value || 'Could not start that microphone.', 5000);
    }
  } catch (err) {
    flash('Could not switch microphone.', 4000);
    console.error('setDevice(mic) failed:', err);
  }
}

function changeSpeaker(deviceId) {
  selectedSpeaker.value = deviceId;
  rememberDevice('speaker', deviceId);
  applySpeaker();
}

// Route remote audio to the chosen output (Chromium only).
function applySpeaker(user) {
  if (!selectedSpeaker.value) return;
  const list = user ? [user] : (agoraEngine?.remoteUsers || []);
  for (const u of list) {
    try { u.audioTrack?.setPlaybackDevice?.(selectedSpeaker.value); } catch (_) { /* noop */ }
  }
}

// Plug / unplug a device while in class.
AgoraRTC.onCameraChanged = () => refreshDevices();
AgoraRTC.onMicrophoneChanged = () => refreshDevices();
AgoraRTC.onPlaybackDeviceChanged = () => refreshDevices();

// ========================================================================
// Controls
// ========================================================================
// With no device we're view/listen-only; clicking the control retries, so
// plugging in a headset or unblocking the permission doesn't need a reload.
const retryDevice = async (kind) => {
  try {
    await acquireLocalTracks({ audio: kind === 'audio', video: kind === 'video' });
  } catch (err) {
    console.error(`Retrying ${kind} failed:`, err);
  }
  if (deviceNotice.value) flash(deviceNotice.value, 7000);
};

const toggleAudio = async () => {
  if (!localAudioTrack) return retryDevice('audio');
  audioEnabled.value = !audioEnabled.value;
  await localAudioTrack.setEnabled(audioEnabled.value);
};

const toggleVideo = async () => {
  if (isScreenSharing.value) return;
  if (!localVideoTrack) return retryDevice('video');
  videoEnabled.value = !videoEnabled.value;
  await localVideoTrack.setEnabled(videoEnabled.value);
};

// Hints for the browser's share picker (Chrome / Edge 107+; other browsers
// ignore them, and the user can still pick anything). Pre-selecting "Window"
// steers teachers away from "Entire screen", and hiding this tab from the
// picker stops them sharing the live class itself.
const SCREEN_SHARE_HINTS = {
  displaySurface: 'window',
  selfBrowserSurface: 'exclude',
  surfaceSwitching: 'include',
};

// Warning shown while a share may show more than intended.
const shareWarning = ref('');

// The browser can't tell us *which* tab/window/screen was picked, only its
// type (track settings' displaySurface). So: an entire screen shows everything;
// a tab can only be this page on browsers that can't hide it from the picker.
// A window share isn't flagged — it may just as well be the slides.
function describeShareRisk(track) {
  const surface = track.getMediaStreamTrack?.().getSettings?.().displaySurface;
  if (surface === 'monitor') {
    return "You're sharing your entire screen — students will see everything on it, including this live class window and any notifications. Consider sharing a specific window or tab instead.";
  }
  const canHideThisTab = !!navigator.mediaDevices?.getSupportedConstraints?.().selfBrowserSurface;
  if (surface === 'browser' && !canHideThisTab) {
    return "You're sharing a browser tab. If it's the tab with this live class, students will only see the class itself. Consider sharing a different window or tab instead.";
  }
  return '';
}

// Every track the capture produced. createScreenVideoTrack(…, 'auto') returns
// [video, audio] when the user also shares tab / system audio — the audio one
// keeps the browser's "sharing" indicator alive if it isn't closed too.
const screenTracks = () => (screenTrack ? (Array.isArray(screenTrack) ? screenTrack : [screenTrack]) : []);

function releaseScreenTracks() {
  for (const t of screenTracks()) {
    try { t.close(); } catch (err) { console.warn('closing a screen track failed:', err); }
  }
  screenTrack = null;
}

const toggleScreenShare = async () => {
  if (isScreenSharing.value) return handleStopScreenShare();
  let cameraUnpublished = false;
  try {
    screenTrack = await AgoraRTC.createScreenVideoTrack({
      encoderConfig: '1080p_1',
      optimizationMode: 'detail',
      ...SCREEN_SHARE_HINTS,
    }, 'auto');
    const [track] = screenTracks();

    if (localVideoTrack && videoEnabled.value) {
      await agoraEngine.unpublish(localVideoTrack);
      cameraUnpublished = true;
    }
    await agoraEngine.publish(track);

    // The screen track is deliberately not played back locally (see the
    // "You're presenting" tile). Stop the camera preview so it doesn't sit
    // under it; handleStopScreenShare() plays it again.
    localVideoTrack?.stop();
    attached.delete('local');   // its player is gone; attach again when sharing stops
    isScreenSharing.value = true;
    shareWarning.value = describeShareRisk(track);
    // The browser's own "Stop sharing" ends every track of the capture.
    screenTracks().forEach(t => t.on('track-ended', handleStopScreenShare));
  } catch (err) {
    console.error('Failed to start screen share:', err);
    // Don't leave a half-started capture running (picker cancelled = nothing to release).
    releaseScreenTracks();
    if (cameraUnpublished && localVideoTrack && videoEnabled.value) {
      try { await agoraEngine.publish(localVideoTrack); } catch (e) { console.error('restoring the camera failed:', e); }
    }
  }
};

let stoppingShare = false;
const handleStopScreenShare = async () => {
  if (stoppingShare || (!isScreenSharing.value && !screenTrack)) return;
  stoppingShare = true;
  try {
    // 1. Stop sending it. Whatever happens here, the capture itself must still
    //    be released below, so an error is logged, not allowed to abort.
    const [video] = screenTracks();
    try {
      if (video && agoraEngine) await agoraEngine.unpublish(video);
    } catch (err) {
      console.warn('unpublishing the screen track failed:', err);
    }
    // 2. Stop the capture — every track — so nothing keeps running and the
    //    browser's "sharing" indicator goes away.
    releaseScreenTracks();
    // 3. Only now, with the capture really stopped, reset the UI. This does not
    //    depend on the camera coming back (step 4 can fail on its own).
    isScreenSharing.value = false;
    shareWarning.value = '';
    // 4. Bring the camera back if it was on.
    if (localVideoTrack && videoEnabled.value) {
      try {
        await agoraEngine.publish(localVideoTrack);
      } catch (err) {
        console.error('restoring the camera after sharing failed:', err);
        flash('Screen sharing stopped, but your camera could not be restored. Tap the camera button to retry.', 6000);
      }
    }
    await syncVideos();
  } finally {
    stoppingShare = false;
  }
};

const reloadPage = () => window.location.reload();

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
    if (!(await abortSpeaking(err))) showActionError(err, 'Could not open your microphone. Try again.');
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
// Muting is a request: the student's app closes their mic, and we see that when
// their audio stops publishing. Until then show the mic as closed so the click
// gives instant feedback; the entry is dropped once the real state has caught up.
const mutedAsked = ref(new Set());
const setMutedAsked = (userId, on) => {
  const next = new Set(mutedAsked.value);
  if (on) next.add(userId); else next.delete(userId);
  mutedAsked.value = next;
};
const mute = async (userId) => {
  setMutedAsked(userId, true);
  setTimeout(() => setMutedAsked(userId, false), 6000);
  try {
    await liveClassService.muteSpeaker(targetClassId.value, userId);
    flash('Mic closed.', 1800);
  } catch (err) {
    setMutedAsked(userId, false);
    showActionError(err, 'Could not mute this speaker.');
  }
};

// Teacher: drop a student off the stage (speaker or raised hand).
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
const endClass = () => {
  if (statusBusy.value) return;
  showEndClass.value = true;
};

// Called by the End class modal once the teacher confirms.
const performEndClass = async () => {
  if (statusBusy.value) return;
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
  clearInterval(levelTimer);
  if (autoLeaveTimer) clearTimeout(autoLeaveTimer);

  try {
    if (!alreadyGone) {
      socketConn?.disconnect();   // emits live-class:unsubscribe
      releaseScreenTracks();   // every track of the capture, not just the video
      try { localAudioTrack?.stop(); localVideoTrack?.stop(); } catch (_) { /* noop */ }
      localAudioTrack?.close();
      localVideoTrack?.close();
      if (agoraEngine) await agoraEngine.leave();
    }
  } catch (err) {
    console.error('Teardown error:', err);
  } finally {
    emit('left-class');
    if (route.name === 'LiveStream') {
      // After ending, the teacher stays on the dialog (the End class modal, or
      // the save-recording one if the class was ended elsewhere); it closes
      // the tab once the upload completes or is skipped.
      if (isTeacher.value && liveClass.value.status === 'completed') {
        if (!showEndClass.value) showSaveRecording.value = true;
      } else {
        router.push('/');
      }
    }
  }
}

// ========================================================================
// Browser recording (an alternative to OBS) — see utils/browserRecorder.js
// ========================================================================
const recState = ref('idle');          // 'idle' | 'starting' | 'recording' | 'finishing'
const recElapsed = ref(0);             // seconds
const recSaving = ref(null);           // { stage, progress } while a stopped recording uploads
const recClock = computed(() => {
  const t = recElapsed.value;
  const pad = (n) => String(n).padStart(2, '0');
  return t >= 3600 ? `${Math.floor(t / 3600)}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}` : `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
});
let recorder = null;
let recSyncTimer = null;
let recClockTimer = null;
let recCount = 0;

// What is live right now, as raw MediaStreamTracks: the shared screen (else the
// camera) for the picture, and every open audio track for the sound — ours, the
// shared tab's audio, and any student who has the mic.
function recordingSources() {
  const raw = (t) => t?.getMediaStreamTrack?.() || null;
  const sharing = isScreenSharing.value && screenTrack;
  const [screenVideo, screenAudio] = Array.isArray(screenTrack) ? screenTrack : [screenTrack, null];
  return {
    screen: sharing ? raw(screenVideo) : null,
    camera: !sharing && videoEnabled.value ? raw(localVideoTrack) : null,
    audio: [
      audioEnabled.value ? raw(localAudioTrack) : null,
      sharing ? raw(screenAudio) : null,
      ...(agoraEngine?.remoteUsers || []).map(u => raw(u.audioTrack)),
    ].filter(Boolean),
  };
}

const warnBeforeLeaving = (e) => { e.preventDefault(); e.returnValue = ''; };

function stopRecordingTimers() {
  clearInterval(recSyncTimer);
  clearInterval(recClockTimer);
  recSyncTimer = recClockTimer = null;
  window.removeEventListener('beforeunload', warnBeforeLeaving);
}

async function startRecording() {
  if (recState.value !== 'idle') return;
  if (!isRecordingSupported()) {
    flash("This browser can't record the class. Use the OBS option instead (Copy OBS recorder link), then upload the file when you end the class.", 9000);
    return;
  }
  const src = recordingSources();
  if (!src.screen && !src.camera && !src.audio.length) {
    flash('Nothing to record yet — turn on your mic or camera, or share your screen first.', 6000);
    return;
  }
  recState.value = 'starting';
  try {
    recorder = createBrowserRecorder({
      name: userName.value,
      onError: (err) => {
        console.error('Recorder error:', err);
        flash(`Recording stopped unexpectedly: ${err.message}. Use the OBS option if you need this class recorded.`, 9000);
        recorder?.dispose();
        recorder = null;
        stopRecordingTimers();
        recState.value = 'idle';
      },
    });
    await recorder.start(src);
  } catch (err) {
    console.error('Could not start recording:', err);
    recorder?.dispose();
    recorder = null;
    flash(err.code === 'unsupported'
      ? "This browser can't record the class. Use the OBS option instead."
      : `Could not start recording: ${err.message}. You can still use the OBS option.`, 9000);
    recState.value = 'idle';
    return;
  }
  recElapsed.value = 0;
  recState.value = 'recording';
  // Tracks come and go (share on/off, mute, a student takes the mic) — keep the
  // recorder pointed at whatever is live.
  recSyncTimer = setInterval(() => recorder?.update(recordingSources()), 300);
  recClockTimer = setInterval(() => { recElapsed.value = Math.floor((recorder?.elapsedMs() || 0) / 1000); }, 1000);
  window.addEventListener('beforeunload', warnBeforeLeaving);   // a tab closed mid-recording loses it
  if (!src.audio.length) flash('Recording started without sound — your mic is off.', 5000);
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Stop and hand back the finished file — also saved to the teacher's computer,
// so there's a local copy whatever happens to the upload. Null if not recording.
async function finishRecording() {
  if (!recorder || recState.value !== 'recording') return null;
  recState.value = 'finishing';
  stopRecordingTimers();
  try {
    const { blob, ext, mimeType } = await recorder.stop();
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
    const base = (liveClass.value.title || 'live-class').replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '-');
    const file = new File([blob], `${base}-${stamp}.${ext}`, { type: mimeType });
    downloadFile(file);
    return file;
  } finally {
    recorder = null;
    recState.value = 'idle';
  }
}

// The Stop button: finish, download, then save it to the course like an OBS upload.
async function stopRecording() {
  let file;
  try {
    file = await finishRecording();
  } catch (err) {
    flash(`The recording failed: ${err.message}`, 8000);
    return;
  }
  if (!file) return;
  recCount += 1;
  recSaving.value = { stage: 'Creating chapter…', progress: 0 };
  try {
    await saveRecordingToCourse({
      courseId: liveClass.value.course_id,
      liveClassId: targetClassId.value,
      title: `${liveClass.value.title || 'Live class'} (recording${recCount > 1 ? ` ${recCount}` : ''})`,
      file,
      onStage: (stage) => { recSaving.value = { ...recSaving.value, stage }; },
      onProgress: (progress) => { recSaving.value = { ...recSaving.value, progress }; },
    });
    flash('Recording saved to the course (a copy was downloaded too).', 6000);
  } catch (err) {
    console.error('Saving the recording failed:', err);
    flash(`Saved to your computer, but the upload failed: ${err.response?.data?.error || err.message}. You can upload the file from "Save class recording".`, 10000);
  } finally {
    recSaving.value = null;
  }
}

// Teacher: copy the URL to paste into an OBS Browser Source.
async function copyRecorderLink() {
  try {
    const res = await liveClassService.getRecorderLink(targetClassId.value);
    const key = (res.data || res).key;
    const url = `${window.location.origin}/live/${targetClassId.value}/record?key=${encodeURIComponent(key)}`;
    await navigator.clipboard.writeText(url);
    recorderCopied.value = true;
    flash('Recorder link copied. Paste it into an OBS Browser Source (valid 8 hours).', 5000);
    setTimeout(() => (recorderCopied.value = false), 2500);
  } catch (err) {
    flash(err.response?.data?.error || 'Could not create recorder link', 4000);
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

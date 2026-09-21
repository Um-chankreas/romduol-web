<template>
  <div class="flex flex-col min-h-0">
    <!-- Brand accent -->
    <div class="h-0.5 shrink-0 bg-gradient-to-r from-[#016a36] via-[#34c27f] to-[#ffce04]"></div>

    <header class="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-700/50">
      <div class="flex items-center gap-2 min-w-0">
        <h2 class="text-white font-bold text-sm">Participants</h2>
        <span class="bg-[#016a36]/25 text-[#34c27f] text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums">{{ rows.length }}</span>
      </div>
      <slot name="actions" />
    </header>

    <!-- Only worth having once the list is long -->
    <div v-if="rows.length > SEARCH_MIN" class="shrink-0 px-3 pt-3">
      <label class="relative block">
        <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
        </svg>
        <input
          v-model="query"
          type="text"
          placeholder="Search participants"
          aria-label="Search participants"
          class="w-full rounded-lg bg-slate-900/70 border border-slate-600/70 pl-8 pr-8 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-[#016a36] focus:ring-1 focus:ring-[#016a36]"
        />
        <button
          v-if="query"
          type="button"
          class="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 grid place-items-center rounded text-slate-400 hover:text-white cursor-pointer"
          aria-label="Clear search"
          @click="query = ''"
        >✕</button>
      </label>
    </div>

    <!-- The list scrolls inside the panel; the panel never grows past the screen -->
    <div class="min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-3">
      <!-- Rows are hidden with v-show, never removed: a camera thumbnail is a live
           video player and would go blank if its row were re-created. -->
      <section v-for="g in groups" v-show="g.items.some(matches)" :key="g.key">
        <h3 class="px-2 pb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" :class="g.tone">
          {{ g.label }}
          <span class="font-semibold opacity-70 tabular-nums">{{ g.items.length }}</span>
        </h3>

        <ul :class="columns > 1 ? 'grid grid-cols-3 gap-1' : 'space-y-0.5'">
          <li
            v-for="r in g.items"
            v-show="matches(r)"
            :key="r.user_id"
            class="row-group rounded-xl px-1.5 py-2 transition-colors hover:bg-slate-700/40 focus-within:bg-slate-700/40"
          >
            <div class="flex flex-col items-center gap-1.5 text-center">
              <!-- Avatar, or the person's camera when it's on -->
              <div class="relative shrink-0 w-10 h-10 md:w-12 md:h-12">
                <Avatar v-show="!showThumbs || !r.videoOn" :name="r.name" :src="r.avatar_url" size="sm" :tone="toneFor(r)" />
                <div
                  v-if="showThumbs"
                  v-show="r.videoOn"
                  :id="r.thumbId"
                  class="thumb absolute inset-0 rounded-full overflow-hidden bg-slate-900"
                ></div>
                <span
                  v-if="r.handRaised"
                  class="absolute -top-1 -right-1.5 inline-flex items-center gap-px rounded-full bg-[#ffce04] text-slate-900 px-1 py-0.5 text-[10px] font-bold leading-none shadow"
                  :title="r.handOrder !== Infinity ? `Hand raised (#${r.handOrder + 1} in queue)` : 'Hand raised'"
                >✋<span v-if="r.handOrder !== Infinity" class="tabular-nums">{{ r.handOrder + 1 }}</span></span>
              </div>

              <!-- Mic badge (real state) + name -->
              <div class="flex items-center justify-center gap-1.5 w-full min-w-0" :title="r.name">
                <!-- Teacher: click a student's open mic to mute them -->
                <button
                  v-if="r.mic && canMuteMic(r)"
                  type="button"
                  class="shrink-0 w-4 h-4 rounded-full bg-emerald-600 grid place-items-center text-white cursor-pointer transition hover:bg-red-600 hover:scale-125 focus-visible:ring-2 focus-visible:ring-red-400 outline-none"
                  :aria-label="`Mute ${r.name}`" :title="`Click to mute ${r.name}`"
                  @click="emit('mute', r.user_id)"
                >
                  <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
                    <path d="M5 11a7 7 0 0014 0M12 18v3" />
                  </svg>
                </button>
                <span
                  v-else-if="r.mic"
                  class="shrink-0 w-4 h-4 rounded-full bg-emerald-600 grid place-items-center text-white"
                  role="img" aria-label="Microphone on" title="Microphone on"
                >
                  <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
                    <path d="M5 11a7 7 0 0014 0M12 18v3" />
                  </svg>
                </span>
                <span
                  v-else
                  class="shrink-0 w-4 h-4 rounded-full bg-red-600 grid place-items-center text-white"
                  role="img" aria-label="Microphone off" title="Microphone off"
                >
                  <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0014 0M12 18v3M4 4l16 16" />
                  </svg>
                </span>
                <span class="truncate text-[11px] md:text-xs font-medium text-slate-100">{{ r.isSelf ? 'You' : r.name }}</span>
              </div>

              <span v-if="r.role === 'teacher'" class="text-[10px] font-bold uppercase tracking-wide text-[#ffce04] leading-none">Teacher</span>
              <span v-else-if="r.speaking" class="text-[10px] font-semibold text-[#34c27f] leading-none">On stage</span>

              <button
                v-if="canInvite(r)"
                type="button"
                class="text-[10px] font-bold px-2.5 py-1 rounded-md bg-[#016a36] hover:bg-[#015a2d] text-white cursor-pointer"
                @click="emit('invite', r.user_id)"
              >Invite to speak</button>
            </div>

          </li>
        </ul>
      </section>

      <p v-if="!rows.length || (query && !anyMatch)" class="px-3 py-6 text-center text-xs text-slate-500">
        {{ rows.length ? 'No one matches that search.' : 'No one has joined yet.' }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import Avatar from './LiveAvatar.vue';

// Presentational: LiveStreamView works out each row. Row shape:
//   { user_id, name, avatar_url, role, speaking (on stage), isSelf, mic,
//     thumbId, videoOn, handRaised, handOrder }   (mic = mic is open right now)
const props = defineProps({
  rows: { type: Array, default: () => [] },
  canManage: Boolean,
  // Camera thumbnails need a unique element id, so only one panel may show them.
  showThumbs: { type: Boolean, default: true },
  // 1 = the narrow desktop strip; >1 lays the same cards out as a grid (mobile drawer).
  columns: { type: Number, default: 1 },
});
const emit = defineEmits(['invite', 'mute']);

const SEARCH_MIN = 8;   // show the search box once there are more people than this
const query = ref('');

const byName = (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });

// Teacher pinned first, then students A–Z. Sorted by name only, so a row never
// jumps when someone's state changes.
const groups = computed(() => {
  const teachers = props.rows.filter(r => r.role === 'teacher').sort(byName);
  const students = props.rows.filter(r => r.role !== 'teacher').sort(byName);
  return [
    { key: 'teacher', label: 'Teacher', tone: 'text-[#ffce04]', items: teachers },
    { key: 'students', label: 'Students', tone: 'text-slate-400', items: students },
  ].filter(g => g.items.length);
});

const matches = (r) => {
  const q = query.value.trim().toLowerCase();
  return !q || (r.name || '').toLowerCase().includes(q);
};
const anyMatch = computed(() => props.rows.some(matches));

// A steady colour per person for the initials circle (Meet-style); the teacher keeps the brand green.
const TONES = ['#1a73e8', '#9334e6', '#8d6e63', '#0b8043', '#c5221f', '#e37400', '#00897b', '#5f6368'];
function toneFor(r) {
  if (r.role === 'teacher') return '#016a36';
  let hash = 0;
  for (const ch of String(r.user_id ?? r.name)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

const manageable = (r) => props.canManage && r.role !== 'teacher';
const canInvite = (r) => manageable(r) && r.handRaised && !r.speaking;
const canMuteMic = (r) => manageable(r);   // only shown on an open mic (see the badge)
</script>

<style scoped>
/* Agora inserts its own <div><video> into the thumbnail; make it fill the circle. */
.thumb :deep(div),
.thumb :deep(video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
}
</style>

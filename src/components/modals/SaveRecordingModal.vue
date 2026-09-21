<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div class="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-5 text-slate-100 shadow-2xl">
      <div class="flex items-center gap-3">
        <img :src="brandLogo" alt="" class="h-10 w-10 object-contain" />
        <div class="min-w-0">
          <h1 class="text-lg font-bold">Save class recording</h1>
          <p class="text-xs text-slate-400 truncate">{{ liveClass.title || 'Live class' }}</p>
        </div>
      </div>

      <div v-if="done" class="space-y-4">
        <p class="text-sm text-emerald-400">Recording saved as a chapter video. Closing this tab…</p>
        <div class="flex gap-3">
          <button class="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold cursor-pointer" @click="openChapter">
            Open chapter
          </button>
          <button class="flex-1 py-2.5 rounded-lg bg-[#016a36] hover:bg-[#015a2d] text-sm font-semibold cursor-pointer" @click="finish">
            Close now
          </button>
        </div>
      </div>

      <form v-else class="space-y-4" @submit.prevent="save">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Chapter title</label>
          <input v-model="title" required :disabled="busy" class="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm outline-none focus:border-[#016a36] disabled:opacity-50" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">OBS recording file</label>
          <input
            type="file"
            accept="video/*,.mkv,.mov,.mp4,.webm"
            :disabled="busy"
            class="w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100"
            @change="file = $event.target.files[0] || null"
          />
          <p class="text-[11px] text-slate-500 mt-1">MP4, MOV, WebM, M4V or MKV. In OBS use Settings → Advanced → Recording Format = mp4 (or remux MKV to MP4).</p>
        </div>

        <div v-if="busy" class="space-y-1">
          <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div class="h-full bg-[#016a36] transition-all" :style="{ width: progress + '%' }"></div>
          </div>
          <p class="text-[11px] text-slate-400">{{ stage }} {{ progress }}%</p>
        </div>

        <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

        <div class="flex gap-3">
          <button type="button" :disabled="busy" class="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold cursor-pointer disabled:opacity-40" @click="finish">
            Skip
          </button>
          <button type="submit" :disabled="busy || !file || !title" class="flex-1 py-2.5 rounded-lg bg-[#016a36] hover:bg-[#015a2d] text-sm font-semibold cursor-pointer disabled:opacity-40">
            {{ busy ? 'Uploading…' : 'Save to course' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { liveClassService } from '../../services/liveClassService';
import { lessonService, isVideoFile } from '../../services/lessonService';
import api from '../../services/axios';
import brandLogo from '@/assets/logo/RS_logo.png';

const props = defineProps({
  liveClassId: { type: [String, Number], required: true },
});

const router = useRouter();

const AUTO_CLOSE_MS = 2000;

const liveClass = ref({});
const title = ref('');
const file = ref(null);
const busy = ref(false);
const stage = ref('');
const progress = ref(0);
const error = ref('');
const done = ref(false);
let lessonId = null;
let closeTimer = null;

onMounted(async () => {
  try {
    const res = await liveClassService.getLiveClassDetails(props.liveClassId);
    liveClass.value = res.data?.liveClass || res.data || res;
    title.value = `${liveClass.value.title || 'Live class'} (recording)`;
  } catch (err) {
    error.value = err.response?.data?.error || 'Could not load the live class';
  }
});

onBeforeUnmount(() => clearTimeout(closeTimer));

// The live room opens in its own tab (window.open), so window.close() works.
// If the browser refuses (tab opened by hand), fall back to the class list.
function finish() {
  clearTimeout(closeTimer);
  window.close();
  setTimeout(() => router.push('/'), 300);
}

function openChapter() {
  clearTimeout(closeTimer);
  router.push(`/lessons/${lessonId}`);
}

async function save() {
  error.value = '';
  if (!isVideoFile(file.value)) {
    error.value = 'Please choose a video file.';
    return;
  }
  busy.value = true;
  try {
    // Reuse the same chapter + video upload flow as the course editor. If a
    // previous attempt already created the chapter, retry only the upload.
    if (!lessonId) {
      stage.value = 'Creating chapter…';
      const created = await lessonService.createLesson(liveClass.value.course_id, title.value, '', null);
      lessonId = (created.data?.lesson || created.data || created.lesson).id;
    }
    stage.value = 'Uploading video';
    await lessonService.uploadLessonVideo(lessonId, file.value, {
      onProgress: (p) => { progress.value = Math.round(p); }
    });
    await api.put(`/live-classes/${props.liveClassId}/recording`, { lesson_id: lessonId });
    done.value = true;
    closeTimer = setTimeout(finish, AUTO_CLOSE_MS);
  } catch (err) {
    error.value = err.response?.data?.error || err.message || 'Upload failed';
  } finally {
    busy.value = false;
  }
}
</script>

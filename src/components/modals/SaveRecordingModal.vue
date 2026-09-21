<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div class="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-5 text-slate-100 shadow-2xl">
      <div class="flex items-center gap-3">
        <img :src="brandLogo" alt="" class="h-10 w-10 object-contain" />
        <div class="min-w-0">
          <h1 class="text-lg font-bold">{{ isEndMode ? 'End class' : 'Save class recording' }}</h1>
          <p class="text-xs text-slate-400 truncate">{{ liveClass.title || 'Live class' }}</p>
        </div>
      </div>

      <div v-if="done" class="space-y-4">
        <p class="text-sm text-emerald-400">
          {{ isEndMode ? 'Class ended and recording saved as a chapter video.' : 'Recording saved as a chapter video.' }}
          Closing this tab…
        </p>
        <div class="flex gap-3">
          <button class="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold cursor-pointer" @click="openChapter">
            Open chapter
          </button>
          <button class="flex-1 py-2.5 rounded-lg bg-[#016a36] hover:bg-[#015a2d] text-sm font-semibold cursor-pointer" @click="finish">
            Close now
          </button>
        </div>
      </div>

      <form v-else class="space-y-4" @submit.prevent="submit">
        <p v-if="isEndMode" class="rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2">
          This will end the class for everyone. All students will be removed.
        </p>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Chapter title</label>
          <input v-model="title" :required="!!file || usingBrowserRecording" :disabled="busy" class="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm outline-none focus:border-[#016a36] disabled:opacity-50" />
        </div>

        <!-- A browser recording (Record button) replaces the OBS file field -->
        <div v-if="usingBrowserRecording" class="rounded-lg bg-slate-900/70 border border-slate-600 px-3 py-2.5 text-xs text-slate-300 space-y-0.5">
          <p class="font-semibold text-white flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-red-500" :class="file ? '' : 'animate-pulse'"></span>
            {{ file ? 'Browser recording ready' : 'Browser recording in progress' }}
          </p>
          <p v-if="file" class="text-slate-400">{{ file.name }} · {{ (file.size / 1048576).toFixed(1) }} MB — a copy was also downloaded to your computer.</p>
          <p v-else class="text-slate-400">It will be stopped, downloaded to your computer and saved to this course when you end the class.</p>
        </div>

        <div v-else>
          <label class="block text-xs font-semibold text-slate-300 mb-1">OBS recording file<span v-if="isEndMode" class="font-normal text-slate-500"> (optional)</span></label>
          <input
            ref="fileInputEl"
            type="file"
            accept=".mp4,.mov,.webm,.m4v,.mkv,video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-matroska"
            :disabled="busy"
            :class="['w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100', fileError ? 'rounded-lg ring-1 ring-red-500/60' : '']"
            @change="onFile"
          />
          <p v-if="fileError" class="text-[11px] text-red-400 mt-1" role="alert">{{ fileError }}</p>
          <p class="text-[11px] text-slate-500 mt-1">MP4, MOV, WebM, M4V or MKV. In OBS use Settings → Advanced → Recording Format = mp4 (or remux MKV to MP4).</p>
        </div>

        <div v-if="busy" class="space-y-1.5">
          <div v-if="uploadingVideo" class="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div class="h-full bg-[#016a36] transition-all" :style="{ width: progress + '%' }"></div>
          </div>
          <p class="flex items-center gap-2 text-[11px] text-slate-400">
            <span class="inline-block h-3 w-3 rounded-full border-2 border-slate-500 border-t-transparent animate-spin"></span>
            <span>{{ stage }} <template v-if="uploadingVideo">{{ progress }}%</template></span>
          </p>
        </div>

        <p v-if="error" class="text-sm text-red-400" role="alert">{{ error }}</p>

        <div class="flex flex-wrap gap-3">
          <button
            v-if="isEndMode"
            type="button"
            :disabled="busy"
            class="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold cursor-pointer disabled:opacity-40"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            v-else
            type="button"
            :disabled="busy"
            class="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold cursor-pointer disabled:opacity-40"
            @click="finish"
          >
            Skip
          </button>
          <button
            v-if="isEndMode && uploadFailed"
            type="button"
            :disabled="busy"
            class="flex-1 py-2.5 rounded-lg border border-red-500/60 text-red-300 hover:bg-red-500/10 text-sm font-semibold cursor-pointer disabled:opacity-40"
            @click="endWithoutRecording"
          >
            End without recording
          </button>
          <button
            type="submit"
            :disabled="!canSubmit"
            :class="[
              'flex-1 py-2.5 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-40',
              isEndMode ? 'bg-red-600 hover:bg-red-700' : 'bg-[#016a36] hover:bg-[#015a2d]'
            ]"
          >
            {{ submitLabel }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { liveClassService } from '../../services/liveClassService';
import { isSupportedVideoFile } from '../../services/lessonService';
import { saveRecordingToCourse, STAGE_UPLOAD } from '../../utils/saveRecording';
import brandLogo from '@/assets/logo/RS_logo.png';

const props = defineProps({
  liveClassId: { type: [String, Number], required: true },
  // Set when the modal is the "End class" confirmation. On confirm it first
  // uploads the recording (if a file was chosen), then calls this to end the
  // class. Without it the modal is the standalone "Save class recording" dialog.
  endClassFn: { type: Function, default: null },
  // A browser recording (the Record button) that is still running. On confirm
  // it is stopped via stopRecordingFn, which resolves to the finished File
  // (already downloaded) or null; that file then goes through the normal
  // upload below, in place of an OBS file.
  recordingActive: { type: Boolean, default: false },
  stopRecordingFn: { type: Function, default: null },
});

const emit = defineEmits(['cancel']);
const isEndMode = computed(() => !!props.endClassFn);

const router = useRouter();

const AUTO_CLOSE_MS = 2000;
const STAGE_END = 'Ending class…';
const STAGE_FINISH = 'Finishing recording…';

const liveClass = ref({});
const title = ref('');
const file = ref(null);
const fileInputEl = ref(null);
const fileError = ref('');
const busy = ref(false);
const stage = ref('');
const progress = ref(0);
const error = ref('');
const uploadFailed = ref(false);
const done = ref(false);
const saveState = {};   // lessonId / uploaded / linked — lets a retry resume
const fromRecording = ref(false);
let closeTimer = null;

const uploadingVideo = computed(() => stage.value === STAGE_UPLOAD);

// The browser recording stands in for the OBS file, running or already stopped.
const usingBrowserRecording = computed(() => isEndMode.value && (props.recordingActive || fromRecording.value));

const canSubmit = computed(() => {
  if (busy.value) return false;
  const hasRecording = !!file.value || props.recordingActive;
  return (!hasRecording || !!title.value) && (isEndMode.value || !!file.value);
});

const submitLabel = computed(() => {
  if (busy.value) {
    if (stage.value === STAGE_END) return 'Ending…';
    return stage.value === STAGE_FINISH ? 'Finishing…' : 'Saving recording…';
  }
  if (uploadFailed.value) return 'Retry upload';
  return isEndMode.value ? 'End class' : 'Save to course';
});

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
  router.push(`/lessons/${saveState.lessonId}`);
}

// Check the type the moment a file is picked, not when the upload fails.
function clearFile() {
  file.value = null;
  fromRecording.value = false;
  if (fileInputEl.value) fileInputEl.value.value = '';
}

function onFile(e) {
  const picked = e.target.files?.[0] || null;
  fileError.value = '';
  error.value = '';
  uploadFailed.value = false;
  saveState.uploaded = false; // a different file needs uploading again
  if (picked && !isSupportedVideoFile(picked)) {
    clearFile();
    fileError.value = `"${picked.name}" isn't a supported video. Use MP4, MOV, WebM, M4V or MKV.`;
    return;
  }
  file.value = picked;
}

const uploadRecording = () => saveRecordingToCourse({
  courseId: liveClass.value.course_id,
  liveClassId: props.liveClassId,
  title: title.value,
  file: file.value,
  state: saveState,
  onStage: (st) => { stage.value = st; },
  onProgress: (pct) => { progress.value = pct; },
});

// Upload first; the class is only ended once the recording is safely saved.
async function submit() {
  error.value = '';
  uploadFailed.value = false;
  busy.value = true;
  try {
    if (props.recordingActive && props.stopRecordingFn && !file.value) {
      stage.value = STAGE_FINISH;
      fromRecording.value = true;   // keep the "browser recording" note up while it finishes
      try {
        file.value = await props.stopRecordingFn();
        fromRecording.value = !!file.value;
        saveState.uploaded = false;
      } catch (err) {
        fromRecording.value = false;
        error.value = `Couldn't finish the recording: ${err.message || 'unknown error'}. You can still end the class and upload an OBS file instead.`;
        return;
      }
    }
    if (file.value) {
      try {
        await uploadRecording();
      } catch (err) {
        error.value = err.response?.data?.error || err.message || 'Upload failed';
        uploadFailed.value = true;
        return;
      }
    }
    if (isEndMode.value) {
      stage.value = STAGE_END;
      await props.endClassFn();
    }
    if (file.value) {
      done.value = true;
      closeTimer = setTimeout(finish, AUTO_CLOSE_MS);
    } else {
      finish();
    }
  } catch (err) {
    error.value = err.message || 'Could not end the class';
  } finally {
    busy.value = false;
  }
}

// After a failed upload: give up on the recording and end the class anyway.
async function endWithoutRecording() {
  clearFile();
  fileError.value = '';
  await submit();
}
</script>

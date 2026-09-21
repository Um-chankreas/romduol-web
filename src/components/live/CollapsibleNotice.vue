<template>
  <div v-if="message">
    <div
      v-if="!collapsed"
      :role="role"
      class="flex items-start gap-2.5 max-w-xl rounded-lg border border-amber-500/30 bg-slate-900/95 backdrop-blur text-amber-200 text-xs md:text-sm pl-3 pr-2 py-2 shadow-lg"
    >
      <span class="shrink-0 leading-5" aria-hidden="true">⚠️</span>
      <span class="flex-1 leading-5">{{ message }}</span>
      <button
        type="button"
        class="shrink-0 h-5 w-5 grid place-items-center rounded text-amber-300 hover:text-white hover:bg-white/10 cursor-pointer"
        aria-label="Minimise"
        title="Minimise"
        @click="collapse"
      >–</button>
      <button
        type="button"
        class="shrink-0 h-5 w-5 grid place-items-center rounded text-amber-300 hover:text-white hover:bg-white/10 cursor-pointer"
        aria-label="Dismiss"
        title="Dismiss"
        @click="emit('dismiss')"
      >✕</button>
    </div>

    <div
      v-else
      class="inline-flex items-center rounded-full border border-amber-500/40 bg-slate-900/90 backdrop-blur text-amber-200 text-[11px] shadow-md overflow-hidden"
    >
      <button
        type="button"
        class="flex items-center gap-1.5 pl-2.5 pr-2 py-1 hover:bg-white/10 cursor-pointer"
        :title="message"
        aria-label="Show notice"
        @click="expand"
      >
        <span aria-hidden="true">⚠️</span>
        <span class="font-semibold">{{ label }}</span>
      </button>
      <button
        type="button"
        class="pl-1 pr-2 py-1 text-amber-300 hover:text-white hover:bg-white/10 cursor-pointer"
        aria-label="Dismiss"
        title="Dismiss"
        @click="emit('dismiss')"
      >✕</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';

// A warning that shows in full for a few seconds, then shrinks to a small pill
// (so it never permanently costs screen space). The pill re-expands on click;
// either form can be dismissed.
const props = defineProps({
  message: { type: String, default: '' },
  label: { type: String, default: 'Notice' },
  role: { type: String, default: 'status' },
  collapseAfter: { type: Number, default: 6000 },
});
const emit = defineEmits(['dismiss']);

const collapsed = ref(false);
let timer = null;

const clear = () => { clearTimeout(timer); timer = null; };
const arm = () => {
  clear();
  timer = setTimeout(() => { collapsed.value = true; }, props.collapseAfter);
};

function collapse() { clear(); collapsed.value = true; }
function expand() { collapsed.value = false; arm(); }

// A new (or changed) message always starts expanded.
watch(() => props.message, (m) => {
  if (m) { collapsed.value = false; arm(); } else { clear(); }
}, { immediate: true });

onBeforeUnmount(clear);
</script>

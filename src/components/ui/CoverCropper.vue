<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { X } from 'lucide-vue-next'

// Crops an image to a portrait book cover (3:4): drag to position, slider to
// zoom. Emits a JPEG Blob at 600x800, which is what the server accepts.
const props = defineProps({ file: { type: File, required: true } })
const emit = defineEmits(['done', 'cancel'])

const FRAME_W = 240
const FRAME_H = 320
const OUT_W = 600
const OUT_H = 800

const url = URL.createObjectURL(props.file)
onBeforeUnmount(() => URL.revokeObjectURL(url))

const img = ref(null)
const natW = ref(0)
const natH = ref(0)
const zoom = ref(1)
const x = ref(0)
const y = ref(0)
const error = ref('')

// "cover" fit: the smallest scale at which the image still fills the frame.
const minScale = computed(() => (natW.value ? Math.max(FRAME_W / natW.value, FRAME_H / natH.value) : 1))
const scale = computed(() => minScale.value * zoom.value)

const clamp = () => {
  x.value = Math.min(0, Math.max(FRAME_W - natW.value * scale.value, x.value))
  y.value = Math.min(0, Math.max(FRAME_H - natH.value * scale.value, y.value))
}

onMounted(() => {
  const probe = new Image()
  probe.onload = () => {
    natW.value = probe.naturalWidth
    natH.value = probe.naturalHeight
    x.value = (FRAME_W - natW.value * scale.value) / 2
    y.value = (FRAME_H - natH.value * scale.value) / 2
    img.value = url
  }
  probe.onerror = () => { error.value = 'That file could not be read as an image.' }
  probe.src = url
})

// Zoom around the frame centre so the picture doesn't jump.
const onZoom = (e) => {
  const before = scale.value
  const cx = (FRAME_W / 2 - x.value) / before
  const cy = (FRAME_H / 2 - y.value) / before
  zoom.value = Number(e.target.value)
  x.value = FRAME_W / 2 - cx * scale.value
  y.value = FRAME_H / 2 - cy * scale.value
  clamp()
}

let drag = null
const down = (e) => {
  drag = { px: e.clientX, py: e.clientY, x: x.value, y: y.value }
  e.currentTarget.setPointerCapture(e.pointerId)
}
const move = (e) => {
  if (!drag) return
  x.value = drag.x + (e.clientX - drag.px)
  y.value = drag.y + (e.clientY - drag.py)
  clamp()
}
const up = () => { drag = null }

const confirm = () => {
  const canvas = document.createElement('canvas')
  canvas.width = OUT_W
  canvas.height = OUT_H
  const ctx = canvas.getContext('2d')
  const image = new Image()
  image.onload = () => {
    ctx.drawImage(image, -x.value / scale.value, -y.value / scale.value,
      FRAME_W / scale.value, FRAME_H / scale.value, 0, 0, OUT_W, OUT_H)
    canvas.toBlob((blob) => {
      if (blob) emit('done', blob)
      else error.value = 'Could not export the cropped image.'
    }, 'image/jpeg', 0.88)
  }
  image.src = url
}
</script>

<template>
  <div class="absolute inset-0 z-10 bg-white dark:bg-slate-900 flex flex-col">
    <div class="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
      <h3 class="font-extrabold text-slate-900 dark:text-white">Crop cover</h3>
      <button type="button" @click="emit('cancel')" class="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"><X class="w-5 h-5" /></button>
    </div>

    <div class="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-5">
      <p class="text-xs text-slate-500 text-center">Drag to position the picture. Use the slider to zoom. The frame is the book's cover shape.</p>

      <div class="relative overflow-hidden rounded-r-xl rounded-l-md bg-slate-100 dark:bg-slate-800 shadow-lg touch-none select-none cursor-grab active:cursor-grabbing"
        :style="{ width: FRAME_W + 'px', height: FRAME_H + 'px' }"
        @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up">
        <img v-if="img" :src="img" draggable="false" alt=""
          class="absolute max-w-none pointer-events-none"
          :style="{ left: x + 'px', top: y + 'px', width: natW * scale + 'px', height: natH * scale + 'px' }" />
        <span class="absolute left-0 inset-y-0 w-2.5 bg-[#006A3A]/80 pointer-events-none" />
        <span class="absolute top-0 inset-x-0 h-1 bg-[#ffce04] pointer-events-none" />
      </div>

      <label class="w-full max-w-[240px] flex items-center gap-3 text-xs font-bold text-slate-500">
        Zoom
        <input type="range" min="1" max="3" step="0.01" :value="zoom" @input="onZoom" class="flex-1 accent-[#006A3A]" />
      </label>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    </div>

    <div class="px-6 py-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
      <button type="button" @click="emit('cancel')" class="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer">Cancel</button>
      <button type="button" :disabled="!img" @click="confirm"
        class="bg-[#006A3A] hover:bg-[#005A31] disabled:opacity-40 text-white text-sm font-bold py-2.5 px-6 rounded-xl shadow-sm cursor-pointer">Use this crop</button>
    </div>
  </div>
</template>

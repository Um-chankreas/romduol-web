<script setup>
import { computed } from 'vue'

// Our own icon set (src/assets/romduol). Every icon exists in several sets and
// at 1x/2x/3x; this picks the set and lets the browser choose the sharpest size.
//   line-dark   white line + yellow accent: for green / dark backgrounds
//   line-light  green line + yellow accent: for white / light backgrounds
// Icon names are the file names, e.g. 'home', 'class', 'lesson', 'settings'.
const props = defineProps({
  name: { type: String, required: true },
  // Which look to use. 'auto' = dark set normally, light set when `active`
  // (the sidebar's selected item sits on a white pill).
  set: { type: String, default: 'auto' },
  active: { type: Boolean, default: false },
  size: { type: Number, default: 26 },
})

const files = import.meta.glob('../../assets/romduol/*/*.png', { eager: true, import: 'default', query: '?url' })
const urlOf = (set, file) => files[`../../assets/romduol/${set}/${file}.png`] || null

const setName = computed(() => (props.set === 'auto' ? (props.active ? 'line-light' : 'line-dark') : props.set))
const src = computed(() => urlOf(setName.value, props.name))
const srcset = computed(() => {
  const x1 = src.value, x2 = urlOf(setName.value, `${props.name}@2x`), x3 = urlOf(setName.value, `${props.name}@3x`)
  return [x1 && `${x1} 1x`, x2 && `${x2} 2x`, x3 && `${x3} 3x`].filter(Boolean).join(', ')
})
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :srcset="srcset"
    :width="size"
    :height="size"
    alt=""
    aria-hidden="true"
    draggable="false"
    class="shrink-0 select-none object-contain"
    :style="{ width: size + 'px', height: size + 'px' }"
  />
  <span v-else class="shrink-0 inline-block" :style="{ width: size + 'px', height: size + 'px' }" aria-hidden="true"></span>
</template>

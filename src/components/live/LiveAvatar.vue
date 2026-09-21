<template>
  <img v-if="src && !broken" :src="src" :alt="name" :class="[shell, 'object-cover']" @error="broken = true" />
  <div
    v-else
    :class="[shell, tone ? '' : 'bg-[#016a36]', 'text-white font-bold flex items-center justify-center select-none overflow-hidden']"
    :style="tone ? { backgroundColor: tone } : null"
  >
    <template v-if="letter">{{ letter }}</template>
    <img v-else :src="brandLogo" alt="" class="w-1/2 h-1/2 object-contain" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import brandLogo from '@/assets/logo/RS_logo.png';

// Photo when there is one, otherwise a brand-green initials circle. Shared by
// the video tiles and the participants panel so both look the same.
const props = defineProps({
  name: { type: String, default: '' },
  src: { type: String, default: '' },
  size: { type: String, default: 'lg' },   // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  speaking: Boolean,                        // green glow while this person talks
  tone: { type: String, default: '' },      // per-person colour (Meet-style); default = brand green with a border
});

const SIZES = {
  xs: 'w-8 h-8 md:w-10 md:h-10 text-xs md:text-sm',
  sm: 'w-10 h-10 md:w-12 md:h-12 text-sm md:text-base',
  md: 'w-12 h-12 md:w-16 md:h-16 text-lg md:text-2xl',
  lg: 'w-16 h-16 md:w-24 md:h-24 text-2xl md:text-4xl',
  xl: 'w-24 h-24 md:w-36 md:h-36 text-4xl md:text-6xl',
};

const broken = ref(false);
watch(() => props.src, () => { broken.value = false; });

const letter = computed(() => (props.name || '').trim().charAt(0).toUpperCase());

const shell = computed(() => {
  const glow = props.speaking
    ? (props.size === 'xs'
      ? 'ring-2 ring-emerald-400/80 shadow-[0_0_12px_rgba(52,211,153,0.7)]'
      : 'ring-4 ring-emerald-400/70 shadow-[0_0_22px_rgba(52,211,153,0.75)]')
    : 'shadow-lg';
  const border = props.tone ? 'border-2 border-transparent' : 'border-2 border-[#016a36]';
  return `${SIZES[props.size] || SIZES.lg} rounded-full ${border} ${glow} transition-shadow duration-150 shrink-0`;
});
</script>

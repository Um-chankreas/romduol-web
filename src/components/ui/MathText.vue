<template>
  <span class="math-text" v-html="rendered"></span>
</template>

<script setup>
import { computed } from 'vue'
import { renderMathText } from '@/utils/mathText'

const props = defineProps({
  text: { type: String, default: '' }
})

const rendered = computed(() => renderMathText(props.text))
</script>

<style scoped>
.math-text :deep(.katex-display) {
  margin: 0.25em 0;
}
</style>

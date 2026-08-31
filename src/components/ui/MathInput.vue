<template>
  <div class="space-y-1.5">
    <div class="relative">
      <textarea
        v-if="multiline"
        ref="inputRef"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        :rows="rows"
        :placeholder="placeholder"
        :class="[inputClass, 'pr-9']"
      ></textarea>
      <input
        v-else
        ref="inputRef"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        type="text"
        :placeholder="placeholder"
        :class="[inputClass, 'pr-9']"
      />
      <button
        type="button"
        @click="toolbarOpen = !toolbarOpen"
        title="Insert math symbol"
        :class="[
          'absolute right-1.5 w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center transition cursor-pointer',
          multiline ? 'top-2' : 'top-1/2 -translate-y-1/2',
          toolbarOpen
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
        ]"
      >
        ∑
      </button>
    </div>

    <!-- Quick Math Toolbar -->
    <div
      v-if="toolbarOpen"
      class="flex items-center gap-1 flex-wrap p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
    >
      <button
        v-for="tool in mathTools"
        :key="tool.label"
        type="button"
        @mousedown.prevent="applyInsert(tool.build)"
        :title="tool.title"
        class="w-7 h-7 flex items-center justify-center rounded-md text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition cursor-pointer"
      >
        {{ tool.label }}
      </button>
      <span class="text-[10px] text-slate-400 ml-1">or wrap custom LaTeX in $...$</span>
    </div>

    <!-- Live Preview -->
    <div
      v-if="hasMath"
      class="px-3 py-2 rounded-lg bg-emerald-50/60 dark:bg-slate-800/60 border border-dashed border-emerald-200 dark:border-slate-700 overflow-x-auto"
    >
      <span class="text-[10px] font-bold uppercase tracking-wide text-emerald-700/70 dark:text-emerald-400/70 block mb-1">
        Preview
      </span>
      <MathText :text="modelValue" class="text-sm text-slate-800 dark:text-slate-100" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import MathText from './MathText.vue'
import { hasMathContent } from '@/utils/mathText'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  inputClass: { type: String, default: '' },
  multiline: { type: Boolean, default: false },
  rows: { type: [Number, String], default: 2 }
})

const emit = defineEmits(['update:modelValue'])

const inputRef = ref(null)
const toolbarOpen = ref(false)

const hasMath = computed(() => hasMathContent(props.modelValue))

const buildSqrt = (sel) => {
  const text = sel ? `$\\sqrt{${sel}}$` : '$\\sqrt{}$'
  const cursor = sel ? text.length : text.indexOf('{') + 1
  return { text, cursor }
}

const buildExponent = (sel) => {
  const text = sel ? `$${sel}^{}$` : '$x^{}$'
  return { text, cursor: text.lastIndexOf('{') + 1 }
}

const buildFraction = (sel) => {
  const text = sel ? `$\\frac{${sel}}{}$` : '$\\frac{}{}$'
  const cursor = sel ? text.lastIndexOf('{') + 1 : text.indexOf('{') + 1
  return { text, cursor }
}

const plainSymbol = (symbol) => () => ({ text: symbol, cursor: symbol.length })

const mathTools = [
  { label: '√', title: 'Square root', build: buildSqrt },
  { label: 'x²', title: 'Exponent', build: buildExponent },
  { label: '½', title: 'Fraction', build: buildFraction },
  { label: '×', title: 'Multiply', build: plainSymbol('×') },
  { label: '÷', title: 'Divide', build: plainSymbol('÷') },
  { label: '±', title: 'Plus / minus', build: plainSymbol('±') },
  { label: 'π', title: 'Pi', build: plainSymbol('π') },
  { label: '≤', title: 'Less than or equal', build: plainSymbol('≤') },
  { label: '≥', title: 'Greater than or equal', build: plainSymbol('≥') },
  { label: '∞', title: 'Infinity', build: plainSymbol('∞') }
]

const applyInsert = (build) => {
  const el = inputRef.value
  const current = props.modelValue || ''
  const start = el ? (el.selectionStart ?? current.length) : current.length
  const end = el ? (el.selectionEnd ?? current.length) : current.length
  const selected = current.slice(start, end)

  const { text, cursor } = build(selected)
  const next = current.slice(0, start) + text + current.slice(end)
  emit('update:modelValue', next)

  const newCursor = start + cursor
  requestAnimationFrame(() => {
    if (el) {
      el.focus()
      el.setSelectionRange(newCursor, newCursor)
    }
  })
}
</script>

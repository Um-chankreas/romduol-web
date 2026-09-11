<template>
  <div class="markdown-content" v-html="html"></div>
</template>

<script setup>
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps({
  source: { type: String, default: '' },
})

const html = computed(() => renderMarkdown(props.source))
</script>

<!--
  Not scoped: every rule is namespaced under `.markdown-content`, and the
  markup is injected with v-html (so scoped `data-v-` attributes wouldn't reach
  it without `:deep()` on every rule anyway). Dark mode follows the app's
  `.dark` class on <html> (see composables/useTheme.js).
-->
<style>
.markdown-content {
  /* Lesson content reads as a book — lead with the Khmer serif.
     Soft "ink" colours, deliberately below full black / full white so long
     reading is easy on the eyes. */
  font-family: 'Noto Serif Khmer', 'Khmer OS Siemreap', 'Khmer OS', 'Inter', Georgia, serif;
  font-size: 1rem;
  line-height: 1.95;
  color: #454b56;                 /* soft charcoal, not black */
  word-break: break-word;
  overflow-wrap: anywhere;
}
.dark .markdown-content {
  color: #b9c0cb;                 /* soft grey, not bright white */
}

.markdown-content p {
  margin: 0 0 1.1em;
}
.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4 {
  color: #2b303b;                 /* a touch darker than body, still not black */
  font-weight: 700;
  line-height: 1.4;
  margin: 1.6em 0 0.6em;
}
.dark .markdown-content h1,
.dark .markdown-content h2,
.dark .markdown-content h3,
.dark .markdown-content h4 {
  color: #dbe0e7;                 /* a touch brighter than body, not pure white */
}
.markdown-content h1 { font-size: 1.4rem; }
.markdown-content h2 { font-size: 1.2rem; }
.markdown-content h3 { font-size: 1.05rem; }
.markdown-content h4 { font-size: 0.98rem; }

/* Emphasis: keep the body colour, just heavier — never a near-background
   colour that could vanish in one theme. */
.markdown-content strong,
.markdown-content b {
  font-weight: 700;
  color: inherit;
}
.markdown-content em,
.markdown-content i {
  font-style: italic;
}

.markdown-content ul,
.markdown-content ol {
  margin: 0 0 1.1em;
  padding-left: 1.4em;
}
.markdown-content li { margin: 0.35em 0; }
.markdown-content ul { list-style: disc; }
.markdown-content ol { list-style: decimal; }

.markdown-content a {
  color: #047857;                 /* emerald-700 */
  text-decoration: underline;
  text-underline-offset: 2px;
}
.dark .markdown-content a {
  color: #34d399;                 /* emerald-400 */
}

.markdown-content blockquote {
  margin: 0 0 1.1em;
  padding: 0.4em 0 0.4em 1em;
  border-left: 3px solid #10b981;
  color: #475569;
}
.dark .markdown-content blockquote {
  color: #94a3b8;
}

.markdown-content hr {
  border: 0;
  border-top: 1px solid #e2e8f0;
  margin: 2em 0;
}
.dark .markdown-content hr {
  border-top-color: #1e293b;
}

.markdown-content code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.86em;
  background: #f1f5f9;
  padding: 0.12em 0.38em;
  border-radius: 5px;
}
.dark .markdown-content code {
  background: #1e293b;
}
.markdown-content pre {
  background: #f1f5f9;
  padding: 1em;
  border-radius: 10px;
  overflow-x: auto;
  margin: 0 0 1.1em;
}
.dark .markdown-content pre {
  background: #0f172a;
}
.markdown-content pre code {
  background: none;
  padding: 0;
}

.markdown-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 1.1em;
  font-size: 0.9em;
}
.markdown-content th,
.markdown-content td {
  border: 1px solid #e2e8f0;
  padding: 0.5em 0.7em;
  text-align: left;
}
.dark .markdown-content th,
.dark .markdown-content td {
  border-color: #1e293b;
}
.markdown-content th {
  background: #f8fafc;
  font-weight: 700;
}
.dark .markdown-content th {
  background: #0f172a;
}

/* Display math scrolls rather than blowing out the layout. */
.markdown-content .unit-math-block {
  margin: 1.3em 0;
  overflow-x: auto;
}
.markdown-content .katex-display {
  margin: 0;
}

.markdown-content img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1.3em auto;
  border-radius: 10px;
}

/* Placeholder left by the LaTeX importer where a TikZ / image figure was. */
.markdown-content .unit-figure-placeholder {
  display: flex;
  align-items: center;
  gap: 0.6em;
  margin: 1.3em 0;
  padding: 1.1em 1.2em;
  border: 1.5px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  color: #64748b;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.9em;
  line-height: 1.5;
}
.dark .markdown-content .unit-figure-placeholder {
  border-color: #334155;
  background: #0f172a;
  color: #94a3b8;
}
.markdown-content .unit-figure-placeholder__icon {
  font-size: 1.25em;
  line-height: 1;
}
</style>

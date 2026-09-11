import MarkdownIt from 'markdown-it'
import katex from 'katex'

// ─────────────────────────────────────────────────────────────────────────────
// Unit content is Markdown for every subject:
//   • history etc. → plain prose (## headings are split off server-side, so a
//     unit body is paragraphs, **bold**, `-` lists, `---` rules, links…)
//   • maths        → the same Markdown with LaTeX in $ … $ (inline) or
//     $$ … $$ (display)
//
// We render Markdown with markdown-it and the math with our own katex@0.18
// (the `markdown-it-katex` package bundles an ancient katby that its CSS no
// longer matches — don't reach for it).
// ─────────────────────────────────────────────────────────────────────────────

const renderKatex = (expr, displayMode) => {
  try {
    return katex.renderToString(expr, {
      throwOnError: false,
      displayMode,
      output: 'htmlAndMathml',
    })
  } catch {
    // Fall back to the raw source so a broken formula never blanks the page.
    const d = displayMode ? '$$' : '$'
    return md.utils.escapeHtml(`${d}${expr}${d}`)
  }
}

// Is the `$` at `pos` an escaped one (odd number of preceding backslashes)?
const isEscaped = (src, pos) => {
  let slashes = 0
  while (pos - slashes - 1 >= 0 && src[pos - slashes - 1] === '\\') slashes++
  return slashes % 2 === 1
}

// Inline rule: $ … $ and $$ … $$ on a single logical run.
const mathInline = (state, silent) => {
  const src = state.src
  let pos = state.pos
  if (src[pos] !== '$') return false

  const display = src[pos + 1] === '$'
  const open = display ? 2 : 1
  let scan = pos + open

  let close = -1
  while (scan < src.length) {
    const at = src.indexOf('$', scan)
    if (at === -1) break
    if (isEscaped(src, at)) { scan = at + 1; continue }
    if (display && src[at + 1] !== '$') { scan = at + 1; continue }
    close = at
    break
  }
  if (close === -1) return false

  const content = src.slice(pos + open, close).trim()
  if (!content) return false
  if (!display && /\r?\n/.test(content)) return false

  if (!silent) {
    const token = state.push('math_inline', 'math', 0)
    token.content = content
    token.markup = display ? '$$' : '$'
    token.meta = { display }
  }
  state.pos = close + (display ? 2 : 1)
  return true
}

// Block rule: a paragraph that is just $$ … $$ (delimiters may be on their own
// lines or share the opening / closing line).
const mathBlock = (state, startLine, endLine, silent) => {
  const startPos = state.bMarks[startLine] + state.tShift[startLine]
  let max = state.eMarks[startLine]
  if (startPos + 2 > max) return false
  if (state.src.slice(startPos, startPos + 2) !== '$$') return false

  let firstLineRest = state.src.slice(startPos + 2, max)
  let found = false
  let content = ''
  let nextLine = startLine

  // closing $$ on the opening line
  const inlineClose = firstLineRest.indexOf('$$')
  if (inlineClose !== -1) {
    content = firstLineRest.slice(0, inlineClose)
    found = true
  } else {
    content = firstLineRest + '\n'
    for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
      const from = state.bMarks[nextLine] + state.tShift[nextLine]
      const to = state.eMarks[nextLine]
      const line = state.src.slice(from, to)
      const at = line.indexOf('$$')
      if (at !== -1) {
        content += line.slice(0, at)
        found = true
        break
      }
      content += line + '\n'
    }
  }
  if (!found) return false
  if (silent) return true

  state.line = nextLine + 1
  const token = state.push('math_block', 'math', 0)
  token.block = true
  token.content = content.trim()
  token.map = [startLine, state.line]
  token.markup = '$$'
  return true
}

const mathPlugin = (mdInstance) => {
  mdInstance.inline.ruler.after('escape', 'math_inline', mathInline)
  mdInstance.block.ruler.after('blockquote', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })
  mdInstance.renderer.rules.math_inline = (tokens, i) =>
    renderKatex(tokens[i].content, !!tokens[i].meta?.display)
  mdInstance.renderer.rules.math_block = (tokens, i) =>
    `<p class="unit-math-block">${renderKatex(tokens[i].content, true)}</p>\n`
}

const md = new MarkdownIt({
  html: false,       // unit content is user-authored — never trust raw HTML
  linkify: true,
  breaks: false,
  typographer: false,
}).use(mathPlugin)

// A ```figure … ``` fence is a placeholder left by the LaTeX importer where a
// TikZ / \includegraphics figure was — its first line is the caption, the rest
// is the original source (kept so nothing is lost). Render a friendly box; the
// unit editor turns it into an "Upload image" slot.
const defaultFence =
  md.renderer.rules.fence ||
  ((tokens, i, options, env, self) => self.renderToken(tokens, i, options))
md.renderer.rules.fence = (tokens, i, options, env, self) => {
  const token = tokens[i]
  // `figure` = the manual "upload an image" placeholder; `figure-tikz` = a
  // TikZ figure not yet rendered (or one that failed to). Both render the
  // same way — the box is only ever seen mid-import, since latexToMarkdown's
  // renderPendingFigures() replaces `figure-tikz` before content is saved.
  if (/^figure(-tikz)?$/.test(token.info.trim().toLowerCase())) {
    const body = token.content.replace(/\n+$/, '')
    const nl = body.indexOf('\n')
    const caption = (nl === -1 ? body : body.slice(0, nl)).trim()
    return (
      `<div class="unit-figure-placeholder" role="img" aria-label="${md.utils.escapeHtml(caption)}">` +
      `<span class="unit-figure-placeholder__icon">📊</span>` +
      `<span>${md.utils.escapeHtml(caption || 'Figure — an image will be added here.')}</span>` +
      `</div>\n`
    )
  }
  return defaultFence(tokens, i, options, env, self)
}

// Open links in a new tab.
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, i, options, env, self) => self.renderToken(tokens, i, options))
md.renderer.rules.link_open = (tokens, i, options, env, self) => {
  tokens[i].attrSet('target', '_blank')
  tokens[i].attrSet('rel', 'noopener nofollow')
  return defaultLinkOpen(tokens, i, options, env, self)
}

// ── LaTeX / HTML-break normalisation ─────────────────────────────────────────
// Content is authored in a mix of conventions. Fold the common LaTeX
// delimiters ( \( \) inline, \[ \] display ) down to $ / $$, and turn <br>
// into a Markdown hard break, before Markdown parsing.
export function normalizeMath(src) {
  return String(src ?? '')
    .replace(/<br\s*\/?>/gi, '  \n')
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, x) => `$$${x.trim()}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, x) => `$${x.trim()}$`)
}

// LaTeX commands / sub-superscript syntax — used to spot a bare formula.
const LATEX_HINT =
  /\\(?:sqrt|frac|d?frac|pm|mp|cdot|times|div|sum|prod|int|lim|to|infty|left|right|text|mathbb|mathrm|vec|hat|bar|overline|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|phi|omega|le|ge|ne|approx|neq|leq|geq|rightarrow|Rightarrow)\b|[\^_]\{|\\[a-zA-Z]+\{|\\\\/

// A short field (a quiz option / answer) that is a bare LaTeX expression with
// no $ delimiters — wrap it so KaTeX renders it. Plain text is left alone.
export function autoWrapLatex(s) {
  const t = String(s ?? '').trim()
  if (!t || t.includes('$')) return normalizeMath(t)
  const norm = normalizeMath(t)
  if (norm !== t) return norm            // had \( … \) — already delimited now
  return LATEX_HINT.test(t) ? `$${t}$` : t
}

export function renderMarkdown(src) {
  if (!src) return ''
  return md.render(normalizeMath(src))
}

// Render a short string (option, answer, inline label) — math-aware, no
// wrapping <p>. Bare LaTeX expressions are auto-delimited.
export function renderInline(src) {
  if (src == null || src === '') return ''
  return md.renderInline(autoWrapLatex(src))
}

// Plain-text, math-stripped preview (mirrors the backend's toPreview()).
export function toPlainPreview(src, max = 200) {
  if (!src) return ''
  const text = String(src)
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    .replace(/[#>*_`~]|(?:^|\s)-(?=\s)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

// ─────────────────────────────────────────────────────────────────────────────
// LaTeX → Markdown (the flavour the LMS stores: prose + `$…$` / `$$…$$` math,
// `## ` unit headings, `-` / `1.` lists, `> ` call-outs, pipe tables).
//
// This is NOT a real LaTeX engine — it handles the subset teachers paste from
// Overleaf / a .tex file: a `\documentclass … \begin{document} … \end{document}`
// wrapper, `tcolorbox` / `center` / `itemize` / `enumerate` / `tabular`,
// `\section*`, `\textbf`, `{\Large …}`, `\(…\)` / `\[…\]`, Khmer `\kh` font
// switches, `\\` breaks, `\vspace`, comments, …
//
// Anything it doesn't recognise is stripped to its text with a warning, so the
// teacher can review the Markdown before saving.
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_ENV = 'tcolorbox|mdframed|framed|quote|quotation|shadowbox|center|itemize|enumerate|description|tabular|tabularx|array|longtable|align|align\\*|equation|equation\\*|displaymath|multline|multline\\*|gather|gather\\*|alignat|alignat\\*|flalign|flalign\\*|aligned|gathered|split|cases|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|smallmatrix|document'

/** Quick check: does this look like a whole LaTeX document rather than Markdown? */
export function isLatexDocument(src) {
  const s = String(src || '')
  if (/^\s{0,3}#{1,3}\s/m.test(s.slice(0, 400))) return false // a Markdown heading up top
  return /\\documentclass\b|\\begin\s*\{document\}|\\section\s*\*?\s*\{|\\textbf\s*\{|\\begin\s*\{(?:tcolorbox|itemize|enumerate|tabular|align|equation)\}/.test(s)
}

// Pull every $…$ / $$…$$ span out to an opaque token so the prose-level
// cleanup can't touch the maths. Restored right before returning.
function stashMath(s, store) {
  return s
    // Display math kept on ONE line — the mobile reader renders content
    // line-by-line, so a `$$…\n…$$` block would be torn apart. `\\` stays as
    // the row separator inside aligned/gathered.
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, x) => tok(store, `$$${x.replace(/\s*\n\s*/g, ' ').trim()}$$`))
    .replace(/\$([^$\n]+?)\$/g, (_, x) => tok(store, `$${x.trim()}$`))
}
function tok(store, value) {
  store.push(value)
  return `@@M${store.length - 1}@@`
}
function restoreMath(s, store) {
  return s.replace(/@@M(\d+)@@/g, (_, i) => store[Number(i)] ?? '')
}

// btoa/atob are ASCII-only — go via UTF-8 percent-encoding so Khmer text
// inside a figure's TikZ source (or an SVG's embedded labels) round-trips.
function encodeBase64Utf8(str) {
  return btoa(unescape(encodeURIComponent(str)))
}
function decodeBase64Utf8(b64) {
  try {
    return decodeURIComponent(escape(atob(b64)))
  } catch {
    return atob(b64)
  }
}

// Inline / leaf LaTeX → Markdown. Runs on math-free text only.
function cleanInline(input) {
  let s = String(input)

  // argument-less font / series / shape switches
  s = s.replace(/\\(?:kh|khmerfont|normalfont|rmfamily|sffamily|ttfamily|bfseries|itshape|mdseries|upshape|scshape|selectfont|par|noindent|centering|raggedright|raggedleft|displaystyle|textstyle|protect|leavevmode|null)\b/g, ' ')

  // A size switch stuck directly onto the next command / group, e.g.
  // `{\Large\textbf{X}}` or `\LARGE\section{…}` — drop it so the command it
  // hugs is handled cleanly (otherwise `\textbf` matches but the leftover
  // `\Large` mangles the `**` markers).
  s = s.replace(/\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)(?=\s*[\\{])/g, '')

  // emphasis / verbatim (before sizing so `{\Large \textbf{X}}` collapses).
  // The content is flattened to one line — a `\\` or newline inside would
  // otherwise break the `**`/`*` across lines and render the markers raw.
  const oneLine = (x) => x.replace(/\s*(?:\\\\(?:\[[^\]]*\])?|\n)\s*/g, ' ').replace(/ {2,}/g, ' ').trim()
  s = s
    .replace(/\\textbf\s*\{\s*\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\s+([^{}]*?)\s*\}/g, (_, x) => `**${oneLine(x)}**`)
    .replace(/\\textbf\s*\{\s*([^{}]*?)\s*\}/g, (_, x) => `**${oneLine(x)}**`)
    .replace(/\\(?:textit|emph|textsl)\s*\{\s*([^{}]*?)\s*\}/g, (_, x) => `*${oneLine(x)}*`)
    .replace(/\\(?:underline|texttt|textsc|textrm|textnormal|textup|mbox|text|fbox|framebox|boxed)\s*\{([^{}]*)\}/g, '$1')

  // Markdown emphasis can't wrap a formula in the mobile reader (its math
  // spans are extracted before `**` is parsed) — drop `**`/`*` around any run
  // that contains a stashed math token.
  s = s
    .replace(/\*\*([^*\n]*@@M\d+@@[^*\n]*)\*\*/g, '$1')
    .replace(/\*([^*\n]*@@M\d+@@[^*\n]*)\*/g, '$1')

  // sizing groups: {\Large …} → keep the inner text (a few passes for nesting)
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\{\s*\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\s+([^{}]*)\}/g, '$1')
  }

  // line break: `\\` or `\\[1em]` → Markdown hard break
  s = s.replace(/\\\\\s*(?:\[[^\]]*\])?/g, '  \n')

  // spacing / rules / cross-refs — drop
  s = s
    .replace(/\\(?:vspace|hspace|vskip|hskip|addvspace)\*?\s*\{[^}]*\}/g, '')
    .replace(/\\(?:smallskip|medskip|bigskip|hrule|hfill|vfill|hrulefill|dotfill|newpage|clearpage|pagebreak|linebreak|nolinebreak|hline|toprule|midrule|bottomrule)\b/g, '')
    .replace(/\\(?:label|ref|eqref|pageref|cite|footnote|index)\s*\{[^}]*\}/g, '')

  // escaped specials & spacing macros
  s = s
    .replace(/\\([%&#_$~^\\{}])/g, '$1')
    .replace(/\\[,;:!]/g, ' ')
    .replace(/\\(?:quad|qquad|thinspace|space)\b/g, ' ')
    .replace(/\\ /g, ' ')
    .replace(/~/g, ' ')
    .replace(/``|''/g, '"')
    .replace(/\\LaTeX\b/g, 'LaTeX')
    .replace(/\\TeX\b/g, 'TeX')

  // leftover unknown commands: `\cmd{a}` → a, then bare `\cmd` → gone
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\\[a-zA-Z@]+\s*\{([^{}]*)\}/g, '$1')
  }
  s = s.replace(/\\[a-zA-Z@]+\*?/g, '')

  // stray grouping braces, tidy runs of spaces (but keep the `  \n` hard break)
  s = s.replace(/[{}]/g, '').replace(/ {2,}(?!\n)/g, ' ')

  return s
}

function listify(env, body) {
  const ordered = /^enum/.test(env)
  const parts = body.split(/\\item\b/).slice(1) // drop text before the first \item
  const lines = parts.map((raw, i) => {
    let text = raw.trim()
    let label = ''
    const m = text.match(/^\[([^\]]*)\]\s*([\s\S]*)$/)
    if (m) { label = cleanInline(m[1]).trim(); text = m[2] }
    text = cleanInline(text).replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ').trim()
    const marker = ordered ? `${i + 1}.` : '-'
    return `${marker} ${label ? label + ' ' : ''}${text}`.trimEnd()
  })
  return `\n\n${lines.join('\n')}\n\n`
}

function tabularToBlock(body) {
  const rows = body
    .split(/\\\\\s*(?:\[[^\]]*\])?/)
    .map(r => r.replace(/\\(?:hline|toprule|midrule|bottomrule)\b/g, '').trim())
    .filter(Boolean)
  const cells = rows.map(r => r.split('&').map(c => cleanInline(c).replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ').trim()))
  if (cells.length === 0) return ''

  // A single row of "side by side" items → a bullet list (the common case).
  if (cells.length === 1) return `\n\n${cells[0].map(c => `- ${c}`).join('\n')}\n\n`

  // Multi-row → a Markdown pipe table (first row is the header).
  const ncol = Math.max(...cells.map(c => c.length))
  const pad = (c) => { const out = c.slice(); while (out.length < ncol) out.push(''); return out }
  const rowsMd = [
    `| ${pad(cells[0]).join(' | ')} |`,
    `| ${Array(ncol).fill('---').join(' | ')} |`,
    ...cells.slice(1).map(c => `| ${pad(c).join(' | ')} |`),
  ]
  return `\n\n${rowsMd.join('\n')}\n\n`
}

// KaTeX has no Khmer metrics, so `\text{…ខ្មែរ…}` at the start of a display
// equation renders as gaps. Lift such a prefix out to plain text.
function hoistLeadingText(body) {
  const m = body.match(/^\s*(?:\\(?:text|mbox|textrm|intertext)\s*\{([^{}]*)\})\s*/)
  if (m && /[ក-៿]/.test(m[1] || '')) {
    return { lead: `${m[1].trim()}\n\n`, rest: body.slice(m[0].length) }
  }
  return { lead: '', rest: body }
}

function blockquotify(body, math) {
  // The body may already contain converted lists / tables (nested envs are
  // handled before wrappers) — clean the prose but keep those lines.
  const cleaned = cleanInline(body).replace(/\n{3,}/g, '\n\n').trim()
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return ''

  // A box whose whole content is one formula (often **\Large \(…\)**) → show
  // it as a centred display equation, not a quote.
  const only = lines.join(' ').replace(/\*+/g, '').trim()
  const m = only.match(/^@@M(\d+)@@$/)
  if (m && math) {
    const expr = String(math[Number(m[1])] || '').replace(/^\$+|\$+$/g, '').trim()
    return `\n\n${tok(math, `$$${expr}$$`)}\n\n`
  }

  // Structured content (a table, a list, a standalone display equation) reads
  // badly inside a `> ` quote — emit it as normal blocks, with the blank
  // lines Markdown needs before a table / list.
  if (lines.some(l => /^\|.*\|$/.test(l) || /^[-*]\s/.test(l) || /^\d+\.\s/.test(l) || /^@@M\d+@@$/.test(l))) {
    const out = cleaned
      .replace(/([^\n|])\n(\|)/g, '$1\n\n$2')
      .replace(/([^\n\-*|\d])\n([-*] |\d+\. )/g, '$1\n\n$2')
    return `\n\n${out}\n\n`
  }
  return `\n\n${lines.map(l => `> ${l}`).join('\n')}\n\n`
}

/**
 * @param {string} input  raw LaTeX
 * @returns {{ markdown: string, warnings: string[] }}
 */
export function latexToMarkdown(input) {
  const warnings = []
  let s = String(input || '').replace(/\r\n/g, '\n')

  // 1. Keep only the document body.
  const doc = s.match(/\\begin\s*\{document\}([\s\S]*?)\\end\s*\{document\}/)
  if (doc) s = doc[1]
  else s = s.replace(/^[\s\S]*?\\begin\s*\{document\}/, '')

  // 2. Strip comments (`%` … EOL, but not `\%`).
  s = s.replace(/(^|[^\\])%.*$/gm, '$1')

  // 3. Drop declarations that can also appear in the body.
  s = s
    .replace(/\\(?:newfontfamily|newcommand|renewcommand|providecommand|newcolumntype|newtcolorbox|newtheorem|setlength|setmainfont|newenvironment|definecolor)\b[^\n]*/g, '')
    .replace(/\\(?:documentclass|usepackage)\b(?:\[[^\]]*\])?\s*\{[^}]*\}/g, '')

  // 3b. `\\[1em]` / `\\[0.6em]` is a line break WITH spacing — collapse to a
  //     plain `\\` first so its `[…]` can't be mistaken for `\[ … \]` math.
  s = s.replace(/\\\\\s*\[[^\]]*\]/g, '\\\\ ')

  // 4. Math delimiters → `$` / `$$`, then stash every span.
  const math = []
  s = s
    .replace(/(^|[^\\])\\\[([\s\S]*?)\\\]/g, (_, pre, x) => `${pre}\n\n$$${x.trim()}$$\n\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, x) => `$${x.replace(/\s+/g, ' ').trim()}$`)
    .replace(/\\begin\s*\{(equation\*?|displaymath|multline\*?)\}([\s\S]*?)\\end\s*\{\1\}/g,
      (_, env, b) => { const { lead, rest } = hoistLeadingText(b); return `\n\n${lead}$$${rest.trim()}$$\n\n` })
    // align / gather use `&` alignment — KaTeX needs the *ed environment
    .replace(/\\begin\s*\{(align\*?|alignat\*?|gather\*?|flalign\*?)\}([\s\S]*?)\\end\s*\{\1\}/g,
      (_, env, b) => {
        const inner = /^gather/.test(env) ? 'gathered' : 'aligned'
        const { lead, rest } = hoistLeadingText(b)
        return `\n\n${lead}$$\\begin{${inner}}${rest.trim()}\\end{${inner}}$$\n\n`
      })
  s = stashMath(s, math)

  // 5. Block environments → Markdown. Structural envs (lists, tables) are
  //    converted FIRST and repeatedly, so a wrapper like `tcolorbox` that
  //    contains them sees Markdown, not raw `\begin{tabular}`.
  // TikZ / pgfplots pictures are rendered server-side to real diagrams (see
  // renderPendingFigures() below) — a `figure-tikz` fence carries the caption
  // + the original source (base64, single line) so that async pass can turn
  // it into `![…](data:image/svg+xml;…)`. `\includegraphics` has no source to
  // render, so it stays a one-line `figure` placeholder the teacher fills in
  // by uploading an image (see UnitsManager.vue). `figure` / `wrapfigure`
  // wrappers and a `\caption{…}` are unwrapped to a caption line above.
  s = s.replace(
    /\\begin\s*\{(figure|wrapfigure|figure\*)\}\s*(?:\[[^\]]*\]|\{[^{}]*\})*([\s\S]*?)\\end\s*\{\1\}/g,
    (_, env, b) => `\n\n${b.trim()}\n\n`,
  )
  const figurePlaceholder = (caption) =>
    `\n\n${tok(math, '```figure\n' + (caption || 'Diagram — upload an image to replace this placeholder.').replace(/\s+/g, ' ').trim() + '\n```')}\n\n`
  const figureTikzPlaceholder = (caption, texSource) =>
    `\n\n${tok(math, '```figure-tikz\n' + caption.replace(/\s+/g, ' ').trim() + '\n' + encodeBase64Utf8(texSource) + '\n```')}\n\n`
  s = s.replace(
    /(?:\\begin\s*\{center\}\s*)?\\begin\s*\{(tikzpicture|pgfpicture|axis)\}([\s\S]*?)\\end\s*\{\1\}(?:\s*\\end\s*\{center\})?/g,
    (_, env, body) => {
      warnings.push('A TikZ/plot figure will be rendered automatically.')
      // The body may hold stashed @@M…@@ math tokens — put those back so the
      // kept source is real LaTeX, collapsed to single newlines (blank lines
      // aren't meaningful in TikZ, and every reader here treats a blank line
      // as a new paragraph, so the fence must not contain one).
      const source = restoreMath(`\\begin{${env}}${body}\\end{${env}}`, math).replace(/\n{2,}/g, '\n').trim()
      return figureTikzPlaceholder('Diagram (from a TikZ/plot figure)', source)
    },
  )
  // A leftover \caption{…} (its figure wrapper is gone) → an italic caption line.
  s = s.replace(/\\caption\s*\{([^{}]*)\}/g, (_, x) => `\n\n*${x.trim()}*\n\n`)
  s = s.replace(/\\includegraphics\b(?:\[[^\]]*\])?\s*\{([^{}]*)\}/g, (_, p) => {
    warnings.push('An \\includegraphics image became a placeholder — upload the image to the unit.')
    return figurePlaceholder(`Image "${p.trim()}" — upload it to replace this placeholder.`)
  })
  const listRe = /\\begin\s*\{(itemize|enumerate|description)\}([\s\S]*?)\\end\s*\{\1\}/g
  // column spec can nest one level of braces, e.g. {p{6cm} p{4cm}} or {@{}l l@{}}
  const tabRe = /\\begin\s*\{(tabular\*?|tabularx|array|longtable)\}\s*(?:\{(?:[^{}]|\{[^{}]*\})*\}|\[[^\]]*\])+([\s\S]*?)\\end\s*\{\1\}/g
  for (let i = 0; i < 5; i++) {
    const before = s
    s = s
      .replace(listRe, (_, env, b) => listify(env, b))
      .replace(tabRe, (_, env, b) => tabularToBlock(b))
    if (s === before) break
  }

  s = s.replace(/\\begin\s*\{(tcolorbox|mdframed|framed|quote|quotation|shadowbox)\}\s*(?:\[[^\]]*\])?([\s\S]*?)\\end\s*\{\1\}/g,
    (_, env, b) => blockquotify(b, math))
  s = s.replace(/\\begin\s*\{center\}([\s\S]*?)\\end\s*\{center\}/g, (_, b) => `\n\n${b.trim()}\n\n`)

  // Any environment still left → keep its text, warn once.
  s = s.replace(/\\begin\s*\{([a-zA-Z*]+)\}\s*(?:\[[^\]]*\])?([\s\S]*?)\\end\s*\{\1\}/g, (_, env, b) => {
    if (!new RegExp(`^(?:${KNOWN_ENV})$`).test(env)) warnings.push(`"${env}" isn’t supported — kept its text only.`)
    return `\n\n${b.trim()}\n\n`
  })

  // 6. Sectioning → headings (`## ` also starts a new unit on save).
  s = s
    .replace(/\\section\s*\*?\s*\{([^{}]*)\}/g, (_, x) => `\n\n## ${x.trim()}\n\n`)
    .replace(/\\subsection\s*\*?\s*\{([^{}]*)\}/g, (_, x) => `\n\n### ${x.trim()}\n\n`)
    .replace(/\\(?:subsubsection|paragraph)\s*\*?\s*\{([^{}]*)\}/g, (_, x) => `\n\n#### ${x.trim()}\n\n`)

  // 7. Everything else.
  s = cleanInline(s)

  // 8. Restore maths, tidy whitespace.
  s = restoreMath(s, math)
  s = s
    .replace(/\t/g, ' ')
    .replace(/ +\n/g, (m) => (m.length >= 3 ? '  \n' : '\n')) // keep hard breaks (2+ trailing spaces)
    .replace(/^[ ]+$/gm, '')
    .replace(/^ +(?![-*] |\d+\. )/gm, '') // drop stray line indents, keep list markers
    .replace(/[ ]{2,}(?!\n)/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { markdown: s, warnings: [...new Set(warnings)] }
}

const FIGURE_TIKZ_RE = /```figure-tikz\n([^\n]*)\n([^\n]*)\n```/g

/**
 * Finds every `figure-tikz` placeholder latexToMarkdown() left for a TikZ /
 * pgfplots figure and renders it via `renderFn(texSource) => Promise<dataUrl>`
 * (POST /api/units/render-tikz — see unitService.renderTikzFigure, which
 * rasterizes to a `data:image/png;…` URL server-side: markdown-it's link
 * validator rejects `data:image/svg+xml`), embedding it as `![caption](url)`.
 *
 * A figure that fails to render (unsupported package, a syntax error
 * node-tikzjax can't parse, the request failing) falls back to the same
 * one-line `figure` placeholder `\includegraphics` gets, so the teacher can
 * still add it by hand instead of the raw fence surviving into saved content.
 */
export async function renderPendingFigures(markdown, renderFn) {
  const src = String(markdown || '')
  const re = new RegExp(FIGURE_TIKZ_RE.source, 'g')
  let out = ''
  let lastIndex = 0
  let rendered = 0
  let failed = 0
  let m
  while ((m = re.exec(src)) !== null) {
    out += src.slice(lastIndex, m.index)
    lastIndex = m.index + m[0].length
    const caption = m[1].trim()
    const texSource = decodeBase64Utf8(m[2])
    try {
      const dataUrl = await renderFn(texSource)
      if (!dataUrl) throw new Error('No image returned')
      out += `![${caption.replace(/[[\]]/g, '')}](${dataUrl})`
      rendered++
    } catch {
      out += '```figure\n' + caption + ' — upload an image to replace this.\n```'
      failed++
    }
  }
  out += src.slice(lastIndex)
  return { markdown: out, rendered, failed }
}

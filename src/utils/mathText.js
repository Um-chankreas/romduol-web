import katex from 'katex'

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Fold \( \) / \[ \] LaTeX delimiters (and <br>) so this renderer, which
// only scans for $ … $ / $$ … $$, still catches them.
function normalize(input) {
  return String(input ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, x) => `$$${x.trim()}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, x) => `$${x.trim()}$`)
}

// Renders a string that mixes plain text with LaTeX math delimited by
// $$...$$ (display mode) or $...$ (inline mode) into safe HTML.
export function renderMathText(rawInput) {
  if (!rawInput) return ''
  const input = normalize(rawInput)

  const regex = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g
  let lastIndex = 0
  let match
  const parts = []

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      parts.push(escapeHtml(input.slice(lastIndex, match.index)))
    }

    const displayExpr = match[1]
    const inlineExpr = match[2]
    const expr = displayExpr !== undefined ? displayExpr : inlineExpr

    try {
      parts.push(
        katex.renderToString(expr, {
          throwOnError: false,
          displayMode: displayExpr !== undefined
        })
      )
    } catch {
      parts.push(escapeHtml(match[0]))
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < input.length) {
    parts.push(escapeHtml(input.slice(lastIndex)))
  }

  return parts.join('')
}

export function hasMathContent(input) {
  return /\$[^$\n]+\$|\\\(|\\\[/.test(input || '')
}

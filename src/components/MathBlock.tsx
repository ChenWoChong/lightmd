import katex from 'katex'

function renderMath(tex: string, displayMode: boolean) {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: false,
      output: 'htmlAndMathml',
    })
  } catch {
    return null
  }
}

export function MathBlock({ tex }: { tex: string }) {
  const html = renderMath(tex, true)
  if (!html) return <pre className="math-error">{tex}</pre>
  return <div className="math-display" dangerouslySetInnerHTML={{ __html: html }} />
}

export function MathInline({ tex }: { tex: string }) {
  const html = renderMath(tex, false)
  if (!html) return <code>{tex}</code>
  return <span className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />
}

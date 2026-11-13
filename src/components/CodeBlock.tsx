import { useEffect, useState } from 'react'
import { Check, Copy, WrapText } from 'lucide-react'
import { copyText } from '../lib/clipboard'
import { highlightCode } from '../lib/highlighter'
import type { Theme } from '../types'

interface CodeBlockProps {
  code: string
  language: string
  theme: Theme
}

const languageNames: Record<string, string> = {
  bash: 'Bash',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  css: 'CSS',
  diff: 'Diff',
  dockerfile: 'Dockerfile',
  go: 'Go',
  html: 'HTML',
  java: 'Java',
  javascript: 'JavaScript',
  json: 'JSON',
  jsx: 'JSX',
  kotlin: 'Kotlin',
  markdown: 'Markdown',
  php: 'PHP',
  python: 'Python',
  ruby: 'Ruby',
  rust: 'Rust',
  sql: 'SQL',
  swift: 'Swift',
  text: 'Text',
  toml: 'TOML',
  ts: 'TypeScript',
  tsx: 'TSX',
  typescript: 'TypeScript',
  xml: 'XML',
  yaml: 'YAML',
}

function languageLabel(language: string) {
  const key = language.toLowerCase()
  return languageNames[key] ?? language ?? 'Text'
}

export function CodeBlock({ code, language, theme }: CodeBlockProps) {
  const [rendered, setRendered] = useState<{ key: string; html: string } | null>(null)
  const [wrap, setWrap] = useState(false)
  const [copied, setCopied] = useState(false)
  const key = `${theme}\u0000${language}\u0000${code}`
  const html = rendered?.key === key ? rendered.html : ''

  useEffect(() => {
    let cancelled = false
    void highlightCode(code, language, theme)
      .then((result) => {
        if (!cancelled) setRendered({ key, html: result })
      })
      .catch(() => {
        if (!cancelled) setRendered({ key, html: '' })
      })
    return () => {
      cancelled = true
    }
  }, [code, language, theme, key])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleCopy = () => {
    void copyText(code).then(() => setCopied(true))
  }

  return (
    <div className="code-block" data-language={language}>
      <div className="code-block__header">
        <span className="code-block__lang">{languageLabel(language)}</span>
        <div className="code-block__actions">
          <button
            type="button"
            className="icon-button"
            data-active={wrap}
            onClick={() => setWrap((value) => !value)}
            aria-label={wrap ? '取消自动换行' : '自动换行'}
            title={wrap ? '取消自动换行' : '自动换行'}
          >
            <WrapText />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={handleCopy}
            aria-label="复制代码"
            title="复制代码"
          >
            {copied ? <Check /> : <Copy />}
          </button>
        </div>
      </div>
      <div className="code-block__body" data-wrap={wrap}>
        {html ? (
          <div className="shiki-host" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre>
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  )
}

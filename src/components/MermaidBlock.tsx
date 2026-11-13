import { useEffect, useRef, useState } from 'react'
import { mount, type Mounted } from 'pele'
import { Check, Copy, Eye, EyeOff, TriangleAlert } from 'lucide-react'
import { copyText } from '../lib/clipboard'
import type { Theme } from '../types'

interface MermaidBlockProps {
  code: string
  theme: Theme
}

export function MermaidBlock({ code, theme }: MermaidBlockProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [renderState, setRenderState] = useState<{
    code: string
    error: string | null
    ready: boolean
  }>({ code, error: null, ready: false })
  const [showSource, setShowSource] = useState(false)
  const [copied, setCopied] = useState(false)
  const error = renderState.code === code ? renderState.error : null
  const ready = renderState.code === code && renderState.ready

  useEffect(() => {
    if (showSource) return

    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let instance: Mounted | undefined

    host.replaceChildren()

    try {
      instance = mount(host, code, {
        links: false,
        images: false,
        zoom: false,
        autoDirection: false,
        responsive: true,
        onRender: () => {
          if (!cancelled) setRenderState({ code, error: null, ready: true })
        },
        onError: (reason) => {
          if (!cancelled) {
            setRenderState({
              code,
              error: reason instanceof Error ? reason.message : '图表渲染失败',
              ready: false,
            })
          }
        },
      })
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '图表渲染失败'
      queueMicrotask(() => {
        if (!cancelled) {
          setRenderState({ code, error: message, ready: false })
        }
      })
    }

    return () => {
      cancelled = true
      instance?.destroy()
      host.replaceChildren()
    }
  }, [code, showSource, theme])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleCopy = () => {
    void copyText(code).then(() => setCopied(true))
  }

  const showDiagram = !showSource && !error

  return (
    <div className="code-block mermaid-block" data-language="mermaid">
      <div className="code-block__header">
        <span className="code-block__lang">Mermaid</span>
        <div className="code-block__actions">
          <button
            type="button"
            className="icon-button"
            data-active={showSource}
            onClick={() => setShowSource((value) => !value)}
            aria-label={showSource ? '查看图表' : '查看源码'}
            title={showSource ? '查看图表' : '查看源码'}
          >
            {showSource ? <EyeOff /> : <Eye />}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={handleCopy}
            aria-label="复制图表源码"
            title="复制图表源码"
          >
            {copied ? <Check /> : <Copy />}
          </button>
        </div>
      </div>
      <div className="mermaid-block__body" data-ready={ready} data-source={showSource}>
        {error ? (
          <div className="mermaid-error" role="alert">
            <TriangleAlert />
            <span>{error}</span>
          </div>
        ) : null}
        {showDiagram && !ready ? <div className="mermaid-loading">正在绘制图表…</div> : null}
        <div ref={hostRef} className="mermaid-canvas" />
        {showSource ? (
          <pre className="mermaid-source">
            <code>{code}</code>
          </pre>
        ) : null}
      </div>
    </div>
  )
}

import { forwardRef } from 'react'
import { FileText } from 'lucide-react'
import type { Theme } from '../types'
import { MarkdownRenderer } from './MarkdownRenderer'

interface PreviewPaneProps {
  text: string
  theme: Theme
  onToggleTask: (offset: number) => void
}

export const PreviewPane = forwardRef<HTMLDivElement, PreviewPaneProps>(
  function PreviewPane({ text, theme, onToggleTask }, ref) {
    return (
      <section className="pane pane-preview">
        <div className="preview-scroll" ref={ref}>
          {text.trim() ? (
            <article className="markdown-body">
              <MarkdownRenderer text={text} theme={theme} onToggleTask={onToggleTask} />
            </article>
          ) : (
            <div className="empty-preview">
              <FileText aria-hidden="true" />
              <p>开始写 Markdown，预览会实时出现在这里。</p>
              <span>支持 GFM、公式、代码高亮和 Mermaid 图表</span>
            </div>
          )}
        </div>
      </section>
    )
  },
)

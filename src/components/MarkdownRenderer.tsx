import { Children, isValidElement, memo, useMemo, type ReactNode } from 'react'
import ReactMarkdown, { type Components, type Options as MarkdownOptions } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import {
  CircleAlert,
  Info,
  Lightbulb,
  OctagonAlert,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { remarkAlerts, sanitizeSchema } from '../lib/markdown'
import { textOf } from '../lib/react'
import type { Theme } from '../types'
import { CodeBlock } from './CodeBlock'
import { MathBlock, MathInline } from './MathBlock'
import { MermaidBlock } from './MermaidBlock'
import { TableBlock } from './TableBlock'

interface MarkdownRendererProps {
  text: string
  theme: Theme
  onToggleTask?: (offset: number) => void
}

const remarkPlugins: NonNullable<MarkdownOptions['remarkPlugins']> = [
  remarkGfm,
  remarkBreaks,
  [remarkMath, { singleDollarTextMath: true }],
  remarkAlerts,
]

const rehypePlugins: NonNullable<MarkdownOptions['rehypePlugins']> = [
  rehypeRaw,
  [rehypeSanitize, sanitizeSchema],
]

const alertConfig: Record<string, { label: string; Icon: LucideIcon }> = {
  NOTE: { label: 'Note', Icon: Info },
  TIP: { label: 'Tip', Icon: Lightbulb },
  IMPORTANT: { label: 'Important', Icon: CircleAlert },
  WARNING: { label: 'Warning', Icon: TriangleAlert },
  CAUTION: { label: 'Caution', Icon: OctagonAlert },
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  text,
  theme,
  onToggleTask,
}: MarkdownRendererProps) {
  const components = useMemo<Components>(
    () => ({
      pre({ node, children, ...props }) {
        void node
        const child = Children.toArray(children)[0]
        if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) {
          return <pre {...props}>{children}</pre>
        }

        const className = String(child.props.className ?? '')
        const code = textOf(child.props.children).replace(/\n$/, '')

        if (className.includes('language-math') || className.includes('math-display')) {
          return <MathBlock tex={code} />
        }

        const language = /language-([^\s]+)/.exec(className)?.[1] ?? 'text'
        if (language === 'mermaid') return <MermaidBlock code={code} theme={theme} />
        return <CodeBlock code={code} language={language} theme={theme} />
      },
      code({ node, className, children, ...props }) {
        void node
        const classNameText = String(className ?? '')
        const code = textOf(children)
        if (classNameText.includes('language-math') || classNameText.includes('math-inline')) {
          return <MathInline tex={code} />
        }
        if (classNameText.includes('math-display')) return <MathBlock tex={code} />
        return (
          <code {...props} className={className}>
            {children}
          </code>
        )
      },
      blockquote({ node, children, ...props }) {
        void node
        const value = (props as Record<string, unknown>)['data-alert']
        const alert = typeof value === 'string' ? alertConfig[value.toUpperCase()] : undefined
        if (!alert) return <blockquote {...props}>{children}</blockquote>

        const Icon = alert.Icon
        return (
          <div className={`alert alert-${String(value).toLowerCase()}`} role="note">
            <div className="alert-title">
              <Icon aria-hidden="true" />
              <span>{alert.label}</span>
            </div>
            <div className="alert-body">{children}</div>
          </div>
        )
      },
      li({ node, className, children, ...props }) {
        const isTask = String(className ?? '').includes('task-list-item')
        return (
          <li
            {...props}
            className={className}
            data-task-offset={isTask ? node?.position?.start.offset : undefined}
          >
            {children}
          </li>
        )
      },
      input({ node, checked, type, disabled, ...props }) {
        void node
        void disabled
        if (type !== 'checkbox') return <input {...props} type={type} />
        return (
          <input
            {...props}
            type="checkbox"
            checked={checked === true}
            onChange={(event) => {
              const offset = event.currentTarget
                .closest('li')
                ?.getAttribute('data-task-offset')
              if (offset != null && onToggleTask) onToggleTask(Number(offset))
            }}
            aria-label="切换任务状态"
          />
        )
      },
      table({ node, children, ...props }) {
        void node
        return <TableBlock {...props}>{children}</TableBlock>
      },
      a({ node, href, children, ...props }) {
        void node
        const external = typeof href === 'string' && /^https?:\/\//i.test(href)
        return (
          <a
            {...props}
            href={href}
            {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
          >
            {children}
          </a>
        )
      },
      img({ node, ...props }) {
        void node
        return <img {...props} loading="lazy" decoding="async" />
      },
    }),
    [onToggleTask, theme],
  )

  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {text}
    </ReactMarkdown>
  )
})

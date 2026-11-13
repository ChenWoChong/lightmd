import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { Check, Copy } from 'lucide-react'
import { copyText } from '../lib/clipboard'

interface TableBlockProps extends ComponentPropsWithoutRef<'table'> {
  children: ReactNode
}

function tableToTsv(table: HTMLTableElement) {
  return Array.from(table.rows)
    .map((row) =>
      Array.from(row.cells)
        .map((cell) => cell.innerText.replace(/\s+/g, ' ').trim())
        .join('\t'),
    )
    .join('\n')
}

export function TableBlock({ children, ...props }: TableBlockProps) {
  const tableRef = useRef<HTMLTableElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleCopy = () => {
    const table = tableRef.current
    if (!table) return
    void copyText(tableToTsv(table)).then(() => setCopied(true))
  }

  return (
    <div className="table-block">
      <div className="table-scroll">
        <table ref={tableRef} {...props}>
          {children}
        </table>
      </div>
      <div className="table-block__actions">
        <button
          type="button"
          className="table-copy-button"
          onClick={handleCopy}
          aria-label={copied ? '已复制表格' : '复制表格'}
          title={copied ? '已复制' : '复制表格'}
        >
          {copied ? <Check /> : <Copy />}
        </button>
      </div>
    </div>
  )
}

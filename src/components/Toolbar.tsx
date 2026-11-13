import { useEffect, useState } from 'react'
import {
  ArrowUpDown,
  Check,
  ChevronRight,
  Columns2,
  Copy,
  Eye,
  FilePlus2,
  FileSearch,
  FileText,
  FolderOpen,
  Moon,
  PencilLine,
  Printer,
  Save,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import type { SaveState, Theme, ViewMode } from '../types'

interface ToolbarProps {
  fileName: string
  dirty: boolean
  theme: Theme
  view: ViewMode
  saveState: SaveState
  syncScroll: boolean
  stats: {
    lines: number
    words: number
  }
  statusText: string
  workspaceName: string | null
  desktopFiles: boolean
  onNew: () => void
  onOpen: () => void
  onOpenFolder: () => void
  onSave: () => void
  onPrint: () => void
  onRename: () => void
  onCopy: () => Promise<void>
  onThemeChange: (theme: Theme) => void
  onViewChange: (view: ViewMode) => void
  onSyncScrollChange: (value: boolean) => void
}

const views: Array<{ value: ViewMode; label: string; Icon: LucideIcon }> = [
  { value: 'write', label: '编辑', Icon: PencilLine },
  { value: 'split', label: '分栏', Icon: Columns2 },
  { value: 'preview', label: '预览', Icon: Eye },
]

export function Toolbar({
  fileName,
  dirty,
  theme,
  view,
  saveState,
  syncScroll,
  stats,
  statusText,
  workspaceName,
  desktopFiles,
  onNew,
  onOpen,
  onOpenFolder,
  onSave,
  onPrint,
  onRename,
  onCopy,
  onThemeChange,
  onViewChange,
  onSyncScrollChange,
}: ToolbarProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleCopy = () => {
    void onCopy().then(() => setCopied(true))
  }

  return (
    <header className="document-chrome">
      <div className="document-tabbar">
        <div className="document-tabs" role="tablist" aria-label="打开的文档">
          <button
            type="button"
            role="tab"
            aria-selected="true"
            className="document-tab"
            onClick={onRename}
            title="重命名文件"
          >
            <FileText aria-hidden="true" />
            <span className="document-tab__name">{fileName}</span>
            {dirty ? <span className="document-tab__dirty" title="有未保存的修改" /> : null}
          </button>
          <button
            type="button"
            className="chrome-icon"
            onClick={onNew}
            aria-label="新建文档"
            title="新建文档"
          >
            <FilePlus2 />
          </button>
        </div>

        <div className="document-tabbar__actions">
          <button
            type="button"
            className="chrome-icon"
            onClick={onOpen}
            aria-label="打开文件"
            title="打开文件"
          >
            <FileSearch />
          </button>
          {desktopFiles ? (
            <button
              type="button"
              className="chrome-icon"
              onClick={onOpenFolder}
              aria-label="打开文件夹"
              title="打开文件夹"
            >
              <FolderOpen />
            </button>
          ) : null}
          <button
            type="button"
            className="chrome-icon"
            onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
            title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </button>
        </div>
      </div>

      <div className="document-pathbar">
        <div className="document-path" aria-label="文件路径">
          <span className="document-path__origin">Local</span>
          <ChevronRight className="document-path__separator" aria-hidden="true" />
          {workspaceName ? (
            <>
              <span className="document-path__folder" title={workspaceName}>
                {workspaceName}
              </span>
              <ChevronRight className="document-path__separator" aria-hidden="true" />
            </>
          ) : null}
          <button
            type="button"
            className="document-path__current"
            onClick={onRename}
            title="重命名文件"
          >
            {fileName}
          </button>
          {dirty ? <span className="document-path__dirty" title="有未保存的修改" /> : null}
          <span className="document-path__meta">
            {stats.lines} 行 · {stats.words} 词
          </span>
          {statusText ? (
            <span className="document-path__save" data-state={saveState}>
              {statusText}
            </span>
          ) : null}
        </div>

        <div className="document-pathbar__actions">
          <div className="view-switch" role="group" aria-label="视图模式">
            {views.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                data-active={view === value}
                onClick={() => onViewChange(value)}
                aria-pressed={view === value}
                aria-label={label}
                title={label}
              >
                <Icon aria-hidden="true" />
              </button>
            ))}
          </div>

          {view === 'split' ? (
            <button
              type="button"
              className="chrome-icon"
              data-active={syncScroll}
              onClick={() => onSyncScrollChange(!syncScroll)}
              aria-pressed={syncScroll}
              aria-label="同步滚动"
              title={syncScroll ? '关闭同步滚动' : '开启同步滚动'}
            >
              <ArrowUpDown />
            </button>
          ) : null}

          <span className="document-pathbar__divider" aria-hidden="true" />

          <button
            type="button"
            className="chrome-icon"
            onClick={handleCopy}
            aria-label={copied ? '已复制文档' : '复制文档'}
            title={copied ? '已复制' : '复制文档'}
          >
            {copied ? <Check /> : <Copy />}
          </button>
          <button
            type="button"
            className="chrome-icon document-optional-action"
            onClick={onPrint}
            aria-label="打印"
            title="打印"
          >
            <Printer />
          </button>
          <button
            type="button"
            className="chrome-icon"
            data-attention={dirty}
            data-saving={saveState === 'saving'}
            onClick={onSave}
            aria-label="保存文件"
            title="保存文件"
          >
            <Save />
          </button>
        </div>
      </div>
    </header>
  )
}

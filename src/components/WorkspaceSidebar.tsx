import { FolderTree, RefreshCw } from 'lucide-react'
import type { WorkspaceEntry } from '../types'
import { FileTree } from './FileTree'

interface WorkspaceSidebarProps {
  rootPath: string
  entries: WorkspaceEntry[]
  loading: boolean
  error: string
  activePath: string | null
  refreshToken: number
  onRefresh: () => void
  loadDirectory: (target: string) => Promise<WorkspaceEntry[]>
  onOpenFile: (target: string) => void
}

function folderName(target: string) {
  return target.split(/[\\/]/).filter(Boolean).at(-1) ?? target
}

export function WorkspaceSidebar({
  rootPath,
  entries,
  loading,
  error,
  activePath,
  refreshToken,
  onRefresh,
  loadDirectory,
  onOpenFile,
}: WorkspaceSidebarProps) {
  return (
    <aside className="workspace-sidebar" aria-label="文件">
      <div className="workspace-sidebar__header">
        <FolderTree aria-hidden="true" />
        <span className="workspace-sidebar__title" title={rootPath}>
          {folderName(rootPath)}
        </span>
        <button
          type="button"
          className="chrome-icon"
          onClick={onRefresh}
          aria-label="刷新文件列表"
          title="刷新文件列表"
        >
          <RefreshCw />
        </button>
      </div>

      <div className="workspace-sidebar__body">
        {error ? <p className="workspace-sidebar__message">{error}</p> : null}
        {!error && loading && entries.length === 0 ? (
          <p className="workspace-sidebar__message">正在读取文件夹…</p>
        ) : null}
        {!error && !loading && entries.length === 0 ? (
          <p className="workspace-sidebar__message">这个文件夹里没有 Markdown 文件。</p>
        ) : null}
        {entries.length > 0 ? (
          <FileTree
            entries={entries}
            activePath={activePath}
            refreshToken={refreshToken}
            loadDirectory={loadDirectory}
            onOpenFile={onOpenFile}
          />
        ) : null}
      </div>
    </aside>
  )
}

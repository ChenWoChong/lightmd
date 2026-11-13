import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ChevronRight, FileText, Folder, FolderOpen, LoaderCircle } from 'lucide-react'
import type { WorkspaceEntry } from '../types'

interface FileTreeProps {
  entries: WorkspaceEntry[]
  activePath: string | null
  refreshToken: number
  loadDirectory: (target: string) => Promise<WorkspaceEntry[]>
  onOpenFile: (target: string) => void
}

interface FileTreeNodeProps extends Omit<FileTreeProps, 'entries'> {
  entry: WorkspaceEntry
  depth: number
}

export function FileTree({
  entries,
  activePath,
  refreshToken,
  loadDirectory,
  onOpenFile,
}: FileTreeProps) {
  return (
    <ul className="file-tree" role="tree">
      {entries.map((entry) => (
        <FileTreeNode
          key={`${refreshToken}:${entry.path}`}
          entry={entry}
          depth={0}
          activePath={activePath}
          refreshToken={refreshToken}
          loadDirectory={loadDirectory}
          onOpenFile={onOpenFile}
        />
      ))}
    </ul>
  )
}

function FileTreeNode({
  entry,
  depth,
  activePath,
  refreshToken,
  loadDirectory,
  onOpenFile,
}: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<WorkspaceEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)

  useEffect(() => {
    return () => {
      requestId.current += 1
    }
  }, [])

  const loadChildren = () => {
    if (children !== null || loading) return

    const currentRequest = requestId.current + 1
    requestId.current = currentRequest
    setLoading(true)
    setError('')
    void loadDirectory(entry.path)
      .then((next) => {
        if (requestId.current === currentRequest) setChildren(next)
      })
      .catch((reason: unknown) => {
        if (requestId.current !== currentRequest) return
        setError(reason instanceof Error ? reason.message : '文件夹读取失败')
      })
      .finally(() => {
        if (requestId.current === currentRequest) setLoading(false)
      })
  }

  const activate = () => {
    if (entry.kind === 'directory') {
      const nextExpanded = !expanded
      setExpanded(nextExpanded)
      if (nextExpanded) loadChildren()
      return
    }
    onOpenFile(entry.path)
  }

  const isActive = entry.path === activePath
  const style = { paddingInlineStart: `${5 + depth * 13}px` } as CSSProperties

  return (
    <li className="file-tree__item" role="treeitem" aria-expanded={entry.kind === 'directory' ? expanded : undefined}>
      <button
        type="button"
        className="file-tree__row"
        data-kind={entry.kind}
        data-active={isActive}
        style={style}
        onClick={activate}
        title={entry.path}
      >
        {entry.kind === 'directory' ? (
          <ChevronRight className="file-tree__chevron" data-expanded={expanded} aria-hidden="true" />
        ) : (
          <span className="file-tree__chevron-spacer" aria-hidden="true" />
        )}
        {entry.kind === 'directory' ? (
          expanded ? (
            <FolderOpen className="file-tree__icon" aria-hidden="true" />
          ) : (
            <Folder className="file-tree__icon" aria-hidden="true" />
          )
        ) : (
          <FileText className="file-tree__icon" aria-hidden="true" />
        )}
        <span className="file-tree__name">{entry.name}</span>
        {loading ? <LoaderCircle className="file-tree__loading spin" aria-hidden="true" /> : null}
      </button>
      {error ? <p className="file-tree__error">{error}</p> : null}
      {expanded && children && children.length > 0 ? (
        <ul className="file-tree file-tree--nested" role="group">
          {children.map((child) => (
            <FileTreeNode
              key={`${refreshToken}:${child.path}`}
              entry={child}
              depth={depth + 1}
              activePath={activePath}
              refreshToken={refreshToken}
              loadDirectory={loadDirectory}
              onOpenFile={onOpenFile}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

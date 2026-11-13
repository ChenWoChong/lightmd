import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { EditorView } from '@codemirror/view'
import { EditorPane } from './components/EditorPane'
import { PreviewPane } from './components/PreviewPane'
import { Toolbar } from './components/Toolbar'
import { WorkspaceSidebar } from './components/WorkspaceSidebar'
import { copyText } from './lib/clipboard'
import { ensureMarkdownName, isAbortError, openWithPicker, saveToFile } from './lib/files'
import {
  loadDraft,
  loadSplit,
  loadSyncScroll,
  loadTheme,
  loadView,
  saveDraft,
  saveSplit,
  saveSyncScroll,
  saveTheme,
  saveView,
} from './lib/storage'
import { useDebouncedValue } from './lib/useDebouncedValue'
import sampleMarkdown from './sample.md?raw'
import type {
  FileHandleLike,
  SaveState,
  Theme,
  ViewMode,
  WorkspaceEntry,
} from './types'

function toggleTaskAt(source: string, offset: number) {
  const start = source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1
  const lineEnd = source.indexOf('\n', offset)
  const end = lineEnd === -1 ? source.length : lineEnd
  const line = source.slice(start, end)
  const marker = line.search(/\[[ xX]\]/)
  if (marker === -1) return source

  const current = line.slice(marker, marker + 3)
  const next = current === '[ ]' ? '[x]' : '[ ]'
  return source.slice(0, start) + line.slice(0, marker) + next + line.slice(marker + 3) + source.slice(end)
}

function collectStats(text: string) {
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? []).length
  const latin = (
    text
      .replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ')
      .match(/[A-Za-z0-9][A-Za-z0-9'_-]*/g) ?? []
  ).length

  return {
    lines: text ? text.split('\n').length : 0,
    words: cjk + latin,
  }
}

function fileNameFromPath(target: string) {
  return target.split(/[\\/]/).filter(Boolean).at(-1) ?? target
}

function folderName(target: string) {
  return target.split(/[\\/]/).filter(Boolean).at(-1) ?? target
}

function preferredWorkspaceFile(entries: WorkspaceEntry[]) {
  return (
    entries.find(
      (entry) => entry.kind === 'file' && /^readme\.(md|markdown|mdown|mkd|mdx)$/i.test(entry.name),
    ) ??
    entries.find((entry) => entry.kind === 'file') ??
    null
  )
}

function App() {
  const initialDraft = useMemo(() => loadDraft(), [])
  const initialText = initialDraft?.text ?? sampleMarkdown
  const desktop = window.lightmd
  const desktopFiles = Boolean(desktop)

  const [text, setText] = useState(initialText)
  const [savedText, setSavedText] = useState(initialText)
  const [fileName, setFileName] = useState(initialDraft?.fileName ?? 'welcome.md')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileHandle, setFileHandle] = useState<FileHandleLike | null>(null)
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [workspaceEntries, setWorkspaceEntries] = useState<WorkspaceEntry[]>([])
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')
  const [workspaceRefreshToken, setWorkspaceRefreshToken] = useState(0)
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [view, setView] = useState<ViewMode>(loadView)
  const [split, setSplit] = useState(loadSplit)
  const [syncScroll, setSyncScroll] = useState(loadSyncScroll)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [editorScroller, setEditorScroller] = useState<HTMLElement | null>(null)
  const [previewScroller, setPreviewScroller] = useState<HTMLDivElement | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const draftTimer = useRef<number | null>(null)
  const savingRef = useRef(false)
  const openTargetRef = useRef<(target: string) => Promise<void>>(async () => undefined)
  const newDocumentRef = useRef<() => void>(() => undefined)
  const saveDocumentRef = useRef<() => Promise<void>>(async () => undefined)

  const deferredText = useDebouncedValue(text, 80)
  const dirty = text !== savedText
  const stats = useMemo(() => collectStats(text), [text])
  const workspaceName = workspaceRoot ? folderName(workspaceRoot) : null

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.colorScheme = theme
    saveTheme(theme)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#000000' : '#fcfcfc')
  }, [theme])

  useEffect(() => {
    if (!desktop) return
    document.documentElement.dataset.platform = desktop.platform
  }, [desktop])

  useEffect(() => {
    saveView(view)
  }, [view])

  useEffect(() => {
    saveSyncScroll(syncScroll)
  }, [syncScroll])

  useEffect(() => {
    const timer = window.setTimeout(() => saveSplit(split), 180)
    return () => window.clearTimeout(timer)
  }, [split])

  useEffect(() => {
    document.title = `${fileName} · lightmd`
  }, [fileName])

  useEffect(() => {
    if (draftTimer.current) window.clearTimeout(draftTimer.current)
    draftTimer.current = window.setTimeout(() => {
      saveDraft({ text, fileName, updatedAt: Date.now() })
    }, 450)
    return () => {
      if (draftTimer.current) window.clearTimeout(draftTimer.current)
    }
  }, [fileName, text])

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    if (!syncScroll || view !== 'split' || !editorScroller || !previewScroller) return

    let active: 'editor' | 'preview' | null = null
    let frame = 0

    const scrollRatio = (element: HTMLElement) => {
      const max = element.scrollHeight - element.clientHeight
      return max > 0 ? element.scrollTop / max : 0
    }

    const onEditorScroll = () => {
      if (active === 'preview') return
      active = 'editor'
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const max = previewScroller.scrollHeight - previewScroller.clientHeight
        previewScroller.scrollTop = scrollRatio(editorScroller) * Math.max(0, max)
        active = null
      })
    }

    const onPreviewScroll = () => {
      if (active === 'editor') return
      active = 'preview'
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const max = editorScroller.scrollHeight - editorScroller.clientHeight
        editorScroller.scrollTop = scrollRatio(previewScroller) * Math.max(0, max)
        active = null
      })
    }

    editorScroller.addEventListener('scroll', onEditorScroll, { passive: true })
    previewScroller.addEventListener('scroll', onPreviewScroll, { passive: true })
    return () => {
      editorScroller.removeEventListener('scroll', onEditorScroll)
      previewScroller.removeEventListener('scroll', onPreviewScroll)
      cancelAnimationFrame(frame)
    }
  }, [editorScroller, previewScroller, syncScroll, view])

  const applyDocument = useCallback(
    (next: {
      text: string
      name: string
      handle: FileHandleLike | null
      path?: string | null
    }) => {
      setText(next.text)
      setSavedText(next.text)
      setFileName(next.name)
      setFilePath(next.path ?? null)
      setFileHandle(next.handle)
      setSaveState('idle')
      previewScroller?.scrollTo({ top: 0 })
      editorScroller?.scrollTo({ top: 0 })
    },
    [editorScroller, previewScroller],
  )

  const loadDirectory = useCallback(async (target: string) => {
    if (!window.lightmd) throw new Error('文件夹浏览需要桌面版 lightmd。')
    return window.lightmd.readDirectory(target)
  }, [])

  const refreshWorkspace = useCallback(
    async (root: string | null = workspaceRoot) => {
      if (!root || !desktop) return
      setWorkspaceLoading(true)
      setWorkspaceError('')
      try {
        const entries = await desktop.readDirectory(root)
        setWorkspaceEntries(entries)
        setWorkspaceRefreshToken((current) => current + 1)
      } catch (error) {
        console.error(error)
        setWorkspaceEntries([])
        setWorkspaceError(error instanceof Error ? error.message : '文件夹读取失败')
      } finally {
        setWorkspaceLoading(false)
      }
    },
    [desktop, workspaceRoot],
  )

  const openWorkspace = useCallback(
    async (root: string, preferredPath?: string) => {
      if (!desktop) return
      if (
        dirty &&
        preferredPath !== filePath &&
        !window.confirm('当前文档有未保存的修改，确定切换到其他文档？')
      ) {
        return
      }

      setWorkspaceRoot(root)
      setWorkspaceLoading(true)
      setWorkspaceError('')

      try {
        const entries = await desktop.readDirectory(root)
        setWorkspaceEntries(entries)
        setWorkspaceRefreshToken((current) => current + 1)

        const candidate = preferredPath ?? preferredWorkspaceFile(entries)?.path ?? null
        if (candidate && candidate !== filePath) {
          const file = await desktop.readFile(candidate)
          applyDocument({
            text: file.text,
            name: file.name,
            handle: null,
            path: file.path,
          })
        } else if (!candidate && !filePath) {
          applyDocument({ text: '', name: 'untitled.md', handle: null, path: null })
        }
      } catch (error) {
        console.error(error)
        setWorkspaceEntries([])
        setWorkspaceError(error instanceof Error ? error.message : '文件夹打开失败')
      } finally {
        setWorkspaceLoading(false)
      }
    },
    [applyDocument, desktop, dirty, filePath],
  )

  const openDesktopFile = useCallback(
    async (target: string) => {
      if (!desktop || target === filePath) return
      if (dirty && !window.confirm('当前文档有未保存的修改，确定切换到其他文档？')) return

      try {
        const file = await desktop.readFile(target)
        applyDocument({
          text: file.text,
          name: file.name,
          handle: null,
          path: file.path,
        })
      } catch (error) {
        console.error(error)
        window.alert('打开文件失败，请重试。')
      }
    },
    [applyDocument, desktop, dirty, filePath],
  )

  const openDesktopTarget = useCallback(
    async (target: string) => {
      if (!desktop) return
      try {
        const info = await desktop.inspectPath(target)
        await openWorkspace(
          info.kind === 'directory' ? info.path : info.directory,
          info.kind === 'file' ? info.path : undefined,
        )
      } catch (error) {
        console.error(error)
        window.alert(error instanceof Error ? error.message : '打开文件或文件夹失败。')
      }
    },
    [desktop, openWorkspace],
  )

  const handleNew = useCallback(() => {
    if (dirty && !window.confirm('当前文档有未保存的修改，确定新建？')) return
    applyDocument({ text: '', name: 'untitled.md', handle: null, path: null })
    setView('write')
    window.requestAnimationFrame(() => editorViewRef.current?.focus())
  }, [applyDocument, dirty])

  const handleOpen = useCallback(async () => {
    if (desktop) {
      try {
        const target = await desktop.chooseFile()
        if (target) await openDesktopTarget(target)
      } catch (error) {
        console.error(error)
        window.alert('打开文件失败，请重试。')
      }
      return
    }

    if (dirty && !window.confirm('当前文档有未保存的修改，确定打开其他文件？')) return

    try {
      const result = await openWithPicker()
      if (result === 'unsupported') {
        fileInputRef.current?.click()
        return
      }
      if (result) {
        applyDocument({
          text: result.text,
          name: result.name,
          handle: result.handle,
        })
      }
    } catch (error) {
      console.error(error)
      window.alert('打开文件失败，请重试。')
    }
  }, [applyDocument, desktop, dirty, openDesktopTarget])

  const handleOpenFolder = useCallback(async () => {
    if (!desktop) {
      window.alert('文件夹浏览需要使用桌面版 lightmd。')
      return
    }

    try {
      const target = await desktop.chooseFolder()
      if (target) await openDesktopTarget(target)
    } catch (error) {
      console.error(error)
      window.alert('打开文件夹失败，请重试。')
    }
  }, [desktop, openDesktopTarget])

  const handleFileInput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return

      try {
        const content = await file.text()
        applyDocument({ text: content, name: file.name, handle: null })
      } catch (error) {
        console.error(error)
        window.alert('读取文件失败，请重试。')
      }
    },
    [applyDocument],
  )

  const handleSave = useCallback(async () => {
    if (savingRef.current) return
    savingRef.current = true
    setSaveState('saving')

    try {
      if (desktop) {
        let target = filePath
        if (!target) {
          target = await desktop.chooseSavePath(ensureMarkdownName(fileName))
          if (!target) {
            setSaveState('idle')
            return
          }
          setFilePath(target)
          setFileName(fileNameFromPath(target))
          const info = await desktop.inspectPath(target)
          setWorkspaceRoot(info.directory)
          void refreshWorkspace(info.directory)
        }

        await desktop.writeFile(target, text)
        setSavedText(text)
        setSaveState('saved')
        return
      }

      const result = await saveToFile(text, fileName, fileHandle)
      if (!result) {
        setSaveState('idle')
        return
      }
      setFileHandle(result.handle)
      setFileName(result.name)
      setSavedText(text)
      setSaveState('saved')
    } catch (error) {
      if (isAbortError(error)) {
        setSaveState('idle')
        return
      }
      console.error(error)
      setSaveState('error')
      window.alert('保存失败，请检查文件权限后重试。')
    } finally {
      savingRef.current = false
    }
  }, [desktop, fileName, fileHandle, filePath, refreshWorkspace, text])

  const handleRename = useCallback(() => {
    if (filePath) {
      window.alert('这个文件已经绑定磁盘路径，请先在 Finder 中重命名。')
      return
    }

    const next = window.prompt('文件名', fileName)
    if (!next?.trim()) return
    setFileName(ensureMarkdownName(next))
    setFileHandle(null)
    setSaveState('idle')
  }, [fileName, filePath])

  const handleToggleTask = useCallback((offset: number) => {
    setText((current) => toggleTaskAt(current, offset))
  }, [])

  const handleCopyDocument = useCallback(() => copyText(text), [text])

  const handlePrint = useCallback(() => {
    const needsPreview = view === 'write'
    if (needsPreview) setView('preview')
    window.setTimeout(() => window.print(), needsPreview ? 360 : 0)
  }, [view])

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const workspace = workspaceRef.current
      if (!workspace || view !== 'split') return

      event.preventDefault()
      const rect = workspace.getBoundingClientRect()

      const onMove = (moveEvent: PointerEvent) => {
        const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100
        setSplit(Math.min(72, Math.max(28, percent)))
      }

      const onEnd = () => {
        document.body.classList.remove('resizing')
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onEnd)
      }

      document.body.classList.add('resizing')
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onEnd)
    },
    [view],
  )

  useEffect(() => {
    openTargetRef.current = openDesktopTarget
  }, [openDesktopTarget])

  useEffect(() => {
    newDocumentRef.current = handleNew
  }, [handleNew])

  useEffect(() => {
    saveDocumentRef.current = handleSave
  }, [handleSave])

  useEffect(() => {
    if (!desktop) return
    const disposeOpen = desktop.onOpenPath((target) => {
      void openTargetRef.current(target)
    })
    const disposeMenu = desktop.onMenuCommand((command) => {
      if (command === 'new') newDocumentRef.current()
      if (command === 'save') void saveDocumentRef.current()
    })

    void desktop
      .consumeOpenPaths()
      .then((paths) => {
        for (const target of paths) void openTargetRef.current(target)
      })
      .catch((error: unknown) => console.error(error))

    return () => {
      disposeOpen()
      disposeMenu()
    }
  }, [desktop])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      if (!modifier) return

      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        void handleSave()
      }
      if (key === 'o') {
        event.preventDefault()
        if (event.shiftKey) {
          void handleOpenFolder()
        } else {
          void handleOpen()
        }
      }
      if (key === 'n') {
        event.preventDefault()
        handleNew()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleNew, handleOpen, handleOpenFolder, handleSave])

  const statusText =
    saveState === 'saving'
      ? '保存中…'
      : saveState === 'error'
        ? '保存失败'
        : ''

  return (
    <div className="app">
      <Toolbar
        fileName={fileName}
        dirty={dirty}
        theme={theme}
        view={view}
        saveState={saveState}
        syncScroll={syncScroll}
        stats={{
          lines: stats.lines,
          words: stats.words,
        }}
        statusText={statusText}
        workspaceName={workspaceName}
        desktopFiles={desktopFiles}
        onNew={handleNew}
        onOpen={() => void handleOpen()}
        onOpenFolder={() => void handleOpenFolder()}
        onSave={() => void handleSave()}
        onPrint={handlePrint}
        onRename={handleRename}
        onCopy={handleCopyDocument}
        onThemeChange={setTheme}
        onViewChange={setView}
        onSyncScrollChange={setSyncScroll}
      />

      <div className="app-body">
        {workspaceRoot ? (
          <WorkspaceSidebar
            rootPath={workspaceRoot}
            entries={workspaceEntries}
            loading={workspaceLoading}
            error={workspaceError}
            activePath={filePath}
            refreshToken={workspaceRefreshToken}
            onRefresh={() => void refreshWorkspace()}
            loadDirectory={loadDirectory}
            onOpenFile={(target) => void openDesktopFile(target)}
          />
        ) : null}

        <main
          ref={workspaceRef}
          className="workspace"
          data-view={view}
          style={{ '--split': `${split}%` } as CSSProperties}
        >
          {view !== 'preview' ? (
            <EditorPane
              value={text}
              theme={theme}
              onChange={setText}
              onScroller={setEditorScroller}
              onViewReady={(instance) => {
                editorViewRef.current = instance
              }}
            />
          ) : null}

          {view === 'split' ? (
            <div
              className="splitter"
              role="separator"
              aria-orientation="vertical"
              aria-label="调整编辑器和预览宽度"
              onPointerDown={startResize}
            />
          ) : null}

          {view !== 'write' ? (
            <PreviewPane
              ref={setPreviewScroller}
              text={deferredText}
              theme={theme}
              onToggleTask={handleToggleTask}
            />
          ) : null}
        </main>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.mdown,.mkd,.txt,text/markdown,text/plain"
        hidden
        onChange={(event) => void handleFileInput(event)}
      />
    </div>
  )
}

export default App

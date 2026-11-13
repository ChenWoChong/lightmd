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
import type { FileHandleLike, SaveState, Theme, ViewMode } from './types'

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

function App() {
  const initialDraft = useMemo(() => loadDraft(), [])
  const initialText = initialDraft?.text ?? sampleMarkdown

  const [text, setText] = useState(initialText)
  const [savedText, setSavedText] = useState(initialText)
  const [fileName, setFileName] = useState(initialDraft?.fileName ?? 'welcome.md')
  const [fileHandle, setFileHandle] = useState<FileHandleLike | null>(null)
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

  const deferredText = useDebouncedValue(text, 80)
  const dirty = text !== savedText
  const stats = useMemo(() => collectStats(text), [text])

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
    document.title = `${fileName} · Markdown Live`
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
    (next: { text: string; name: string; handle: FileHandleLike | null }) => {
      setText(next.text)
      setSavedText(next.text)
      setFileName(next.name)
      setFileHandle(next.handle)
      setSaveState('idle')
      previewScroller?.scrollTo({ top: 0 })
      editorScroller?.scrollTo({ top: 0 })
    },
    [editorScroller, previewScroller],
  )

  const handleNew = useCallback(() => {
    if (dirty && !window.confirm('当前文档有未保存的修改，确定新建？')) return
    applyDocument({ text: '', name: 'untitled.md', handle: null })
    setView('write')
    window.requestAnimationFrame(() => editorViewRef.current?.focus())
  }, [applyDocument, dirty])

  const handleOpen = useCallback(async () => {
    if (dirty && !window.confirm('当前文档有未保存的修改，确定打开其他文件？')) return

    try {
      const result = await openWithPicker()
      if (result === 'unsupported') {
        fileInputRef.current?.click()
        return
      }
      if (result) {
        applyDocument({ text: result.text, name: result.name, handle: result.handle })
      }
    } catch (error) {
      console.error(error)
      window.alert('打开文件失败，请重试。')
    }
  }, [applyDocument, dirty])

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
  }, [fileName, fileHandle, text])

  const handleRename = useCallback(() => {
    const next = window.prompt('文件名', fileName)
    if (!next?.trim()) return
    setFileName(ensureMarkdownName(next))
    setFileHandle(null)
    setSaveState('idle')
  }, [fileName])

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
        void handleOpen()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleOpen, handleSave])

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
        onNew={handleNew}
        onOpen={() => void handleOpen()}
        onSave={() => void handleSave()}
        onPrint={handlePrint}
        onRename={handleRename}
        onCopy={handleCopyDocument}
        onThemeChange={setTheme}
        onViewChange={setView}
        onSyncScrollChange={setSyncScroll}
      />

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

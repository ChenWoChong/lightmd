import { useEffect, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { Theme } from '../types'

interface EditorPaneProps {
  value: string
  theme: Theme
  onChange: (value: string) => void
  onScroller: (element: HTMLElement | null) => void
  onViewReady: (view: EditorView) => void
}

const basicSetup = {
  lineNumbers: true,
  foldGutter: false,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
  bracketMatching: true,
  closeBrackets: true,
  autocompletion: false,
  searchKeymap: true,
  history: true,
  drawSelection: true,
  dropCursor: true,
  indentOnInput: true,
  syntaxHighlighting: true,
}

export function EditorPane({
  value,
  theme,
  onChange,
  onScroller,
  onViewReady,
}: EditorPaneProps) {
  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
      EditorView.contentAttributes.of({
        'aria-label': 'Markdown 编辑器',
        spellcheck: 'false',
      }),
    ],
    [],
  )

  useEffect(() => () => onScroller(null), [onScroller])

  return (
    <section className="pane pane-editor">
      <div className="editor-host">
        <CodeMirror
          value={value}
          height="100%"
          theme={theme}
          className="editor-cm"
          basicSetup={basicSetup}
          extensions={extensions}
          indentWithTab
          placeholder="开始写 Markdown…"
          onChange={onChange}
          onCreateEditor={(view) => {
            onScroller(view.scrollDOM)
            onViewReady(view)
          }}
        />
      </div>
    </section>
  )
}

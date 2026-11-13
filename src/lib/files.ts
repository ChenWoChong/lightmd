import type { FileHandleLike } from '../types'

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: Array<{ description?: string; accept: Record<string, string[]> }>
}

interface OpenFilePickerOptions {
  multiple?: boolean
  types?: Array<{ description?: string; accept: Record<string, string[]> }>
}

interface PickerWindow extends Window {
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileHandleLike[]>
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileHandleLike>
}

const markdownTypes = [
  {
    description: 'Markdown',
    accept: {
      'text/markdown': ['.md', '.markdown', '.mdown', '.mkd'],
      'text/plain': ['.txt'],
    },
  },
]

export interface OpenedFile {
  text: string
  name: string
  handle: FileHandleLike
}

function pickerWindow(): PickerWindow {
  return window as PickerWindow
}

export function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

export async function openWithPicker(): Promise<OpenedFile | 'unsupported' | null> {
  const picker = pickerWindow().showOpenFilePicker
  if (!picker) return 'unsupported'

  try {
    const [handle] = await picker({ multiple: false, types: markdownTypes })
    if (!handle) return null
    const file = await handle.getFile()
    return { text: await file.text(), name: file.name, handle }
  } catch (error) {
    if (isAbortError(error)) return null
    throw error
  }
}

async function writeHandle(handle: FileHandleLike, text: string) {
  const writable = await handle.createWritable()
  await writable.write(text)
  await writable.close()
}

export async function saveToFile(
  text: string,
  fileName: string,
  existingHandle: FileHandleLike | null,
): Promise<{ name: string; handle: FileHandleLike | null } | null> {
  if (existingHandle) {
    await writeHandle(existingHandle, text)
    return { name: existingHandle.name || fileName, handle: existingHandle }
  }

  const picker = pickerWindow().showSaveFilePicker
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: ensureMarkdownName(fileName),
        types: markdownTypes,
      })
      await writeHandle(handle, text)
      return { name: handle.name || fileName, handle }
    } catch (error) {
      if (isAbortError(error)) return null
      throw error
    }
  }

  const name = ensureMarkdownName(fileName)
  downloadMarkdown(text, name)
  return { name, handle: null }
}

export function ensureMarkdownName(name: string) {
  const trimmed = name.trim() || 'untitled.md'
  return /\.(md|markdown|mdown|mkd)$/i.test(trimmed) ? trimmed : `${trimmed}.md`
}

function downloadMarkdown(text: string, name: string) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

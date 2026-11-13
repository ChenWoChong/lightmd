export type Theme = 'light' | 'dark'

export type ViewMode = 'write' | 'split' | 'preview'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface Draft {
  text: string
  fileName: string
  updatedAt: number
}

export interface FileHandleLike {
  readonly name: string
  getFile(): Promise<File>
  createWritable(): Promise<{
    write(data: string): Promise<void>
    close(): Promise<void>
  }>
}

export interface WorkspaceEntry {
  name: string
  path: string
  kind: 'file' | 'directory'
}

export interface DesktopPathInfo {
  path: string
  kind: 'file' | 'directory'
  directory: string
}

export interface DesktopFile {
  path: string
  name: string
  text: string
}

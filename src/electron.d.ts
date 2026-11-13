import type { DesktopFile, DesktopPathInfo, WorkspaceEntry } from './types'

type MenuCommand = 'new' | 'save'

interface LightmdBridge {
  platform: string
  chooseFile(): Promise<string | null>
  chooseFolder(): Promise<string | null>
  chooseSavePath(suggestedName: string): Promise<string | null>
  inspectPath(target: string): Promise<DesktopPathInfo>
  readFile(target: string): Promise<DesktopFile>
  writeFile(target: string, contents: string): Promise<void>
  readDirectory(target: string): Promise<WorkspaceEntry[]>
  consumeOpenPaths(): Promise<string[]>
  installCli(): Promise<void>
  onOpenPath(callback: (target: string) => void): () => void
  onMenuCommand(callback: (command: MenuCommand) => void): () => void
}

declare global {
  interface Window {
    lightmd?: LightmdBridge
  }
}

export {}

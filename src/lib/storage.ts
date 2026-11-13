import type { Draft, Theme, ViewMode } from '../types'

const keys = {
  draft: 'md-live:draft',
  theme: 'md-live:theme',
  view: 'md-live:view',
  split: 'md-live:split',
  syncScroll: 'md-live:sync-scroll',
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode or a full quota should not break editing.
  }
}

export function loadDraft(): Draft | null {
  const raw = read(keys.draft)
  if (!raw) return null

  try {
    const value = JSON.parse(raw) as Partial<Draft>
    if (typeof value.text !== 'string') return null
    return {
      text: value.text,
      fileName: typeof value.fileName === 'string' ? value.fileName : 'untitled.md',
      updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
    }
  } catch {
    return null
  }
}

export function saveDraft(draft: Draft) {
  write(keys.draft, JSON.stringify(draft))
}

export function loadTheme(): Theme {
  const stored = read(keys.theme)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function saveTheme(theme: Theme) {
  write(keys.theme, theme)
}

export function loadView(): ViewMode {
  const stored = read(keys.view)
  if (stored === 'write' || stored === 'split' || stored === 'preview') return stored
  return window.innerWidth < 860 ? 'write' : 'split'
}

export function saveView(view: ViewMode) {
  write(keys.view, view)
}

export function loadSplit(): number {
  const value = Number(read(keys.split))
  return Number.isFinite(value) && value >= 28 && value <= 72 ? value : 52
}

export function saveSplit(value: number) {
  write(keys.split, String(Math.round(value)))
}

export function loadSyncScroll(): boolean {
  return read(keys.syncScroll) !== '0'
}

export function saveSyncScroll(value: boolean) {
  write(keys.syncScroll, value ? '1' : '0')
}

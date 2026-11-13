import { createHighlighter, type Highlighter } from 'shiki'
import type { Theme } from '../types'

const themeNames = {
  light: 'github-light-default',
  dark: 'github-dark-default',
} as const

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: [themeNames.light, themeNames.dark],
    langs: ['text'],
  })
  return highlighterPromise
}

const aliases: Record<string, string> = {
  c: 'c',
  'c++': 'cpp',
  cs: 'csharp',
  docker: 'dockerfile',
  html: 'html',
  js: 'javascript',
  jsx: 'jsx',
  jsonc: 'json',
  kt: 'kotlin',
  md: 'markdown',
  mdx: 'mdx',
  objc: 'objective-c',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  tsx: 'tsx',
  yml: 'yaml',
  zsh: 'bash',
}

export function normalizeLanguage(language: string | undefined) {
  const value = (language ?? '').trim().toLowerCase()
  if (!value) return 'text'
  return aliases[value] ?? value
}

const cache = new Map<string, string>()
const maxCacheEntries = 200

export async function highlightCode(code: string, language: string, theme: Theme) {
  const lang = normalizeLanguage(language)
  const key = `${theme}\u0000${lang}\u0000${code}`
  const cached = cache.get(key)
  if (cached) return cached

  const highlighter = await getHighlighter()
  let target = lang

  if (!highlighter.getLoadedLanguages().includes(target)) {
    try {
      await highlighter.loadLanguage(target as never)
    } catch {
      target = 'text'
    }
  }

  let html: string
  try {
    html = highlighter.codeToHtml(code, { lang: target, theme: themeNames[theme] })
  } catch {
    html = highlighter.codeToHtml(code, { lang: 'text', theme: themeNames[theme] })
  }

  if (cache.size >= maxCacheEntries) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, html)
  return html
}

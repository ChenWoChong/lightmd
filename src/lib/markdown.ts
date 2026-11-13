import { defaultSchema, type Options as SanitizeOptions } from 'rehype-sanitize'

interface MarkdownNode {
  type: string
  value?: string
  children?: MarkdownNode[]
  data?: {
    hProperties?: Record<string, unknown>
    [key: string]: unknown
  }
}

const alertPattern = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\n?/i

function walk(node: MarkdownNode) {
  if (node.type === 'blockquote') {
    const paragraph = node.children?.[0]
    const firstText = paragraph?.children?.[0]

    if (
      paragraph?.type === 'paragraph' &&
      firstText?.type === 'text' &&
      typeof firstText.value === 'string'
    ) {
      const match = alertPattern.exec(firstText.value)
      if (match) {
        firstText.value = firstText.value
          .slice(match[0].length)
          .replace(/^\n/, '')
        node.data = {
          ...node.data,
          hProperties: {
            ...node.data?.hProperties,
            dataAlert: match[1].toUpperCase(),
          },
        }
        if (!firstText.value) paragraph.children?.shift()
        if (paragraph.children?.[0]?.type === 'break') paragraph.children.shift()
      }
    }
  }

  node.children?.forEach(walk)
}

export function remarkAlerts() {
  return (tree: MarkdownNode) => walk(tree)
}

const baseAttributes = defaultSchema.attributes ?? {}

function attributesFor(name: string) {
  return [...(baseAttributes[name] ?? [])]
}

export const sanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'details',
    'summary',
    'kbd',
    'mark',
    'del',
    'ins',
  ],
  attributes: {
    ...baseAttributes,
    '*': [...(baseAttributes['*'] ?? []), 'className', 'id'],
    a: [...attributesFor('a'), 'target', 'rel'],
    blockquote: [...attributesFor('blockquote'), 'dataAlert'],
    code: [
      ...attributesFor('code'),
      ['className', /^language-./, 'math-inline', 'math-display'],
      'dataCodeMeta',
    ],
    div: [...attributesFor('div'), 'className', 'dataAlert'],
    img: [...attributesFor('img'), 'loading', 'decoding'],
    input: [...attributesFor('input'), 'type', 'checked', 'disabled'],
    span: [...attributesFor('span'), 'className'],
    table: [...attributesFor('table'), 'className'],
    td: [...attributesFor('td'), 'className'],
    th: [...attributesFor('th'), 'className'],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), 'file', 'mailto'],
    src: [...(defaultSchema.protocols?.src ?? []), 'file', 'data'],
  },
}

# Markdown Live

一个在本地运行的 Markdown 实时预览编辑器。左边写，右边即时渲染。

> [!TIP]
> 支持 GFM 表格、任务列表、脚注、数学公式、代码高亮和 Mermaid 图表。

## 快速体验

- [x] 输入 Markdown，右侧实时预览
- [x] 代码块高亮与一键复制
- [ ] 打开一个本地 `.md` 文件继续编辑
- [ ] 按 `⌘ S` 保存

## 代码

```ts
type Note = {
  title: string
  tags: string[]
}

export function summarize(note: Note) {
  return `${note.title} · ${note.tags.join(', ')}`
}
```

## 表格

| 能力 | 实现 | 状态 |
| --- | --- | :---: |
| Markdown | react-markdown | ✅ |
| 代码高亮 | Shiki | ✅ |
| 公式 | KaTeX | ✅ |
| 图表 | Pele | ✅ |

## 数学

行内公式：$E = mc^2$

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$

## 流程图

```mermaid
flowchart LR
  A[Markdown] --> B[remark]
  B --> C[rehype]
  C --> D[React]
  D --> E[Preview]
```

## 脚注

Pele 是一个快速、轻量的 Mermaid 渲染器。[^1]

[^1]: 来自 [pele.run](https://pele.run)，支持 Mermaid 12.1 语法。

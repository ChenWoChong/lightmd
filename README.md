# Markdown Live

一个本地运行的 Markdown 实时渲染编辑器。左边写，右边即时预览。

## 功能

- 分栏、纯编辑、纯预览三种视图，分隔条可拖动
- 编辑器和预览滚动同步，可单独关闭
- GFM 表格、任务列表、删除线、脚注、自动链接
- Shiki 代码高亮，带语言标签、复制、自动换行
- KaTeX 行内公式和块级公式
- Pele 渲染 Mermaid 图表，支持查看源码
- GitHub 风格提示块：`[!NOTE]`、`[!TIP]`、`[!WARNING]` 等
- 打开/保存本地 `.md` 文件，自动保存草稿到 `localStorage`
- 浅色/深色主题，跟随系统并记住选择
- T3 Code 风格的文件标签栏、路径栏和无边框内容区
- 行数、词数统计，支持打印

## 技术栈

| 层 | 实现 |
| --- | --- |
| 编辑器 | CodeMirror 6 |
| Markdown | react-markdown + unified / remark / rehype |
| 语法扩展 | remark-gfm、remark-breaks、remark-math |
| 安全过滤 | rehype-raw + rehype-sanitize |
| 代码高亮 | Shiki |
| 公式 | KaTeX |
| 图表 | Pele（兼容 Mermaid 语法） |

## 运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 快捷键

- `⌘ S` / `Ctrl S`：保存
- `⌘ O` / `Ctrl O`：打开文件

## 文件保存说明

Chrome / Edge 等支持 File System Access API 的浏览器会直接弹出系统文件选择器，保存后再次保存会写回同一个文件。

Safari、Firefox 等不支持的浏览器会退化为上传打开、下载保存，草稿仍会自动保存在浏览器本地。

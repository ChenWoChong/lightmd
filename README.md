# lightmd

一个本地运行的 Markdown 实时渲染编辑器，同时提供 Electron 桌面应用。

## 功能

- 分栏、纯编辑、纯预览三种视图，分隔条可拖动
- 编辑器和预览滚动同步，可单独关闭
- GFM 表格、任务列表、删除线、脚注、自动链接
- Shiki 代码高亮，带语言标签、复制、自动换行
- KaTeX 行内公式和块级公式
- Pele 渲染 Mermaid 图表，支持查看源码
- GitHub 风格提示块：`[!NOTE]`、`[!TIP]`、`[!WARNING]` 等
- 打开/保存本地 `.md` 文件，自动保存草稿到 `localStorage`
- 桌面版可打开文件和文件夹，并通过左侧文件树切换文档
- 支持 `lightmd README.md`、`lightmd .` 命令行打开
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

网页开发模式：

```bash
npm install
npm run dev
```

Electron 开发模式：

```bash
npm run app:dev
```

直接运行生产构建：

```bash
npm run app:start
```

生产构建：

```bash
npm run build
npm run preview
```

打包 macOS 应用：

```bash
npm run app:build
```

构建完成后，你可以直接把 `release/mac/lightmd.app` 拖进“应用程序”文件夹。

生成安装包：

```bash
npm run app:dist
```

产物位于 `release/`。

## 桌面版

- 应用菜单可打开文件、文件夹和保存文件
- 支持双击 `.md` 文件用 lightmd 打开
- 应用菜单 `lightmd → 安装 lightmd 命令…` 会安装终端命令到 `/usr/local/bin/lightmd`
- 安装命令后，app 不需要保持打开，`lightmd` 会自动拉起应用并打开目标路径
- 命令行用法：

```bash
lightmd README.md
lightmd ./notes
lightmd .
```

## 快捷键

- `⌘ S` / `Ctrl S`：保存
- `⌘ O` / `Ctrl O`：打开文件
- `⌘ ⇧ O`：打开文件夹

## 文件保存说明

Chrome / Edge 等支持 File System Access API 的浏览器会直接弹出系统文件选择器，保存后再次保存会写回同一个文件。

Safari、Firefox 等不支持的浏览器会退化为上传打开、下载保存，草稿仍会自动保存在浏览器本地。

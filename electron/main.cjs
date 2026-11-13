const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron')
const { execFile } = require('node:child_process')
const fs = require('node:fs')
const fsPromises = require('node:fs/promises')
const path = require('node:path')
const { promisify } = require('node:util')

const execFileAsync = promisify(execFile)
const devServerUrl = process.env.LIGHTMD_DEV_SERVER_URL
const markdownExtensions = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt'])
const ignoredDirectoryEntries = new Set(['.git', '.DS_Store', 'node_modules'])
const pendingOpenPaths = []
const allowedPaths = new Set()

let mainWindow = null

app.setName('lightmd')

function isMarkdownFile(fileName) {
  return markdownExtensions.has(path.extname(fileName).toLowerCase())
}

function isInsideAllowedPath(target) {
  for (const allowedPath of allowedPaths) {
    const relative = path.relative(allowedPath, target)
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      return true
    }
  }
  return false
}

function allowOpenTarget(target) {
  const resolved = path.resolve(target)
  allowedPaths.add(resolved)
  allowedPaths.add(path.dirname(resolved))
  return resolved
}

function resolveAllowedPath(target) {
  if (typeof target !== 'string' || !path.isAbsolute(target)) {
    throw new Error('文件路径无效。')
  }

  const resolved = path.resolve(target)
  if (!isInsideAllowedPath(resolved)) {
    throw new Error('该路径尚未通过打开文件或文件夹授权。')
  }
  return resolved
}

function focusWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function deliverOpenPath(target) {
  const resolved = allowOpenTarget(target)
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isLoadingMainFrame()) {
    pendingOpenPaths.push(resolved)
    return
  }

  focusWindow()
  mainWindow.webContents.send('lightmd:open-path', resolved)
}

function pathFromUrl(value) {
  if (!value.startsWith('lightmd://')) return null
  try {
    const url = new URL(value)
    const target = url.searchParams.get('path')
    return target ? path.resolve(target) : null
  } catch {
    return null
  }
}

function pathArguments(argv) {
  const args = argv.slice(app.isPackaged ? 1 : 2)
  return args
    .filter((value) => typeof value === 'string' && value.length > 0 && !value.startsWith('-'))
    .map((value) => pathFromUrl(value) ?? path.resolve(value))
    .filter((value) => value !== app.getAppPath())
}

function handleIncomingPath(target) {
  if (typeof target !== 'string' || !target) return
  const resolved = path.resolve(pathFromUrl(target) ?? target)

  try {
    const stat = fs.statSync(resolved)
    if (!stat.isFile() && !stat.isDirectory()) return
    deliverOpenPath(resolved)
  } catch {
    // The renderer will surface a clearer error if an external path disappears.
  }
}

function visibleDirectoryEntry(entry) {
  if (ignoredDirectoryEntries.has(entry.name) || entry.name.startsWith('.')) return false
  return entry.isDirectory() || (entry.isFile() && isMarkdownFile(entry.name))
}

async function readDirectory(target) {
  const resolved = resolveAllowedPath(target)
  const entries = await fsPromises.readdir(resolved, { withFileTypes: true })

  return entries
    .filter(visibleDirectoryEntry)
    .map((entry) => ({
      name: entry.name,
      path: path.join(resolved, entry.name),
      kind: entry.isDirectory() ? 'directory' : 'file',
    }))
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1
      return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
    })
}

async function inspectPath(target) {
  const resolved = allowOpenTarget(target)
  const stat = await fsPromises.stat(resolved)
  if (!stat.isFile() && !stat.isDirectory()) {
    throw new Error('只支持打开普通文件或文件夹。')
  }

  return {
    path: resolved,
    kind: stat.isDirectory() ? 'directory' : 'file',
    directory: stat.isDirectory() ? resolved : path.dirname(resolved),
  }
}

async function readFile(target) {
  const resolved = resolveAllowedPath(target)
  const stat = await fsPromises.stat(resolved)
  if (!stat.isFile()) throw new Error('目标不是文件。')
  if (stat.size > 10 * 1024 * 1024) throw new Error('文件超过 10MB，暂不支持打开。')

  return {
    path: resolved,
    name: path.basename(resolved),
    text: await fsPromises.readFile(resolved, 'utf8'),
  }
}

async function writeFile(target, contents) {
  const resolved = resolveAllowedPath(target)
  if (typeof contents !== 'string') throw new Error('写入内容无效。')
  await fsPromises.writeFile(resolved, contents, 'utf8')
}

async function chooseFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown 文件',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdx'] },
      { name: '文本文件', extensions: ['txt'] },
    ],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return allowOpenTarget(result.filePaths[0])
}

async function chooseFolder() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开文件夹',
    properties: ['openDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return allowOpenTarget(result.filePaths[0])
}

async function chooseSavePath(suggestedName) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存 Markdown 文件',
    defaultPath: typeof suggestedName === 'string' ? suggestedName : 'untitled.md',
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdx'] },
      { name: '文本文件', extensions: ['txt'] },
    ],
  })
  if (result.canceled || !result.filePath) return null
  return allowOpenTarget(result.filePath)
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

async function writeCliShim(bundlePath, destination) {
  const contents = `#!/bin/sh\nunset ELECTRON_RUN_AS_NODE\nexec /usr/bin/open -a ${shellQuote(bundlePath)} "$@"\n`
  await fsPromises.writeFile(destination, contents, { mode: 0o755 })
  await fsPromises.chmod(destination, 0o755)
}

async function installCliCommand() {
  if (process.platform !== 'darwin') {
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: '当前版本只在 macOS 上提供 lightmd 命令安装。',
    })
    return
  }

  if (!app.isPackaged) {
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: '请先打包 lightmd.app，再从应用菜单安装命令行工具。',
    })
    return
  }

  const bundlePath = path.resolve(path.dirname(process.execPath), '../..')
  const destination = '/usr/local/bin/lightmd'
  const temporaryPath = path.join(app.getPath('temp'), `lightmd-cli-${process.pid}`)

  try {
    await writeCliShim(bundlePath, temporaryPath)

    try {
      await fsPromises.access('/usr/local/bin', fs.constants.W_OK)
      await fsPromises.copyFile(temporaryPath, destination)
      await fsPromises.chmod(destination, 0o755)
    } catch {
      const command = `mkdir -p /usr/local/bin && cp ${shellQuote(temporaryPath)} ${shellQuote(destination)} && chmod +x ${shellQuote(destination)}`
      const script = `do shell script ${JSON.stringify(command)} with administrator privileges`
      await execFileAsync('/usr/bin/osascript', ['-e', script])
    }

    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: '命令行工具已安装',
      detail: '现在可以在终端运行：\n\nlightmd README.md\nlightmd .',
    })
  } catch (error) {
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      message: '命令行工具安装失败',
      detail: error instanceof Error ? error.message : String(error),
    })
  } finally {
    await fsPromises.rm(temporaryPath, { force: true }).catch(() => undefined)
  }
}

function sendMenuCommand(command) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  focusWindow()
  mainWindow.webContents.send('lightmd:menu-command', command)
}

function buildApplicationMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac
      ? [
          {
            label: 'lightmd',
            submenu: [
              { role: 'about', label: '关于 lightmd' },
              { type: 'separator' },
              { label: '安装 lightmd 命令…', click: () => void installCliCommand() },
              { type: 'separator' },
              { role: 'hide', label: '隐藏 lightmd' },
              { role: 'hideOthers', label: '隐藏其他' },
              { role: 'unhide', label: '全部显示' },
              { type: 'separator' },
              { role: 'quit', label: '退出 lightmd' },
            ],
          },
        ]
      : []),
    {
      label: '文件',
      submenu: [
        { label: '新建', accelerator: 'CmdOrCtrl+N', click: () => sendMenuCommand('new') },
        {
          label: '打开文件…',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            void chooseFile().then((target) => {
              if (target) deliverOpenPath(target)
            })
          },
        },
        {
          label: '打开文件夹…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            void chooseFolder().then((target) => {
              if (target) deliverOpenPath(target)
            })
          },
        },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => sendMenuCommand('save') },
        { type: 'separator' },
        { role: isMac ? 'close' : 'quit', label: isMac ? '关闭窗口' : '退出' },
      ],
    },
    { role: 'editMenu', label: '编辑' },
    { role: 'viewMenu', label: '视图' },
    { role: 'windowMenu', label: '窗口' },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  const isMac = process.platform === 'darwin'
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 760,
    minHeight: 520,
    show: false,
    title: 'lightmd',
    backgroundColor: '#fcfcfc',
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset',
          trafficLightPosition: { x: 12, y: 9 },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function registerIpc() {
  ipcMain.handle('lightmd:choose-file', () => chooseFile())
  ipcMain.handle('lightmd:choose-folder', () => chooseFolder())
  ipcMain.handle('lightmd:choose-save-path', (_event, suggestedName) =>
    chooseSavePath(suggestedName),
  )
  ipcMain.handle('lightmd:inspect-path', (_event, target) => inspectPath(target))
  ipcMain.handle('lightmd:read-file', (_event, target) => readFile(target))
  ipcMain.handle('lightmd:write-file', (_event, target, contents) => writeFile(target, contents))
  ipcMain.handle('lightmd:read-directory', (_event, target) => readDirectory(target))
  ipcMain.handle('lightmd:consume-open-paths', () => pendingOpenPaths.splice(0))
  ipcMain.handle('lightmd:install-cli', installCliCommand)
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    focusWindow()
    for (const target of pathArguments(commandLine)) handleIncomingPath(target)
  })

  app.on('open-file', (event, target) => {
    event.preventDefault()
    handleIncomingPath(target)
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    const target = pathFromUrl(url)
    if (target) handleIncomingPath(target)
  })

  registerIpc()

  app.whenReady().then(() => {
    buildApplicationMenu()
    createWindow()

    for (const target of pathArguments(process.argv)) {
      handleIncomingPath(target)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

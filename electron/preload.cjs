const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lightmd', {
  platform: process.platform,
  chooseFile: () => ipcRenderer.invoke('lightmd:choose-file'),
  chooseFolder: () => ipcRenderer.invoke('lightmd:choose-folder'),
  chooseSavePath: (suggestedName) =>
    ipcRenderer.invoke('lightmd:choose-save-path', suggestedName),
  inspectPath: (target) => ipcRenderer.invoke('lightmd:inspect-path', target),
  readFile: (target) => ipcRenderer.invoke('lightmd:read-file', target),
  writeFile: (target, contents) => ipcRenderer.invoke('lightmd:write-file', target, contents),
  readDirectory: (target) => ipcRenderer.invoke('lightmd:read-directory', target),
  consumeOpenPaths: () => ipcRenderer.invoke('lightmd:consume-open-paths'),
  installCli: () => ipcRenderer.invoke('lightmd:install-cli'),
  onOpenPath: (callback) => {
    const listener = (_event, target) => callback(target)
    ipcRenderer.on('lightmd:open-path', listener)
    return () => ipcRenderer.removeListener('lightmd:open-path', listener)
  },
  onMenuCommand: (callback) => {
    const listener = (_event, command) => callback(command)
    ipcRenderer.on('lightmd:menu-command', listener)
    return () => ipcRenderer.removeListener('lightmd:menu-command', listener)
  },
})

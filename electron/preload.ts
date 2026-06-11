import { contextBridge, ipcRenderer } from 'electron'

console.log('[PRELOAD] Script started')

try {
  const api = {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
    selectFiles: () => ipcRenderer.invoke('dialog:selectFiles'),
    getFileStats: (filePath: string) => ipcRenderer.invoke('fs:getFileStats', filePath),
    scanMarkdownFiles: (dirPath: string) =>
      ipcRenderer.invoke('fs:scanMarkdownFiles', dirPath),
    readFile: (filePath: string) =>
      ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('fs:writeFile', filePath, content),
    ensureDir: (dirPath: string) =>
      ipcRenderer.invoke('fs:ensureDir', dirPath),
    configGet: (key: string) =>
      ipcRenderer.invoke('config:get', key),
    configSet: (key: string, value: any) =>
      ipcRenderer.invoke('config:set', key, value),
    runMigration: (opts: {
      mdFiles: string[]
      mode: 'upload' | 'download'
      adapterId: string
      adapterConfig: Record<string, string>
      outputDir: string
    }) => ipcRenderer.invoke('migration:run', opts),
    onMigrationLog: (callback: (msg: string) => void) => {
      // 每次注册前先清理旧监听，避免叠加导致日志重复
      ipcRenderer.removeAllListeners('migration:log')
      ipcRenderer.on('migration:log', (_event, msg) => callback(msg))
    },
    removeMigrationLog: () => {
      ipcRenderer.removeAllListeners('migration:log')
    },
    openLogDir: () => ipcRenderer.invoke('app:openLogDir'),
    testConnection: (adapterId: string, config: Record<string, string>) =>
      ipcRenderer.invoke('config:testConnection', adapterId, config),
    uploadImages: (opts: {
      filePaths: string[]
      adapterId: string
      adapterConfig: Record<string, string>
    }) => ipcRenderer.invoke('upload:images', opts),
    readClipboardImage: () => ipcRenderer.invoke('clipboard:readImage'),
    downloadImageFromUrl: (url: string) => ipcRenderer.invoke('download:imageFromUrl', url),
    getAdapters: () => ipcRenderer.invoke('adapters:list'),
    log: (...args: any[]) => ipcRenderer.invoke('log', ...args),
  }

  contextBridge.exposeInMainWorld('electronAPI', api)
  console.log('[PRELOAD] electronAPI exposed successfully')
} catch (err) {
  console.error('[PRELOAD] Failed to expose electronAPI:', err)
}

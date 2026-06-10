import { app, shell, BrowserWindow, ipcMain, dialog, Menu, MenuItem, clipboard, nativeImage } from 'electron'
import { join } from 'path'
import { URL } from 'url'
import { promises as fs } from 'fs'
import { loadAdapters, findAdapter } from './services/plugin-loader'
import { runMigration, backupFile, writeOutputFile } from './services/migrator'
import { logger } from './services/logger'

// 判断是否开发模式
const isDev = process.argv.includes('--dev') || !app.isPackaged

function createWindow() {
  const preloadPath = join(__dirname, 'preload.js')
  console.log('[MAIN] Preload path:', preloadPath)
  console.log('[MAIN] Preload exists:', require('fs').existsSync(preloadPath))

  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'default',
    icon: join(__dirname, '../../public/icon.ico'),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  // 监听 preload 和页面的 console 输出
  win.webContents.on('console-message', (_event, level, message) => {
    const prefix = ['[VERBOSE]', '[INFO]', '[WARN]', '[ERROR]'][level] || '[LOG]'
    console.log(`[RENDERER]${prefix} ${message}`)
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../../dist/index.html'))
  }

  // 外部链接用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ========== 中文应用菜单 ==========
function setAppMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [
        { label: '的选择目录', click: () => { BrowserWindow.getFocusedWindow()?.webContents.send('menu:select-source') } },
        { label: '选择输出目录', click: () => { BrowserWindow.getFocusedWindow()?.webContents.send('menu:select-output') } },
        { type: 'separator' },
        { label: '退出', role: 'quit', accelerator: 'Ctrl+Q' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo', accelerator: 'Ctrl+Z' },
        { label: '重做', role: 'redo', accelerator: 'Ctrl+Shift+Z' },
        { type: 'separator' },
        { label: '剪切', role: 'cut', accelerator: 'Ctrl+X' },
        { label: '复制', role: 'copy', accelerator: 'Ctrl+C' },
        { label: '粘贴', role: 'paste', accelerator: 'Ctrl+V' },
        { label: '全选', role: 'selectAll', accelerator: 'Ctrl+A' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload', accelerator: 'Ctrl+R' },
        { label: '强制重新加载', role: 'forceReload', accelerator: 'Ctrl+Shift+R' },
        { label: '开发者工具', role: 'toggleDevTools', accelerator: 'F12' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom', accelerator: 'Ctrl+0' },
        { label: '放大', role: 'zoomIn', accelerator: 'Ctrl+=' },
        { label: '缩小', role: 'zoomOut', accelerator: 'Ctrl+-' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen', accelerator: 'F11' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '最大化', role: 'zoom' },
        { label: '关闭窗口', role: 'close' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于 MDPicSync', click: () => {
          const win = BrowserWindow.getFocusedWindow()
          if (win) dialog.showMessageBox(win, { title: '关于 MDPicSync', message: 'MDPicSync v0.1.0\nMarkdown 图片备份迁移工具', buttons: ['确定'] })
        }},
      ],
    },
  ])
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  setAppMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ========== IPC：目录选择 ==========
ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled) return null
  return result.filePaths[0]
})

// ========== IPC：文件选择（返回真实路径）==========
ipcMain.handle('dialog:selectFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] },
    ],
  })
  if (result.canceled) return []
  return result.filePaths
})

// ========== IPC：扫描 MD 文件 ==========
ipcMain.handle('fs:scanMarkdownFiles', async (_event: any, dirPath: string) => {
  const results: Array<{ path: string; name: string; imageCount: number }> = []
  await scanDir(dirPath, results)
  return results
})

async function scanDir(dir: string, results: Array<{ path: string; name: string; imageCount: number }>) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      await scanDir(fullPath, results)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const content = await fs.readFile(fullPath, 'utf-8')
      const imageCount = countImages(content)
      results.push({ path: fullPath, name: entry.name, imageCount })
    }
  }
}

function countImages(md: string): number {
  let count = 0
  // ![alt](url) 格式（支持路径含空格）
  const regex1 = /!\[.*?\]\([^)]+\)/gi
  let m: RegExpExecArray | null
  while ((m = regex1.exec(md)) !== null) count++
  // <img src="url"> 格式
  const regex2 = /<img[^>]+src=["'][^"']*["']/gi
  while ((m = regex2.exec(md)) !== null) count++
  return count
}

// ========== IPC：文件读写 ==========
ipcMain.handle('fs:getFileStats', async (_event: any, filePath: string) => {
  try {
    const stats = await fs.stat(filePath)
    return { size: stats.size, mtime: stats.mtime }
  } catch {
    return null
  }
})
ipcMain.handle('fs:readFile', async (_event: any, filePath: string) => {
  return await fs.readFile(filePath, 'utf-8')
})

ipcMain.handle('fs:writeFile', async (_event: any, filePath: string, content: string) => {
  await fs.writeFile(filePath, content, 'utf-8')
})

ipcMain.handle('fs:ensureDir', async (_event: any, dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true })
})

// ========== IPC：配置存取 ==========
const userDataPath = app.getPath('userData')

ipcMain.handle('config:get', async (_event: any, key: string) => {
  try {
    const content = await fs.readFile(join(userDataPath, 'config.json'), 'utf-8')
    const config = JSON.parse(content)
    return config[key] ?? null
  } catch {
    return null
  }
})

ipcMain.handle('config:set', async (_event: any, key: string, value: any) => {
  let config: any = {}
  try {
    const content = await fs.readFile(join(userDataPath, 'config.json'), 'utf-8')
    config = JSON.parse(content)
  } catch {
    // 文件不存在
  }
  config[key] = value
  await fs.writeFile(join(userDataPath, 'config.json'), JSON.stringify(config, null, 2), 'utf-8')
})

// ========== IPC：打开日志目录 ==========
ipcMain.handle('app:openLogDir', async () => {
  const logDir = logger.getLogDir()
  shell.openPath(logDir)
})

// ========== IPC：测试图床连接 ==========
ipcMain.handle('config:testConnection', async (_event: any, adapterId: string, config: Record<string, string>) => {
  try {
    // 确保 config 是纯可序列化对象（避免 V8 克隆失败）
    const plainConfig = JSON.parse(JSON.stringify(config || {}))

    const adapters = await loadAdapters()
    const adapter = findAdapter(adapters, adapterId)
    if (!adapter) {
      return { ok: false, error: '未知适配器: ' + adapterId }
    }

    if (typeof (adapter as any).validateConfig !== 'function') {
      // 适配器未实现 validateConfig，默认返回 true
      return { ok: true, error: '' }
    }

    const result = await (adapter as any).validateConfig(plainConfig)
    return {
      ok: result?.ok ?? false,
      error: result?.error || '',
      warning: result?.warning || '',
    }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || '连接测试异常') }
  }
})
// ========== IPC：上传图片到图床 ==========
ipcMain.handle('upload:images', async (_event: any, opts: {
  filePaths: string[]
  adapterId: string
  adapterConfig: Record<string, string>
}) => {
  const { filePaths, adapterId, adapterConfig } = opts
  const results: Array<{ success: boolean; url?: string; error?: string }> = []

  try {
    const adapters = await loadAdapters()
    const adapter = findAdapter(adapters, adapterId)
    if (!adapter) {
      return filePaths.map(() => ({ success: false, error: `未找到图床适配器: ${adapterId}` }))
    }

    for (const filePath of filePaths) {
      try {
        const result = await adapter.upload(filePath, adapterConfig)
        results.push({
          success: result.success,
          url: result.url || '',
          error: result.error || '',
        })
      } catch (e: any) {
        results.push({ success: false, error: e.message || '上传失败' })
      }
    }

    return results
  } catch (e: any) {
    return filePaths.map(() => ({ success: false, error: e.message || '上传失败' }))
  }
})

// ========== IPC：剪贴板图片读取 ==========
ipcMain.handle('clipboard:readImage', async () => {
  try {
    const image = clipboard.readImage('clipboard')
    if (image.isEmpty()) {
      return { hasImage: false }
    }
    const buffer = image.toPNG()
    const tempDir = join(app.getPath('temp'), 'mdpicsync-clipboard')
    await fs.mkdir(tempDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `clipboard-${timestamp}.png`
    const tempPath = join(tempDir, fileName)
    await fs.writeFile(tempPath, buffer)
    return { hasImage: true, tempPath, name: fileName }
  } catch (e: any) {
    return { hasImage: false, error: e.message }
  }
})

// ========== IPC：从 URL 下载图片 ==========
ipcMain.handle('download:imageFromUrl', async (_event: any, url: string) => {
  try {
    const https = require('https')
    const http = require('http')
    const { URL } = require('url')
    const parsed = new URL(url)

    const client = parsed.protocol === 'https:' ? https : http

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      client.get(url, (res: any) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      }).on('error', reject)
    })

    // 根据 Content-Type 推断扩展名
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'image/svg+xml': 'svg',
    }

    let ext = 'png'
    // 简单检查 magic bytes
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) ext = 'jpg'
    else if (buffer[0] === 0x89 && buffer[1] === 0x50) ext = 'png'
    else if (buffer[0] === 0x47 && buffer[1] === 0x49) ext = 'gif'
    else if (buffer[0] === 0x52 && buffer[1] === 0x49) ext = 'webp'

    const tempDir = join(app.getPath('temp'), 'mdpicsync-url')
    await fs.mkdir(tempDir, { recursive: true })
    const fileName = `url-${Date.now()}.${ext}`
    const tempPath = join(tempDir, fileName)
    await fs.writeFile(tempPath, buffer)

    return { success: true, tempPath, name: fileName, size: buffer.length }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

// 前端通过这一调用触发真正的图片迁移
// 参数：{ mdFiles, mode, adapterId, adapterConfig, outputDir }
ipcMain.handle('migration:run', async (_event: any, opts: {
  mdFiles: string[],
  mode: 'upload' | 'download',
  adapterId: string,
  adapterConfig: Record<string, string>,
  outputDir: string,
}) => {
  const { mdFiles, mode, adapterId, adapterConfig, outputDir } = opts

  // 加载所有适配器
  const adapters = await loadAdapters()
  const adapter = findAdapter(adapters, adapterId)
  if (!adapter) throw new Error(`未找到图床适配器: ${adapterId}`)

  const results: Array<{
    mdFile: string,
    totalImages: number,
    successCount: number,
    failCount: number,
    status: 'success' | 'partial' | 'failed',
  }> = []

  for (let i = 0; i < mdFiles.length; i++) {
    const mdFile = mdFiles[i]

    try {
      // 备份原文件
      await backupFile(mdFile)

      // 执行迁移
      const result = await runMigration(
        mdFile,
        mode,
        adapter,
        adapterConfig,
        outputDir,
        (msg: string) => {
          // 记录到日志文件
          logger.info(msg)
          // 实时发送日志到渲染进程
          _event.sender.send('migration:log', msg)
        }
      )

      // 写入输出文件
      const outPath = join(outputDir, mdFile.replace(/^.*[\\/]/, ''))
      await fs.mkdir(outputDir, { recursive: true })
      await fs.writeFile(outPath, result.newContent, 'utf-8')

      const status = result.failCount === 0 ? 'success' : result.successCount > 0 ? 'partial' : 'failed'
      results.push({
        mdFile,
        totalImages: result.totalImages,
        successCount: result.successCount,
        failCount: result.failCount,
        status,
      })
    } catch (e: any) {
      results.push({
        mdFile,
        totalImages: 0,
        successCount: 0,
        failCount: 1,
        status: 'failed',
      })
    }
  }

  return results
})

import * as fs from 'fs'
import * as path from 'path'

// 日志级别枚举
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

/**
 * 获取日志目录
 * 使用 app.isPackaged 判断是否生产模式
 */
function getLogDir(): string {
  // 通过 process.type 判断是否在 Electron 主进程中
  let isPackaged = false
  try {
    const { app } = require('electron') as any
    isPackaged = app.isPackaged
  } catch {
    // 非 Electron 环境，视为开发模式
  }

  if (!isPackaged) {
    // 开发模式：项目根目录/logs
    const projectRoot = getProjectRoot()
    return path.join(projectRoot, 'logs')
  }

  // 生产模式：exe 同级目录
  const exeDir = path.dirname(process.execPath)
  return path.join(exeDir, 'logs')
}

/** 获取项目根目录（开发期）或 exe 目录（生产期） */
function getProjectRoot(): string {
  // dist-electron/electron/services/logger.js → 上两级是 dist-electron
  // 再上一级是项目根
  const p = path.resolve(__dirname, '..', '..', '..')
  return p
}

// 延迟初始化，避免在模块顶层执行
let _LOG_DIR: string | null = null

function getLogDirLazy(): string {
  if (!_LOG_DIR) {
    _LOG_DIR = getLogDir()
  }
  return _LOG_DIR
}

// 确保日志目录存在（仅在初始化时调用一次）
let _dirEnsured = false
async function ensureLogDirAsync(): Promise<void> {
  if (_dirEnsured) return
  const dir = getLogDirLazy()
  try {
    await fs.promises.mkdir(dir, { recursive: true })
    _dirEnsured = true
  } catch {
    // 如果 exe 目录不可写（如 Program Files），降级到 userData
    try {
      const { app } = require('electron') as any
      const fallback = path.join(app.getPath('userData'), 'logs')
      console.warn(`[LOGGER] 无法写入安装目录，降级到: ${fallback}`)
      _LOG_DIR = fallback
      await fs.promises.mkdir(fallback, { recursive: true })
      _dirEnsured = true
    } catch {
      // 最终降级，使用临时目录
      _LOG_DIR = path.join(require('os').tmpdir(), 'mdpicsync-logs')
      await fs.promises.mkdir(_LOG_DIR, { recursive: true })
      _dirEnsured = true
    }
  }
}

// 获取当前本地日期字符串 YYYY-MM-DD
function getLocalDateStr(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取当前本地时间字符串 YYYY-MM-DD HH:mm:ss
function getLocalTimeStr(): string {
  const now = new Date()
  const YYYY = now.getFullYear()
  const MM = String(now.getMonth() + 1).padStart(2, '0')
  const DD = String(now.getDate()).padStart(2, '0')
  const HH = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`
}

// 获取当前日志文件路径
function getLogFilePath(): string {
  return path.join(getLogDirLazy(), `${getLocalDateStr()}.log`)
}

// 格式化日志消息
function formatLogMessage(level: LogLevel, message: string): string {
  return `[${getLocalTimeStr()}] [${level}] ${message}`
}

/**
 * 异步写缓冲队列
 * 将日志消息缓冲后批量写入，避免每次调用都执行 I/O
 */
const writeQueue: string[] = []
let writeInProgress = false

async function flushWriteQueue(): Promise<void> {
  if (writeInProgress || writeQueue.length === 0) return
  writeInProgress = true

  // 取出当前所有待写消息
  const batch = writeQueue.splice(0, writeQueue.length)
  const content = batch.join('\n') + '\n'

  try {
    await ensureLogDirAsync()
    const logFile = getLogFilePath()
    await fs.promises.appendFile(logFile, content, 'utf8')
  } catch (error) {
    console.error('[LOGGER] 写入日志文件失败:', error)
  } finally {
    writeInProgress = false
    // 如果在写入期间有新消息入队，继续刷新
    if (writeQueue.length > 0) {
      flushWriteQueue().catch(() => {})
    }
  }
}

// 定时刷新（每 500ms 或队列达到 10 条时刷新）
const FLUSH_INTERVAL = 500
const FLUSH_THRESHOLD = 10

let flushTimer: ReturnType<typeof setInterval> | null = null
function startFlushTimer(): void {
  if (flushTimer) return
  flushTimer = setInterval(() => {
    if (writeQueue.length > 0) {
      flushWriteQueue().catch(() => {})
    }
  }, FLUSH_INTERVAL)
  // 允许进程正常退出，不因定时器阻塞
  if (flushTimer && typeof flushTimer === 'object' && 'unref' in flushTimer) {
    flushTimer.unref()
  }
}

function enqueueWrite(formattedMessage: string): void {
  writeQueue.push(formattedMessage)
  // 达到阈值立即刷新
  if (writeQueue.length >= FLUSH_THRESHOLD) {
    flushWriteQueue().catch(() => {})
  } else {
    // 否则启动定时刷新
    startFlushTimer()
  }
}

// 导出日志方法
export const logger = {
  info(message: string): void {
    const formatted = formatLogMessage(LogLevel.INFO, message)
    console.log(formatted)
    enqueueWrite(formatted)
  },

  warn(message: string): void {
    const formatted = formatLogMessage(LogLevel.WARN, message)
    console.warn(formatted)
    enqueueWrite(formatted)
  },

  error(message: string): void {
    const formatted = formatLogMessage(LogLevel.ERROR, message)
    console.error(formatted)
    enqueueWrite(formatted)
  },

  debug(message: string): void {
    const formatted = formatLogMessage(LogLevel.DEBUG, message)
    console.debug(formatted)
    enqueueWrite(formatted)
  },

  // 获取日志目录路径
  getLogDir(): string {
    return getLogDirLazy()
  },

  // 获取当前日志文件路径
  getCurrentLogPath(): string {
    return getLogFilePath()
  },

  // 立即刷新缓冲区（用于进程退出前确保日志落盘）
  async flush(): Promise<void> {
    if (flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
    await flushWriteQueue()
  },
}

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
 * 开发期：项目根目录/logs
 * 生产期：exe 同级目录/logs（失败时降级到 userData）
 */
function getLogDir(): string {
  // 判断是否开发模式：检查是否存在 dist-electron 目录（编译产物）
  const possibleProjectRoot = getProjectRoot()
  const isDev = fs.existsSync(path.join(possibleProjectRoot, 'dist-electron'))

  if (isDev) {
    return path.join(possibleProjectRoot, 'logs')
  }

  // 生产期：exe 同级目录
  const exeDir = path.dirname(process.execPath)
  return path.join(exeDir, 'logs')
}

/** 获取项目根目录（开发期）或 exe 目录（生产期） */
function getProjectRoot(): string {
  // dist-electron/electron/services/logger.js → 上两级是项目根
  const p = path.resolve(__dirname, '..', '..')
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

// 确保日志目录存在
function ensureLogDir(): void {
  const dir = getLogDirLazy()
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch (e) {
      // 如果 exe 目录不可写（如 Program Files），降级到 userData
      const { app } = require('electron') as any
      const fallback = path.join(app.getPath('userData'), 'logs')
      console.warn(`[LOGGER] 无法写入安装目录，降级到: ${fallback}`)
      _LOG_DIR = fallback
      fs.mkdirSync(fallback, { recursive: true })
    }
  }
}

// 获取当前本地日期字符串 YYYY-MM-DD（修复时区问题）
function getLocalDateStr(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取当前本地时间字符串 YYYY-MM-DD HH:mm:ss（修复时区问题）
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

// 获取当前日志文件路径（使用本地日期）
function getLogFilePath(): string {
  return path.join(getLogDirLazy(), `${getLocalDateStr()}.log`)
}

// 格式化日志消息（使用本地时间）
function formatLogMessage(level: LogLevel, message: string): string {
  return `[${getLocalTimeStr()}] [${level}] ${message}`
}

// 写入日志文件
function writeToFile(formattedMessage: string): void {
  try {
    ensureLogDir()
    const logFile = getLogFilePath()
    fs.appendFileSync(logFile, formattedMessage + '\n', 'utf8')
  } catch (error) {
    console.error('[LOGGER] 写入日志文件失败:', error)
  }
}

// 导出日志方法
export const logger = {
  info(message: string): void {
    const formatted = formatLogMessage(LogLevel.INFO, message)
    console.log(formatted)
    writeToFile(formatted)
  },

  warn(message: string): void {
    const formatted = formatLogMessage(LogLevel.WARN, message)
    console.warn(formatted)
    writeToFile(formatted)
  },

  error(message: string): void {
    const formatted = formatLogMessage(LogLevel.ERROR, message)
    console.error(formatted)
    writeToFile(formatted)
  },

  debug(message: string): void {
    const formatted = formatLogMessage(LogLevel.DEBUG, message)
    console.debug(formatted)
    writeToFile(formatted)
  },

  // 获取日志目录路径
  getLogDir(): string {
    return getLogDirLazy()
  },

  // 获取当前日志文件路径
  getCurrentLogPath(): string {
    return getLogFilePath()
  }
}

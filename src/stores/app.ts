import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface MdFile {
  path: string
  name: string
  imageCount: number
  selected: boolean
}

export interface AdapterConfig {
  id: string
  name: string
  configFields: Array<{ key: string; label: string; type: string; placeholder?: string; required: boolean }>
  configValues: Record<string, string>
}

export const useAppStore = defineStore('app', () => {
  // 模式：upload = 本地→图床，download = 图床→本地
  const mode = ref<'upload' | 'download'>('upload')

  // 目录
  const sourceDir = ref('')
  const outputDir = ref('')

  // 文件列表
  const mdFiles = ref<MdFile[]>([])

  // 当前选中的图床适配器
  const activeAdapterId = ref('')

  // 图床配置（从主进程加载）
  const adapters = ref<AdapterConfig[]>([])

  // 日志
  const logs = ref<string[]>([])

  // 运行状态
  const isRunning = ref(false)
  const progress = ref(0)

  // 扫描文件列表
  async function scanFiles(dir: string) {
    const files = await (window as any).electronAPI.scanMarkdownFiles(dir)
    mdFiles.value = files.map((f: any) => ({ ...f, selected: true }))
  }

  // 添加日志
  function addLog(msg: string) {
    logs.value.push(msg)
  }

  // 清空日志
  function clearLogs() {
    logs.value = []
  }

  return {
    mode, sourceDir, outputDir, mdFiles,
    activeAdapterId, adapters,
    logs, isRunning, progress,
    scanFiles, addLog, clearLogs,
  }
})

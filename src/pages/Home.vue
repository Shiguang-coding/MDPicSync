<template>
  <div class="home-page">
    <!-- 顶部标题栏 -->
    <div class="page-header">
      <h2>📁 Markdown 图片迁移</h2>
      <div class="header-actions">
        <el-button size="small" @click="openLogDir">
          📄 查看日志
        </el-button>
        <el-tag :type="mode === 'upload' ? 'primary' : 'success'" size="large">
          {{ mode === 'upload' ? '📤 本地 → 图床' : '📥 图床 → 本地' }}
        </el-tag>
      </div>
    </div>

    <!-- 模式切换 -->
    <el-card class="mode-card" shadow="never">
      <el-radio-group v-model="mode" size="large" @change="handleModeChange">
        <el-radio-button label="upload">
          <el-icon><Top /></el-icon> 上传至图床
        </el-radio-button>
        <el-radio-button label="download">
          <el-icon><Bottom /></el-icon> 下载至本地
        </el-radio-button>
      </el-radio-group>
    </el-card>

    <!-- 目录选择 -->
    <el-card class="dir-card" shadow="never">
      <div class="dir-row">
        <span class="dir-label">源目录</span>
        <el-input v-model="sourceDir" placeholder="选择 Markdown 文件所在目录" readonly class="dir-input" />
        <el-button type="primary" @click="selectSourceDir">浏览...</el-button>
      </div>
      <div class="dir-row" style="margin-top:12px">
        <span class="dir-label">输出目录</span>
        <el-input v-model="outputDir" placeholder="处理后文件保存目录" readonly class="dir-input" />
        <el-button type="primary" @click="selectOutputDir">浏览...</el-button>
      </div>
    </el-card>

    <!-- 图床选择 -->
    <el-card class="adapter-card" shadow="never">
      <div class="adapter-row">
        <span class="dir-label">图床</span>
        <el-select v-model="activeAdapterId" placeholder="请选择图床" style="width:300px">
          <el-option
            v-for="adapter in adapters"
            :key="adapter.id"
            :label="adapter.name"
            :value="adapter.id"
          />
        </el-select>
        <el-button plain type="primary" size="small" @click="goSettings">⚙️ 配置参数</el-button>
      </div>
    </el-card>

    <!-- 文件列表 -->
    <el-card class="file-card" shadow="never" v-if="mdFiles.length > 0">
      <template #header>
        <div class="file-header">
          <span>📄 扫描到 {{ mdFiles.length }} 个 Markdown 文件</span>
          <div>
            <el-button size="small" @click="selectAll(true)">全选</el-button>
            <el-button size="small" @click="selectAll(false)">取消全选</el-button>
          </div>
        </div>
      </template>
      <el-table ref="fileTableRef" :data="mdFiles" style="width:100%" max-height="280" stripe row-key="path" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="45" :reserve-selection="true" />
        <el-table-column prop="name" label="文件名" min-width="220" />
        <el-table-column label="图片数量" width="120" align="center">
          <template #default="{ row }">
            <el-tag>{{ row.imageCount }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="路径" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">{{ row.path }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 执行按钮 -->
    <div class="action-bar">
      <el-button
        type="primary"
        size="large"
        :loading="isRunning"
        :disabled="!canExecute"
        @click="startMigration"
        style="width:220px;height:44px;font-size:16px"
      >
        {{ isRunning ? '处理中...' : '🚀 开始执行' }}
      </el-button>
    </div>

    <!-- 进度条 -->
    <el-progress
      v-if="isRunning"
      :percentage="progress"
      :stroke-width="12"
      style="margin-top:16px"
      color="linear-gradient(135deg, #409eff, #a855f7)"
    />

    <!-- 日志面板 -->
    <el-card class="log-card" shadow="never" v-if="logs.length > 0">
      <template #header>
        <div class="file-header">
          <span>📝 执行日志</span>
          <div>
            <el-button size="small" @click="copyLogs">📋 复制</el-button>
            <el-button size="small" @click="clearLogs">清空</el-button>
          </div>
        </div>
      </template>
      <div class="log-content">
        <div v-for="(log, i) in logs" :key="i" class="log-line">{{ log }}</div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Top, Bottom } from '@element-plus/icons-vue'

const router = useRouter()

const mode = ref<'upload' | 'download'>('upload')
const sourceDir = ref('')
const outputDir = ref('')
const activeAdapterId = ref('')
const adapters = ref<any[]>([])
const mdFiles = ref<any[]>([])
const selectedRows = ref<any[]>([])  // 当前选中行（由 el-table selection-change 维护）
const fileTableRef = ref<any>(null)  // el-table ref
const isRunning = ref(false)
const progress = ref(0)
const logs = ref<string[]>([])

const canExecute = computed(() =>
  sourceDir.value && outputDir.value && activeAdapterId.value && selectedRows.value.length > 0
)

onMounted(async () => {
  await loadAdapters()
  // 加载保存的配置
  const savedMode = await (window as any).electronAPI.configGet('mode')
  if (savedMode) mode.value = savedMode
  const savedSource = await (window as any).electronAPI.configGet('sourceDir')
  if (savedSource) { sourceDir.value = savedSource; await scanFiles() }
  const savedOutput = await (window as any).electronAPI.configGet('outputDir')
  if (savedOutput) outputDir.value = savedOutput
  const savedAdapter = await (window as any).electronAPI.configGet('activeAdapter')
  if (savedAdapter) activeAdapterId.value = savedAdapter
})

async function loadAdapters() {
  try {
    adapters.value = await (window as any).electronAPI.getAdapters()
  } catch {
    adapters.value = []
  }
}

async function selectSourceDir() {
  const path = await (window as any).electronAPI.selectDirectory()
  if (path) {
    sourceDir.value = path
    await (window as any).electronAPI.configSet('sourceDir', path)
    await scanFiles()
  }
}

async function selectOutputDir() {
  const path = await (window as any).electronAPI.selectDirectory()
  if (path) {
    outputDir.value = path
    await (window as any).electronAPI.configSet('outputDir', path)
  }
}

async function scanFiles() {
  if (!sourceDir.value) return
  const files = await (window as any).electronAPI.scanMarkdownFiles(sourceDir.value)
  mdFiles.value = files.map((f: any) => ({ ...f, selected: true }))
  // 等待 DOM 更新后全选表格行
  nextTick(() => {
    fileTableRef.value?.toggleAllSelection()
  })
}

function handleSelectionChange(rows: any[]) {
  selectedRows.value = rows
}

function selectAll(val: boolean) {
  if (!fileTableRef.value) return
  if (val) {
    fileTableRef.value.toggleAllSelection()
  } else {
    fileTableRef.value.clearSelection()
  }
}

function handleModeChange() {
  ;(window as any).electronAPI.configSet('mode', mode.value)
}

function goSettings() {
  router.push('/settings')
}

function addLog(msg: string) {
  logs.value.push(msg)
}

function clearLogs() {
  logs.value = []
}

async function copyLogs() {
  if (logs.value.length === 0) {
    ElMessage.warning('暂无日志可复制')
    return
  }
  try {
    await navigator.clipboard.writeText(logs.value.join('\n'))
    ElMessage.success('日志已复制到剪贴板')
  } catch {
    // fallback: 用 textarea 兼容旧浏览器
    const ta = document.createElement('textarea')
    ta.value = logs.value.join('\n')
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage.success('日志已复制到剪贴板')
  }
}

async function openLogDir() {
  try {
    await (window as any).electronAPI.openLogDir()
  } catch (e: any) {
    ElMessage.error('打开日志目录失败: ' + e.message)
  }
}

async function startMigration() {
  isRunning.value = true
  progress.value = 0
  logs.value = []
  // 先清理旧监听，避免日志重复
  ;(window as any).electronAPI.removeMigrationLog()
  addLog(`🚀 开始执行 | 模式: ${mode.value === 'upload' ? '本地→图床' : '图床→本地'}`)
  addLog(`📂 源目录: ${sourceDir.value}`)
  addLog(`💾 输出目录: ${outputDir.value}`)
  addLog(`🔌 图床: ${activeAdapterId.value}`)
  addLog('')

  // 使用表格当前选中行，而非 f.selected（el-table type="selection" 不修改 row.selected）
  const selectedFiles = selectedRows.value.map((row: any) => row.path)
  if (selectedFiles.length === 0) {
    ElMessage.warning('请至少选择一个文件')
    isRunning.value = false
    return
  }

  try {
    // 监听主进程推送的实时日志
    ;(window as any).electronAPI.onMigrationLog((msg: string) => {
      addLog(msg)
    })

    // 从配置中读取当前图床的配置
    const adapterConfig = await (window as any).electronAPI.configGet(`adapter_${activeAdapterId.value}`) || {}

    const results = await (window as any).electronAPI.runMigration({
      mdFiles: selectedFiles,
      mode: mode.value,
      adapterId: activeAdapterId.value,
      adapterConfig,
      outputDir: outputDir.value,
    })

    progress.value = 100
    addLog('')
    addLog('🎉 全部处理完成！')
    addLog(`📊 结果: ${JSON.stringify(results, null, 2)}`)
    ElMessage.success('处理完成！')
  } catch (e: any) {
    addLog(`❌ 执行出错: ${e.message}`)
    ElMessage.error(e.message)
  } finally {
    isRunning.value = false
  }
}
</script>

<style scoped>
.home-page {
  max-width: 960px;
  margin: 0 auto;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.page-header h2 {
  margin: 0;
  color: #e0e0e0;
}
.mode-card, .dir-card, .adapter-card, .file-card, .log-card {
  background: #1a1a2e !important;
  border: 1px solid #2a2a3e !important;
  color: #e0e0e0;
  margin-bottom: 16px;
}
.dir-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dir-label {
  min-width: 70px;
  color: #a0a0b8;
  font-size: 14px;
}
.dir-input {
  flex: 1;
}
.adapter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #e0e0e0;
}
.log-content {
  background: #0d0d1a;
  border-radius: 6px;
  padding: 12px;
  max-height: 260px;
  overflow-y: auto;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.8;
  color: #c0c0d8;
}
.log-line {
  white-space: pre-wrap;
  word-break: break-all;
}
.action-bar {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>

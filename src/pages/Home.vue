<template>
  <div class="home-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-title-group">
        <h1 class="page-title">图片迁移</h1>
        <p class="page-description">批量处理 Markdown 文件中的图片链接</p>
      </div>
      <div class="header-actions">
        <el-button size="small" @click="openLogDir" class="btn-ghost">
          <el-icon><Document /></el-icon>
          <span>查看日志</span>
        </el-button>
        <el-tag 
          :type="mode === 'upload' ? 'warning' : 'success'" 
          size="default"
          effect="dark"
          round
        >
          {{ mode === 'upload' ? '本地 → 图床' : '图床 → 本地' }}
        </el-tag>
      </div>
    </div>

    <!-- Mode Selection -->
    <div class="section-card">
      <div class="section-label">迁移方向</div>
      <el-radio-group v-model="mode" size="default" @change="handleModeChange" class="mode-switcher">
        <el-radio-button value="upload">
          <el-icon><Top /></el-icon> 上传至图床
        </el-radio-button>
        <el-radio-button value="download">
          <el-icon><Bottom /></el-icon> 下载至本地
        </el-radio-button>
      </el-radio-group>
    </div>

    <!-- Directory Selection -->
    <div class="section-card">
      <div class="section-label">目录配置</div>
      <div class="dir-grid">
        <div class="dir-row">
          <span class="dir-label">源目录</span>
          <el-input v-model="sourceDir" placeholder="选择 Markdown 文件所在目录" readonly class="dir-input" />
          <el-button type="primary" @click="selectSourceDir">浏览</el-button>
        </div>
        <div class="dir-row">
          <span class="dir-label">输出目录</span>
          <el-input v-model="outputDir" placeholder="处理后文件保存目录" readonly class="dir-input" />
          <el-button type="primary" @click="selectOutputDir">浏览</el-button>
        </div>
      </div>
    </div>

    <!-- Image Host Selection -->
    <div class="section-card">
      <div class="section-label">图床服务</div>
      <div class="adapter-row">
        <el-select v-model="activeAdapterId" placeholder="请选择图床" class="adapter-select">
          <el-option
            v-for="adapter in adapters"
            :key="adapter.id"
            :label="adapter.name"
            :value="adapter.id"
          />
        </el-select>
        <el-button plain type="primary" size="default" @click="goSettings">
          <el-icon><Setting /></el-icon>
          <span>配置参数</span>
        </el-button>
      </div>
    </div>

    <!-- File List -->
    <div class="section-card" v-if="mdFiles.length > 0">
      <div class="section-header">
        <div class="section-label">扫描结果</div>
        <div class="section-actions">
          <span class="file-count">{{ mdFiles.length }} 个文件</span>
          <el-button size="small" @click="selectAll(true)" class="btn-ghost">全选</el-button>
          <el-button size="small" @click="selectAll(false)" class="btn-ghost">取消全选</el-button>
        </div>
      </div>
      <el-table 
        ref="fileTableRef" 
        :data="mdFiles" 
        style="width:100%" 
        max-height="280" 
        stripe 
        row-key="path" 
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="45" :reserve-selection="true" />
        <el-table-column prop="name" label="文件名" min-width="220" />
        <el-table-column label="图片数量" width="120" align="center">
          <template #default="{ row }">
            <span class="image-count-badge">{{ row.imageCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="路径" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="path-text">{{ row.path }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Action Button -->
    <div class="action-bar">
      <el-button
        type="primary"
        size="large"
        :loading="isRunning"
        :disabled="!canExecute"
        @click="startMigration"
        class="action-button"
      >
        <el-icon v-if="!isRunning"><CaretRight /></el-icon>
        <span>{{ isRunning ? '处理中...' : '开始执行' }}</span>
      </el-button>
    </div>

    <!-- Progress -->
    <div class="progress-wrapper" v-if="isRunning">
      <el-progress
        :percentage="progress"
        :stroke-width="6"
        :show-text="false"
        color="var(--accent-primary)"
      />
      <span class="progress-label">{{ progress }}%</span>
    </div>

    <!-- Log Panel -->
    <div class="section-card" v-if="logs.length > 0">
      <div class="section-header">
        <div class="section-label">执行日志</div>
        <div class="section-actions">
          <el-button size="small" @click="copyLogs" class="btn-ghost">复制</el-button>
          <el-button size="small" @click="clearLogs" class="btn-ghost">清空</el-button>
        </div>
      </div>
      <div class="log-content">
        <div v-for="(log, i) in logs" :key="i" class="log-line">{{ log }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Top, Bottom, Setting, Document, CaretRight } from '@element-plus/icons-vue'

const router = useRouter()

const mode = ref<'upload' | 'download'>('upload')
const sourceDir = ref('')
const outputDir = ref('')
const activeAdapterId = ref('')
const adapters = ref<any[]>([])
const mdFiles = ref<any[]>([])
const selectedRows = ref<any[]>([])
const fileTableRef = ref<any>(null)
const isRunning = ref(false)
const progress = ref(0)
const logs = ref<string[]>([])

const canExecute = computed(() =>
  sourceDir.value && outputDir.value && activeAdapterId.value && selectedRows.value.length > 0
)

onMounted(async () => {
  await loadAdapters()
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
  ;(window as any).electronAPI.removeMigrationLog()
  addLog(`🚀 开始执行 | 模式: ${mode.value === 'upload' ? '本地→图床' : '图床→本地'}`)
  addLog(`📂 源目录: ${sourceDir.value}`)
  addLog(`💾 输出目录: ${outputDir.value}`)
  addLog(`🔌 图床: ${activeAdapterId.value}`)
  addLog('')

  const selectedFiles = selectedRows.value.map((row: any) => row.path)
  if (selectedFiles.length === 0) {
    ElMessage.warning('请至少选择一个文件')
    isRunning.value = false
    return
  }

  try {
    ;(window as any).electronAPI.onMigrationLog((msg: string) => {
      addLog(msg)
    })

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
  max-width: 900px;
  margin: 0 auto;
}

/* ===== Page Header ===== */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 28px;
}

.page-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.page-description {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ===== Section Cards ===== */
.section-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 12px;
}

.section-header .section-label {
  margin-bottom: 0;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-count {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 4px 10px;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
}

/* ===== Mode Switcher ===== */
.mode-switcher {
  display: flex;
  gap: 0;
}

/* ===== Directory Grid ===== */
.dir-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dir-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dir-label {
  min-width: 70px;
  color: var(--text-secondary);
  font-size: 13.5px;
  font-weight: 500;
}

.dir-input {
  flex: 1;
}

/* ===== Adapter Row ===== */
.adapter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.adapter-select {
  flex: 1;
  max-width: 400px;
}

/* ===== Table Enhancements ===== */
.image-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 8px;
  background: var(--accent-primary-subtle);
  color: var(--accent-primary);
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  font-weight: 600;
}

.path-text {
  font-size: 12.5px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', 'Consolas', monospace;
}

/* ===== Action Bar ===== */
.action-bar {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  margin-bottom: 8px;
}

.action-button {
  min-width: 200px;
  height: 48px;
  font-size: 15px;
  font-weight: 600;
  border-radius: var(--radius-md) !important;
  letter-spacing: 0.3px;
}

/* ===== Progress ===== */
.progress-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.progress-wrapper .el-progress {
  flex: 1;
}

.progress-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

/* ===== Log Content ===== */
.log-content {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  max-height: 260px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--text-secondary);
}

.log-line {
  white-space: pre-wrap;
  word-break: break-all;
}

/* ===== Ghost Button ===== */
.btn-ghost {
  background: transparent !important;
  border-color: transparent !important;
  color: var(--text-secondary) !important;
}

.btn-ghost:hover {
  background: var(--bg-elevated) !important;
  color: var(--text-primary) !important;
}
</style>

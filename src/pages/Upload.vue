<template>
  <div class="upload-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-title-group">
        <h1 class="page-title">图片上传</h1>
        <p class="page-description">上传图片到图床，获取链接</p>
      </div>
      <div class="header-actions">
        <el-button size="small" @click="openLogDir" class="btn-ghost">
          <el-icon><Document /></el-icon>
          <span>查看日志</span>
        </el-button>
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

    <!-- Upload Zone -->
    <div class="section-card">
      <div
        class="upload-drop-zone"
        @click="selectFiles"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
        :class="{ 'is-dragover': isDragOver }"
      >
        <div class="upload-icon">
          <el-icon :size="32"><UploadFilled /></el-icon>
        </div>
        <div class="upload-text">
          点击选择文件 <span class="upload-divider">或</span> 拖拽到此处
        </div>
        <div class="upload-hint">
          支持 jpg / png / gif / webp · 可多选 · 也可 <kbd>Ctrl+V</kbd> 粘贴
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <el-button size="small" @click="pasteFromClipboard" :loading="pasting" class="btn-ghost">
          <el-icon><DocumentCopy /></el-icon>
          <span>剪贴板图片</span>
        </el-button>
        <el-button size="small" @click="showUrlDialog = true" class="btn-ghost">
          <el-icon><Link /></el-icon>
          <span>URL 上传</span>
        </el-button>
      </div>
    </div>

    <!-- Link Format Selector -->
    <div class="section-card" v-if="uploadResults.length > 0">
      <div class="section-header">
        <div class="section-label">链接格式</div>
        <el-input
          v-if="linkFormat === 'custom'"
          v-model="customTemplate"
          size="small"
          class="custom-template-input"
          placeholder="$fileName / $url / $ext"
        />
      </div>
      <div class="format-selector">
        <el-radio-group v-model="linkFormat" size="small">
          <el-radio-button value="url">URL</el-radio-button>
          <el-radio-button value="markdown">Markdown</el-radio-button>
          <el-radio-button value="html">HTML</el-radio-button>
          <el-radio-button value="ubb">UBB</el-radio-button>
          <el-radio-button value="custom">Custom</el-radio-button>
        </el-radio-group>
        <div class="format-hint" v-if="linkFormat === 'custom'">
          可用变量：<code>$url</code> <code>$fileName</code> <code>$ext</code>
        </div>
      </div>
    </div>

    <!-- File List -->
    <div class="section-card" v-if="fileList.length > 0">
      <div class="section-header">
        <div class="section-label">待上传文件</div>
        <div class="section-actions">
          <span class="file-count">{{ fileList.length }} 个文件</span>
          <el-button size="small" @click="clearFiles" class="btn-ghost">清空列表</el-button>
        </div>
      </div>
      <el-table :data="fileList" style="width:100%" max-height="280" stripe>
        <el-table-column label="文件名" min-width="220" prop="name" />
        <el-table-column label="大小" width="120" align="center">
          <template #default="{ row }">
            <span class="file-size">{{ formatFileSize(row.size) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <span 
              class="status-badge"
              :class="`status-${row.status}`"
            >
              {{ getStatusText(row.status) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'success' && row.url"
              size="small"
              type="primary"
              link
              @click="copyUrl(row.url!)"
            >
              复制链接
            </el-button>
            <el-button
              v-if="row.status === 'error'"
              size="small"
              type="danger"
              link
              @click="removeFile(row)"
            >
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Upload Button -->
    <div class="action-bar">
      <el-button
        type="primary"
        size="large"
        :loading="isUploading"
        :disabled="!canUpload"
        @click="startUpload"
        class="action-button"
      >
        <el-icon v-if="!isUploading"><CaretRight /></el-icon>
        <span>{{ isUploading ? '上传中...' : '开始上传' }}</span>
      </el-button>
    </div>

    <!-- Progress -->
    <div class="progress-wrapper" v-if="isUploading">
      <el-progress
        :percentage="progress"
        :stroke-width="6"
        :show-text="false"
        color="var(--accent-primary)"
      />
      <span class="progress-label">{{ progress }}%</span>
    </div>

    <!-- Upload Results -->
    <div class="section-card" v-if="uploadResults.length > 0">
      <div class="section-header">
        <div class="section-label">上传结果</div>
        <div class="section-actions">
          <el-button size="small" @click="copyAllUrls" class="btn-ghost">
            <el-icon><DocumentCopy /></el-icon>
            <span>复制全部 {{ formatLabel }}</span>
          </el-button>
        </div>
      </div>
      <div class="result-list">
        <div
          v-for="(result, index) in uploadResults"
          :key="index"
          class="result-item"
          :class="{ 'result-error': !result.success }"
        >
          <div class="result-status">
            <el-icon v-if="result.success" color="var(--accent-success)" :size="16"><CircleCheckFilled /></el-icon>
            <el-icon v-else color="var(--accent-error)" :size="16"><CircleCloseFilled /></el-icon>
          </div>
          <span class="result-name">{{ result.fileName }}</span>
          <span v-if="result.success" class="result-url">
            <el-input v-model="result.displayUrl" size="small" readonly>
              <template #append>
                <el-button @click="copyUrl(result.displayUrl!)">复制</el-button>
              </template>
            </el-input>
          </span>
          <span v-else class="result-error-text">{{ result.error }}</span>
        </div>
      </div>
    </div>

    <!-- URL Upload Dialog -->
    <el-dialog
      v-model="showUrlDialog"
      title="URL 上传"
      width="480px"
      :close-on-click-modal="false"
    >
      <div class="url-dialog-body">
        <el-input
          v-model="urlInput"
          type="textarea"
          :rows="5"
          placeholder="输入图片 URL，每行一个&#10;支持 jpg/png/gif/webp 等格式"
        />
        <div class="url-hint">
          图片会先下载到本地临时目录，再上传到图床
        </div>
      </div>
      <template #footer>
        <el-button @click="showUrlDialog = false">取消</el-button>
        <el-button type="primary" @click="uploadFromUrls" :loading="urlUploading">
          添加并上传
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { UploadFilled, CircleCheckFilled, CircleCloseFilled, DocumentCopy, Link, Document, Setting, CaretRight } from '@element-plus/icons-vue'

const router = useRouter()

// ===== State =====
const activeAdapterId = ref('')
const adapters = ref<any[]>([])
const fileList = ref<Array<{
  name: string
  path: string
  size: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  url: string
  error: string
}>>([])
const isUploading = ref(false)
const isDragOver = ref(false)
const progress = ref(0)
const uploadResults = ref<Array<{
  fileName: string
  success: boolean
  url?: string
  displayUrl?: string
  error?: string
}>>([])

// Link format
const linkFormat = ref('markdown')
const customTemplate = ref('![$fileName]($url)')
const formatLabel = computed(() => {
  const labels: Record<string, string> = {
    url: 'URL',
    markdown: 'Markdown',
    html: 'HTML',
    ubb: 'UBB',
    custom: 'Custom',
  }
  return labels[linkFormat.value] || '链接'
})

// URL upload
const showUrlDialog = ref(false)
const urlInput = ref('')
const urlUploading = ref(false)

// Clipboard
const pasting = ref(false)

const canUpload = computed(() =>
  activeAdapterId.value && fileList.value.length > 0 && !isUploading.value
)

// ===== Lifecycle =====
onMounted(async () => {
  await loadAdapters()

  const savedAdapter = await (window as any).electronAPI.configGet('activeAdapter')
  if (savedAdapter) activeAdapterId.value = savedAdapter

  const savedFormat = await (window as any).electronAPI.configGet('uploadLinkFormat')
  if (savedFormat) linkFormat.value = savedFormat

  const savedTemplate = await (window as any).electronAPI.configGet('uploadCustomTemplate')
  if (savedTemplate) customTemplate.value = savedTemplate

  document.addEventListener('paste', onPaste)
})

async function loadAdapters() {
  try {
    adapters.value = await (window as any).electronAPI.getAdapters()
  } catch {
    adapters.value = []
  }
}

onUnmounted(() => {
  document.removeEventListener('paste', onPaste)
})

watch(linkFormat, async (v) => {
  await (window as any).electronAPI.configSet('uploadLinkFormat', v)
})

watch(customTemplate, async (v) => {
  await (window as any).electronAPI.configSet('uploadCustomTemplate', v)
})

watch([uploadResults, linkFormat, customTemplate], () => {
  for (const r of uploadResults.value) {
    if (r.success && r.url) {
      r.displayUrl = formatLink(r.url, r.fileName)
    }
  }
}, { deep: true })

// ===== Link Formatting =====
function formatLink(url: string, fileName: string): string {
  const ext = fileName.split('.').pop() || ''
  const templateMap: Record<string, string> = {
    url: '$url',
    markdown: '![$fileName]($url)',
    html: '<img src="$url" alt="$fileName">',
    ubb: '[img]$url[/img]',
    custom: customTemplate.value,
  }
  const tpl = templateMap[linkFormat.value] || '$url'
  return tpl
    .replace(/\$url/g, url)
    .replace(/\$fileName/g, fileName)
    .replace(/\$ext/g, ext)
}

// ===== File Selection =====
async function selectFiles() {
  try {
    const paths = await (window as any).electronAPI.selectFiles()
    if (!paths || paths.length === 0) return
    addFiles(paths)
  } catch (e: any) {
    ElMessage.error('选择文件失败: ' + e.message)
  }
}

function onDragOver() {
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (!files) return

  const paths: string[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const path = (file as any).path
    if (path) {
      paths.push(path)
    } else {
      ElMessage.warning(`无法获取文件 ${file.name} 的路径，请使用"点击选择"按钮`)
    }
  }

  if (paths.length > 0) {
    addFiles(paths)
  }
}

function addFiles(paths: string[]) {
  for (const filePath of paths) {
    const name = filePath.replace(/^.*[\\/]/, '')
    const exists = fileList.value.some(f => f.path === filePath)
    if (exists) {
      ElMessage.warning(`文件 ${name} 已添加`)
      continue
    }

    (window as any).electronAPI.getFileStats(filePath).then((stats: any) => {
      fileList.value.push({
        name,
        path: filePath,
        size: stats?.size || 0,
        status: 'pending',
        url: '',
        error: '',
      })
    }).catch(() => {
      fileList.value.push({
        name,
        path: filePath,
        size: 0,
        status: 'pending',
        url: '',
        error: '',
      })
    })
  }
}

function removeFile(row: any) {
  fileList.value = fileList.value.filter(f => f !== row)
}

function clearFiles() {
  fileList.value = []
  uploadResults.value = []
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    pending: '等待中',
    uploading: '上传中',
    success: '成功',
    error: '失败',
  }
  return map[status] || '未知'
}

// ===== Clipboard =====
async function pasteFromClipboard() {
  await doPaste()
}

async function onPaste(e: ClipboardEvent) {
  const target = e.target as HTMLElement
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return
  }
  await doPaste()
}

async function doPaste() {
  if (pasting.value) return
  pasting.value = true
  try {
    const result = await (window as any).electronAPI.readClipboardImage()
    if (!result.hasImage) {
      ElMessage.info('剪贴板中没有图片')
      return
    }
    if (result.error) {
      ElMessage.error('读取剪贴板失败: ' + result.error)
      return
    }
    addFiles([result.tempPath])
    ElMessage.success('已从剪贴板添加图片: ' + result.name)

    if (activeAdapterId.value) {
      setTimeout(() => startUpload(), 300)
    }
  } catch (e: any) {
    ElMessage.error('剪贴板操作失败: ' + e.message)
  } finally {
    pasting.value = false
  }
}

// ===== URL Upload =====
async function uploadFromUrls() {
  const urls = urlInput.value
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (urls.length === 0) {
    ElMessage.warning('请输入至少一个 URL')
    return
  }

  urlUploading.value = true
  const addedPaths: string[] = []

  try {
    for (const url of urls) {
      try {
        ElMessage.info(`下载中: ${url.slice(0, 50)}...`)
        const result = await (window as any).electronAPI.downloadImageFromUrl(url)
        if (result.success) {
          addedPaths.push(result.tempPath)
          fileList.value.push({
            name: result.name,
            path: result.tempPath,
            size: result.size || 0,
            status: 'pending',
            url: '',
            error: '',
          })
          ElMessage.success(`已下载: ${result.name}`)
        } else {
          ElMessage.error(`下载失败: ${result.error || '未知错误'}`)
        }
      } catch (err: any) {
        ElMessage.error(`下载失败: ${err.message}`)
      }
    }

    showUrlDialog.value = false
    urlInput.value = ''

    if (addedPaths.length > 0 && activeAdapterId.value) {
      setTimeout(() => startUpload(), 300)
    }
  } finally {
    urlUploading.value = false
  }
}

// ===== Copy =====
async function copyUrl(url: string) {
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('链接已复制')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = url
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage.success('链接已复制')
  }
}

async function copyAllUrls() {
  const urls = uploadResults.value
    .filter(r => r.success && r.displayUrl)
    .map(r => r.displayUrl!)
    .join('\n')

  if (!urls) {
    ElMessage.warning('没有可复制的链接')
    return
  }

  try {
    await navigator.clipboard.writeText(urls)
    ElMessage.success(`全部 ${formatLabel.value} 链接已复制`)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = urls
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage.success(`全部 ${formatLabel.value} 链接已复制`)
  }
}

// ===== Upload =====
async function startUpload() {
  if (!activeAdapterId.value) {
    ElMessage.warning('请先选择图床')
    return
  }

  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择图片文件')
    return
  }

  isUploading.value = true
  progress.value = 0
  uploadResults.value = []

  const adapterConfig = await (window as any).electronAPI.configGet(`adapter_${activeAdapterId.value}`) || {}

  const total = fileList.value.length
  let completed = 0

  try {
    const CONCURRENCY = 3
    let idx = 0
    const results: typeof uploadResults.value = []

    async function worker() {
      while (idx < fileList.value.length) {
        const i = idx++
        const file = fileList.value[i]

        try {
          file.status = 'uploading'

          const result = await (window as any).electronAPI.uploadImages({
            filePaths: [file.path],
            adapterId: activeAdapterId.value,
            adapterConfig,
          })

          if (result && result.length > 0 && result[0].success) {
            file.status = 'success'
            file.url = result[0].url || ''
            results[i] = {
              fileName: file.name,
              success: true,
              url: result[0].url || '',
              displayUrl: formatLink(result[0].url || '', file.name),
            }
          } else {
            const errMsg = result?.[0]?.error || '上传失败'
            file.status = 'error'
            file.error = errMsg
            results[i] = {
              fileName: file.name,
              success: false,
              error: errMsg,
            }
          }
        } catch (e: any) {
          file.status = 'error'
          file.error = e.message || '上传失败'
          results[i] = {
            fileName: file.name,
            success: false,
            error: e.message || '上传失败',
          }
        }

        completed++
        progress.value = Math.round((completed / total) * 100)
      }
    }

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, fileList.value.length) },
      () => worker()
    )
    await Promise.all(workers)

    uploadResults.value = results.filter(Boolean)

    const successCount = results.filter(r => r?.success).length
    const failCount = total - successCount

    if (failCount === 0 && successCount > 0) {
      const urls = uploadResults.value
        .filter(r => r.success && r.displayUrl)
        .map(r => r.displayUrl!)
        .join('\n')
      try {
        await navigator.clipboard.writeText(urls)
        ElMessage.success(`全部 ${successCount} 张上传成功，链接已自动复制到剪贴板！`)
      } catch {
        ElMessage.success(`全部 ${successCount} 张上传成功！`)
      }
    } else if (failCount > 0) {
      ElMessage.warning(`${successCount} 张成功，${failCount} 张失败`)
    }
  } catch (e: any) {
    ElMessage.error('上传失败: ' + e.message)
  } finally {
    isUploading.value = false
  }
}

// ===== Other =====
async function openLogDir() {
  try {
    await (window as any).electronAPI.openLogDir()
  } catch (e: any) {
    ElMessage.error('打开日志目录失败: ' + e.message)
  }
}

function goSettings() {
  router.push('/settings')
}
</script>

<style scoped>
.upload-page {
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

/* ===== Upload Zone ===== */
.upload-drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  border: 2px dashed var(--border-default);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--bg-base);
}

.upload-drop-zone:hover {
  border-color: var(--accent-primary);
  background: var(--accent-primary-subtle);
}

.upload-drop-zone.is-dragover {
  border-color: var(--accent-primary);
  background: var(--accent-primary-subtle);
  transform: scale(1.01);
}

.upload-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-primary-subtle);
  border-radius: 50%;
  color: var(--accent-primary);
  margin-bottom: 16px;
}

.upload-text {
  font-size: 15px;
  color: var(--text-secondary);
}

.upload-divider {
  color: var(--text-muted);
  margin: 0 4px;
}

.upload-hint {
  margin-top: 8px;
  font-size: 12.5px;
  color: var(--text-muted);
}

.upload-hint kbd {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-secondary);
}

.quick-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
}

/* ===== Format Selector ===== */
.custom-template-input {
  max-width: 280px;
}

.format-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.format-hint {
  font-size: 12.5px;
  color: var(--text-muted);
}

.format-hint code {
  background: var(--bg-elevated);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  color: var(--accent-primary);
}

/* ===== Table Enhancements ===== */
.file-size {
  font-size: 12.5px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.status-uploading {
  background: var(--accent-primary-subtle);
  color: var(--accent-primary);
}

.status-success {
  background: var(--accent-success-subtle);
  color: var(--accent-success);
}

.status-error {
  background: var(--accent-error-subtle);
  color: var(--accent-error);
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

/* ===== Result List ===== */
.result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  transition: border-color 0.15s ease;
}

.result-item:hover {
  border-color: var(--border-default);
}

.result-item.result-error {
  border-color: var(--accent-error-subtle);
}

.result-status {
  flex-shrink: 0;
}

.result-name {
  min-width: 140px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.result-url {
  flex: 1;
}

.result-error-text {
  color: var(--accent-error);
  font-size: 13px;
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

/* ===== URL Dialog ===== */
.url-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.url-hint {
  font-size: 12.5px;
  color: var(--text-muted);
}
</style>

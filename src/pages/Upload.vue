<template>
  <div class="upload-page">
    <!-- 顶部标题栏 -->
    <div class="page-header">
      <h2>📤 图片上传</h2>
      <div class="header-actions">
        <el-button size="small" @click="openLogDir">
          📄 查看日志
        </el-button>
      </div>
    </div>

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

    <!-- 上传区域 + 快捷操作 -->
    <el-card class="upload-card" shadow="never">
      <div
        class="upload-drop-zone"
        @click="selectFiles"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
        :class="{ 'is-dragover': isDragOver }"
      >
        <el-icon :size="48" color="#409eff"><UploadFilled /></el-icon>
        <div class="upload-text">
          <em>点击选择文件</em> 或拖拽文件到此处
        </div>
        <div class="upload-hint">
          支持 jpg/png/gif/webp 等常见图片格式，可多选 · 也可直接 <kbd>Ctrl+V</kbd> 粘贴剪贴板图片
        </div>
      </div>

      <!-- 快捷上传按钮 -->
      <div class="quick-upload-bar">
        <div class="quick-label">快捷上传</div>
        <div class="quick-btns">
          <el-button size="small" @click="pasteFromClipboard" :loading="pasting">
            <el-icon><DocumentCopy /></el-icon> 剪贴板图片
          </el-button>
          <el-button size="small" @click="showUrlDialog = true">
            <el-icon><Link /></el-icon> URL 上传
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 链接格式选择器 -->
    <el-card class="format-card" shadow="never" v-if="uploadResults.length > 0">
      <template #header>
        <div class="format-header">
          <span>🔗 链接格式</span>
          <el-input
            v-if="linkFormat === 'custom'"
            v-model="customTemplate"
            size="small"
            style="width:300px"
            placeholder="自定义模板：$fileName / $url / $ext"
          />
        </div>
      </template>
      <div class="format-selector">
        <el-radio-group v-model="linkFormat" size="small">
          <el-radio-button label="url">URL</el-radio-button>
          <el-radio-button label="markdown">Markdown</el-radio-button>
          <el-radio-button label="html">HTML</el-radio-button>
          <el-radio-button label="ubb">UBB</el-radio-button>
          <el-radio-button label="custom">Custom</el-radio-button>
        </el-radio-group>
        <div class="format-preview" v-if="linkFormat === 'custom'">
          <span class="format-hint">可用变量：$url, $fileName, $ext</span>
        </div>
      </div>
    </el-card>

    <!-- 已选文件列表 -->
    <el-card class="file-card" shadow="never" v-if="fileList.length > 0">
      <template #header>
        <div class="file-header">
          <span>📎 已选择 {{ fileList.length }} 个文件</span>
          <div>
            <el-button size="small" @click="clearFiles">清空列表</el-button>
          </div>
        </div>
      </template>
      <el-table :data="fileList" style="width:100%" max-height="280" stripe>
        <el-table-column label="文件名" min-width="220" prop="name" />
        <el-table-column label="大小" width="120" align="center">
          <template #default="{ row }">
            {{ formatFileSize(row.size) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
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
    </el-card>

    <!-- 上传按钮 -->
    <div class="action-bar">
      <el-button
        type="primary"
        size="large"
        :loading="isUploading"
        :disabled="!canUpload"
        @click="startUpload"
        style="width:220px;height:44px;font-size:16px"
      >
        {{ isUploading ? '上传中...' : '🚀 开始上传' }}
      </el-button>
    </div>

    <!-- 进度条 -->
    <el-progress
      v-if="isUploading"
      :percentage="progress"
      :stroke-width="12"
      style="margin-top:16px"
      color="linear-gradient(135deg, #409eff, #a855f7)"
    />

    <!-- 上传结果 -->
    <el-card class="result-card" shadow="never" v-if="uploadResults.length > 0">
      <template #header>
        <div class="file-header">
          <span>✅ 上传结果</span>
          <div>
            <el-button size="small" @click="copyAllUrls">📋 复制全部{{ formatLabel }}</el-button>
          </div>
        </div>
      </template>
      <div class="result-list">
        <div
          v-for="(result, index) in uploadResults"
          :key="index"
          class="result-item"
        >
          <el-icon v-if="result.success" color="#67c23a" :size="16"><CircleCheckFilled /></el-icon>
          <el-icon v-else color="#f56c6c" :size="16"><CircleCloseFilled /></el-icon>
          <span class="result-name">{{ result.fileName }}</span>
          <span v-if="result.success" class="result-url">
            <el-input v-model="result.displayUrl" size="small" readonly>
              <template #append>
                <el-button @click="copyUrl(result.displayUrl!)">复制</el-button>
              </template>
            </el-input>
          </span>
          <span v-else class="result-error">{{ result.error }}</span>
        </div>
      </div>
    </el-card>

    <!-- URL 上传弹窗 -->
    <el-dialog
      v-model="showUrlDialog"
      title="URL 上传"
      width="500px"
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
          提示：图片会先下载到本地临时目录，再上传到图床
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
import { UploadFilled, CircleCheckFilled, CircleCloseFilled, DocumentCopy, Link } from '@element-plus/icons-vue'

const router = useRouter()

// ===== 状态 =====
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

// 链接格式
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

// URL 上传
const showUrlDialog = ref(false)
const urlInput = ref('')
const urlUploading = ref(false)

// 剪贴板
const pasting = ref(false)

const canUpload = computed(() =>
  activeAdapterId.value && fileList.value.length > 0 && !isUploading.value
)

// ===== 生命周期 =====
onMounted(async () => {
  await loadAdapters()

  const savedAdapter = await (window as any).electronAPI.configGet('activeAdapter')
  if (savedAdapter) activeAdapterId.value = savedAdapter

  const savedFormat = await (window as any).electronAPI.configGet('uploadLinkFormat')
  if (savedFormat) linkFormat.value = savedFormat

  const savedTemplate = await (window as any).electronAPI.configGet('uploadCustomTemplate')
  if (savedTemplate) customTemplate.value = savedTemplate

  // 监听粘贴事件
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

// 保存格式偏好
watch(linkFormat, async (v) => {
  await (window as any).electronAPI.configSet('uploadLinkFormat', v)
})

watch(customTemplate, async (v) => {
  await (window as any).electronAPI.configSet('uploadCustomTemplate', v)
})

// 上传结果变化时，更新格式化显示链接
watch([uploadResults, linkFormat, customTemplate], () => {
  for (const r of uploadResults.value) {
    if (r.success && r.url) {
      r.displayUrl = formatLink(r.url, r.fileName)
    }
  }
}, { deep: true })

// ===== 链接格式化 =====
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

// ===== 文件选择 =====
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

function getStatusType(status: string) {
  const map: Record<string, string> = {
    pending: 'info',
    uploading: '',
    success: 'success',
    error: 'danger',
  }
  return map[status] || 'info'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    pending: '等待上传',
    uploading: '上传中',
    success: '成功',
    error: '失败',
  }
  return map[status] || '未知'
}

// ===== 剪贴板上传 =====
async function pasteFromClipboard() {
  await doPaste()
}

async function onPaste(e: ClipboardEvent) {
  // 如果正在编辑输入框，不拦截
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

    // 如果已选择图床，自动开始上传
    if (activeAdapterId.value) {
      setTimeout(() => startUpload(), 300)
    }
  } catch (e: any) {
    ElMessage.error('剪贴板操作失败: ' + e.message)
  } finally {
    pasting.value = false
  }
}

// ===== URL 上传 =====
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

    // 如果已选择图床且有新文件，自动开始上传
    if (addedPaths.length > 0 && activeAdapterId.value) {
      setTimeout(() => startUpload(), 300)
    }
  } finally {
    urlUploading.value = false
  }
}

// ===== 复制 =====
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

// ===== 上传 =====
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

    // #5 上传成功自动复制（仅全部成功时）
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

// ===== 其他 =====
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
  max-width: 960px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  color: #e0e0e0;
}

.adapter-card,
.upload-card,
.file-card,
.result-card,
.format-card {
  background: #1a1a2e !important;
  border: 1px solid #2a2a3e !important;
  color: #e0e0e0;
  margin-bottom: 16px;
}

.adapter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dir-label {
  min-width: 70px;
  color: #a0a0b8;
  font-size: 14px;
}

.upload-drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 20px;
  border: 2px dashed #409eff44;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  background: #0d0d1a;
}

.upload-drop-zone:hover,
.upload-drop-zone.is-dragover {
  border-color: #409eff;
  background: #409eff0a;
}

.upload-text {
  margin-top: 16px;
  font-size: 16px;
  color: #c0c0d8;
}

.upload-text em {
  color: #409eff;
  font-style: normal;
  font-weight: 600;
}

.upload-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #6c6c8a;
}

.upload-hint kbd {
  background: #2a2a3e;
  border: 1px solid #3a3a5e;
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 11px;
  color: #a0a0c0;
}

.quick-upload-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #2a2a3e;
}

.quick-label {
  font-size: 13px;
  color: #8a8aa0;
}

.quick-btns {
  display: flex;
  gap: 8px;
}

.format-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #e0e0e0;
}

.format-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.format-preview {
  font-size: 12px;
  color: #8a8aa0;
}

.format-hint {
  background: #0d0d1a;
  padding: 4px 10px;
  border-radius: 4px;
  display: inline-block;
}

.file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #e0e0e0;
}

.result-card {
  margin-top: 16px;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0d0d1a;
  border-radius: 6px;
  padding: 10px 12px;
}

.result-name {
  min-width: 140px;
  color: #c0c0d8;
  font-size: 13px;
}

.result-url {
  flex: 1;
}

.result-error {
  color: #f56c6c;
  font-size: 13px;
}

.action-bar {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.url-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.url-hint {
  font-size: 12px;
  color: #8a8aa0;
}
</style>

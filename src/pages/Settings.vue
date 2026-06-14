<template>
  <div class="settings-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-title-group">
        <h1 class="page-title">图床配置</h1>
        <p class="page-description">选择并配置图片上传服务</p>
      </div>
    </div>

    <!-- Adapter Selection -->
    <div class="section-card">
      <div class="section-label">选择图床</div>
      <el-select v-model="selectedAdapterId" placeholder="请选择图床" class="adapter-select">
        <el-option
          v-for="a in adapterList"
          :key="a.id"
          :label="a.name"
          :value="a.id"
        />
      </el-select>
    </div>

    <!-- Configuration Form -->
    <div class="section-card" v-if="selectedAdapter">
      <div class="section-label">配置参数</div>
      <el-form
        :model="configValues"
        label-width="140px"
        label-position="left"
        class="config-form"
      >
        <el-form-item
          v-for="field in selectedAdapter.configFields"
          :key="field.key"
          :label="field.label"
          :required="field.required"
        >
          <el-input
            v-model="configValues[field.key]"
            :type="field.type === 'password' ? 'password' : 'text'"
            :placeholder="field.placeholder"
            show-password
          />
        </el-form-item>

        <el-form-item>
          <div class="form-actions">
            <el-button type="primary" @click="saveConfig">
              <el-icon><Check /></el-icon>
              <span>保存配置</span>
            </el-button>
            <el-button @click="testConnection" :loading="testing" class="btn-outline">
              <el-icon><Connection /></el-icon>
              <span>测试连接</span>
            </el-button>
            <el-button @click="openConfigDir" class="btn-ghost">
              <el-icon><FolderOpened /></el-icon>
              <span>打开配置文件</span>
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </div>

    <!-- Empty State -->
    <div class="empty-state" v-if="!selectedAdapter">
      <el-icon :size="48" color="var(--text-muted)"><Setting /></el-icon>
      <p class="empty-title">请先选择图床</p>
      <p class="empty-description">从上方下拉菜单中选择一个图床服务进行配置</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Connection, FolderOpened, Setting } from '@element-plus/icons-vue'

interface AdapterInfo {
  id: string
  name: string
  configFields: Array<{ key: string; label: string; type: string; placeholder?: string; required: boolean }>
}

const adapterList = ref<AdapterInfo[]>([])
const selectedAdapterId = ref('')
const configValues = ref<Record<string, string>>({})
const testing = ref(false)
let initialized = false

async function loadAdapters() {
  try {
    adapterList.value = await (window as any).electronAPI.getAdapters()
  } catch {
    adapterList.value = []
  }
}

const selectedAdapter = computed(() =>
  adapterList.value.find(a => a.id === selectedAdapterId.value)
)

async function loadConfigForAdapter(adapterId: string) {
  if (!adapterId) {
    configValues.value = {}
    return
  }
  const saved = await (window as any).electronAPI.configGet(`adapter_${adapterId}`)
  configValues.value = saved ?? {}
}

watch(selectedAdapterId, async (newId) => {
  if (!initialized) return
  await loadConfigForAdapter(newId)
})

onMounted(async () => {
  await loadAdapters()
  for (const adapter of adapterList.value) {
    const saved = await (window as any).electronAPI.configGet(`adapter_${adapter.id}`)
    if (saved) {
      selectedAdapterId.value = adapter.id
      configValues.value = saved
      break
    }
  }
  initialized = true
})

async function saveConfig() {
  if (!selectedAdapterId.value) {
    ElMessage.warning('请先选择图床')
    return
  }
  const api = (window as any).electronAPI
  if (!api || !api.configSet) {
    ElMessage.error('IPC 接口未加载，请完全关闭 Electron 窗口后重新启动')
    console.error('electronAPI:', api)
    return
  }
  await api.configSet(`adapter_${selectedAdapterId.value}`, JSON.parse(JSON.stringify(configValues.value)))
  await api.configSet('activeAdapter', selectedAdapterId.value)
  ElMessage.success('配置已保存')
}

async function testConnection() {
  if (!selectedAdapterId.value) return
  testing.value = true
  try {
    const api = (window as any).electronAPI
    if (!api || !api.testConnection) {
      ElMessage.error('IPC 接口未加载')
      return
    }
    const plainConfig = JSON.parse(JSON.stringify(configValues.value))
    const result = await api.testConnection(selectedAdapterId.value, plainConfig)
    if (result?.ok) {
      if (result?.warning) {
        ElMessage.warning(result.warning)
      } else {
        ElMessage.success('连接测试通过')
      }
    } else {
      ElMessage.error('连接测试失败：' + (result?.error || '未知错误'))
    }
  } catch (e: any) {
    ElMessage.error('连接测试异常：' + e.message)
  } finally {
    testing.value = false
  }
}

async function openConfigDir() {
  try {
    const api = (window as any).electronAPI
    if (!api || !api.openConfigDir) {
      ElMessage.error('IPC 接口未加载')
      return
    }
    await api.openConfigDir()
  } catch (e: any) {
    ElMessage.error('打开配置目录失败：' + e.message)
  }
}
</script>

<style scoped>
.settings-page {
  max-width: 680px;
  margin: 0 auto;
}

/* ===== Page Header ===== */
.page-header {
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

/* ===== Section Cards ===== */
.section-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 20px;
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

.adapter-select {
  width: 100%;
}

/* ===== Form ===== */
.config-form {
  margin-top: 8px;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* ===== Outline Button ===== */
.btn-outline {
  background: transparent !important;
  border-color: var(--border-default) !important;
  color: var(--text-secondary) !important;
}

.btn-outline:hover {
  border-color: var(--text-muted) !important;
  color: var(--text-primary) !important;
}

/* ===== Ghost Button ===== */
.btn-ghost {
  background: transparent !important;
  border-color: transparent !important;
  color: var(--text-muted) !important;
}

.btn-ghost:hover {
  background: var(--bg-elevated) !important;
  color: var(--text-secondary) !important;
}

/* ===== Empty State ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  background: var(--bg-surface);
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-lg);
  text-align: center;
}

.empty-title {
  margin: 16px 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-description {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-muted);
}
</style>

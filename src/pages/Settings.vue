<template>
  <div class="settings-page">
    <div class="page-header">
      <h2>⚙️ 图床配置</h2>
    </div>

    <!-- 图床选择 -->
    <el-card shadow="never" class="config-card">
      <template #header>
        <span>选择图床并配置参数</span>
      </template>

      <el-select v-model="selectedAdapterId" placeholder="请选择图床" style="width:100%;margin-bottom:20px">
        <el-option
          v-for="a in adapterList"
          :key="a.id"
          :label="a.name"
          :value="a.id"
        />
      </el-select>

      <!-- 动态配置表单 -->
      <el-form
        v-if="selectedAdapter"
        :model="configValues"
        label-width="140px"
        label-position="left"
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
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
          <el-button @click="testConnection" :loading="testing">测试连接</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

interface AdapterInfo {
  id: string
  name: string
  configFields: Array<{ key: string; label: string; type: string; placeholder?: string; required: boolean }>
}

const adapterList = ref<AdapterInfo[]>([
  {
    id: 'lsky-pro',
    name: 'Lsky Pro (蓝空图床)',
    configFields: [
      { key: 'apiUrl', label: 'API 地址', type: 'text', placeholder: 'https://your-lsky.com/api/v1', required: true },
      { key: 'email', label: '邮箱', type: 'text', required: true },
      { key: 'password', label: '密码', type: 'password', required: true },
    ],
  },
  {
    id: 'cf-r2',
    name: 'CloudFlare R2',
    configFields: [
      { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'https://xxx.r2.cloudflarestorage.com', required: true },
      { key: 'accessKey', label: 'Access Key ID', type: 'text', required: true },
      { key: 'secretKey', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'bucketName', label: 'Bucket 名称', type: 'text', required: true },
      { key: 'publicUrl', label: '公开访问 URL', type: 'text', placeholder: 'https://pub-xxx.r2.dev', required: true },
    ],
  },
  {
    id: 'cf-imgbed',
    name: 'CloudFlare ImgBed',
    configFields: [
      { key: 'apiUrl', label: 'API 地址', type: 'text', placeholder: 'https://imgbed.example.com/upload', required: true },
      { key: 'authCode', label: '鉴权码 (Auth Code)', type: 'password', required: false },
    ],
  },
])

const selectedAdapterId = ref('')
const configValues = ref<Record<string, string>>({})
const testing = ref(false)

const selectedAdapter = computed(() =>
  adapterList.value.find(a => a.id === selectedAdapterId.value)
)

onMounted(async () => {
  // 加载已保存的配置
  for (const adapter of adapterList.value) {
    const saved = await (window as any).electronAPI.configGet(`adapter_${adapter.id}`)
    if (saved) {
      // 找到上次使用的适配器
      selectedAdapterId.value = adapter.id
      configValues.value = saved
      break
    }
  }
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
    // ✅ 用 JSON 序列化确保传递的是纯对象（避免 Vue reactive 对象无法被克隆）
    const plainConfig = JSON.parse(JSON.stringify(configValues.value))
    const result = await api.testConnection(selectedAdapterId.value, plainConfig)
    if (result?.ok) {
      if (result?.warning) {
        ElMessage.warning(result.warning)  // ⚠️ 显示警告
      } else {
        ElMessage.success('连接测试通过 ✅')
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
</script>

<style scoped>
.settings-page {
  max-width: 680px;
  margin: 0 auto;
}
.page-header h2 {
  color: #e0e0e0;
  margin-bottom: 20px;
}
.config-card {
  background: #1a1a2e !important;
  border: 1px solid #2a2a3e !important;
  color: #e0e0e0;
}
</style>

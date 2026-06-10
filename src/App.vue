<template>
  <el-config-provider :locale="zhCn">
    <div id="app-root" class="app-wrapper dark">
      <el-container class="app-container">
        <el-aside width="200px" class="app-sidebar">
          <div class="sidebar-logo">
            <el-icon :size="28"><PictureFilled /></el-icon>
            <span class="logo-text">MDPicSync</span>
          </div>
          <el-menu
            :default-active="activeMenu"
            class="sidebar-menu"
            @select="handleMenuSelect"
          >
            <el-menu-item index="/">
              <el-icon><Upload /></el-icon>
              <span>图片迁移</span>
            </el-menu-item>
            <el-menu-item index="/settings">
              <el-icon><Setting /></el-icon>
              <span>图床配置</span>
            </el-menu-item>
          </el-menu>
        </el-aside>

        <el-main class="app-main">
          <router-view />
        </el-main>
      </el-container>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { Upload, Setting, PictureFilled } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const activeMenu = ref(route.path)

watch(() => route.path, (val) => { activeMenu.value = val })

function handleMenuSelect(index: string) {
  router.push(index)
}
</script>

<style>
/* 全局深色主题 */
:root {
  --sidebar-bg: #1a1a2e;
  --sidebar-active: #16213e;
  --primary: #409eff;
}

html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  background: #0f0f1a;
  color: #e0e0e0;
  font-family: 'Segoe UI', 'PingFang SC', sans-serif;
}

.app-wrapper {
  height: 100vh;
  overflow: hidden;
}

.app-container {
  height: 100%;
}

.app-sidebar {
  background: var(--sidebar-bg) !important;
  border-right: 1px solid #2a2a3e;
  overflow: hidden;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 20px 10px;
  color: #409eff;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
}

.logo-text {
  background: linear-gradient(135deg, #409eff, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.sidebar-menu {
  background: transparent !important;
  border: none !important;
}

.sidebar-menu .el-menu-item {
  color: #a0a0b8 !important;
  border-radius: 8px;
  margin: 4px 10px;
  height: 42px;
  line-height: 42px;
}

.sidebar-menu .el-menu-item:hover {
  background: var(--sidebar-active) !important;
  color: #e0e0e0 !important;
}

.sidebar-menu .el-menu-item.is-active {
  background: linear-gradient(135deg, #409eff22, #a855f722) !important;
  color: #409eff !important;
}

.app-main {
  background: #0f0f1a !important;
  padding: 24px !important;
  overflow-y: auto;
}

/* Element Plus 深色覆盖 */
.el-button--primary {
  background: linear-gradient(135deg, #409eff, #6366f1) !important;
  border: none !important;
}
</style>

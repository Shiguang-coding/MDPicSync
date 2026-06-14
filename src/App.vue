<template>
  <el-config-provider :locale="zhCn">
    <div id="app-root" class="app-wrapper dark">
      <el-container class="app-container">
        <el-aside width="220px" class="app-sidebar">
          <div class="sidebar-logo">
            <div class="logo-icon">
              <el-icon :size="22"><PictureFilled /></el-icon>
            </div>
            <div class="logo-text-group">
              <span class="logo-text">MDPicSync</span>
              <span class="logo-subtitle">图片迁移工具</span>
            </div>
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
            <el-menu-item index="/upload">
              <el-icon><UploadFilled /></el-icon>
              <span>图片上传</span>
            </el-menu-item>
          </el-menu>

          <div class="sidebar-footer">
            <a
              class="github-link"
              href="https://github.com/shiguang-coding/MDPicSync"
              target="_blank"
              title="访问 GitHub 仓库"
            >
              <el-icon :size="14"><Link /></el-icon>
              <span>GitHub</span>
            </a>
          </div>
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
import { Upload, Setting, PictureFilled, UploadFilled, Link } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const activeMenu = ref(route.path)

watch(() => route.path, (val) => { activeMenu.value = val })

function handleMenuSelect(index: string) {
  router.push(index)
}
</script>

<style>
/* ===== Design Tokens ===== */
:root {
  /* Base */
  --bg-base: #09090B;
  --bg-surface: #18181B;
  --bg-elevated: #27272A;
  --bg-muted: #3F3F46;
  
  /* Borders */
  --border-subtle: #27272A;
  --border-default: #3F3F46;
  
  /* Text */
  --text-primary: #FAFAFA;
  --text-secondary: #A1A1AA;
  --text-muted: #71717A;
  
  /* Accent - Warm Amber */
  --accent-primary: #F59E0B;
  --accent-primary-hover: #D97706;
  --accent-primary-subtle: rgba(245, 158, 11, 0.12);
  --accent-primary-glow: rgba(245, 158, 11, 0.25);
  
  /* Success - Teal */
  --accent-success: #14B8A6;
  --accent-success-subtle: rgba(20, 184, 166, 0.12);
  
  /* Error */
  --accent-error: #EF4444;
  --accent-error-subtle: rgba(239, 68, 68, 0.12);
  
  /* Sidebar */
  --sidebar-bg: #0F0F12;
  --sidebar-hover: #1C1C20;
  --sidebar-active-bg: rgba(245, 158, 11, 0.08);
  
  /* Spacing */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
}

/* ===== Global Reset ===== */
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ===== App Layout ===== */
.app-wrapper {
  height: 100vh;
  overflow: hidden;
}

.app-container {
  height: 100%;
}

/* ===== Sidebar ===== */
.app-sidebar {
  background: var(--sidebar-bg) !important;
  border-right: 1px solid var(--border-subtle);
  overflow: hidden;
  position: relative;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 20px 28px;
}

.logo-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--accent-primary), #D97706);
  border-radius: var(--radius-md);
  color: #000;
  flex-shrink: 0;
}

.logo-text-group {
  display: flex;
  flex-direction: column;
}

.logo-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.3px;
  line-height: 1.2;
}

.logo-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
  letter-spacing: 0.2px;
}

/* ===== Menu ===== */
.sidebar-menu {
  background: transparent !important;
  border: none !important;
  padding: 0 8px;
}

.sidebar-menu .el-menu-item {
  color: var(--text-secondary) !important;
  border-radius: var(--radius-sm);
  margin: 2px 0;
  height: 40px;
  line-height: 40px;
  font-size: 13.5px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.sidebar-menu .el-menu-item:hover {
  background: var(--sidebar-hover) !important;
  color: var(--text-primary) !important;
}

.sidebar-menu .el-menu-item.is-active {
  background: var(--sidebar-active-bg) !important;
  color: var(--accent-primary) !important;
}

.sidebar-menu .el-menu-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  background: var(--accent-primary);
  border-radius: 0 2px 2px 0;
}

/* ===== Main Content ===== */
.app-main {
  background: var(--bg-base) !important;
  padding: 28px 32px !important;
  overflow-y: auto;
}

/* ===== Footer ===== */
.sidebar-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 14px 20px;
  border-top: 1px solid var(--border-subtle);
  box-sizing: border-box;
}

.github-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12.5px;
  text-decoration: none;
  transition: color 0.15s ease;
}

.github-link:hover {
  color: var(--text-secondary);
}

/* ===== Element Plus Overrides ===== */
.el-button--primary {
  background: var(--accent-primary) !important;
  border-color: var(--accent-primary) !important;
  color: #000 !important;
  font-weight: 600;
}

.el-button--primary:hover {
  background: var(--accent-primary-hover) !important;
  border-color: var(--accent-primary-hover) !important;
}

.el-card {
  --el-card-bg-color: var(--bg-surface);
  border-color: var(--border-subtle) !important;
  border-radius: var(--radius-lg) !important;
}

.el-card__header {
  border-bottom-color: var(--border-subtle) !important;
  padding: 16px 20px !important;
}

.el-card__body {
  padding: 20px !important;
}

.el-table {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: var(--bg-elevated);
  --el-table-header-text-color: var(--text-secondary);
  --el-table-text-color: var(--text-primary);
  --el-table-border-color: var(--border-subtle);
  --el-table-row-hover-bg-color: var(--bg-elevated);
}

.el-table th.el-table__cell {
  font-weight: 600;
  font-size: 12.5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.el-input__wrapper {
  background-color: var(--bg-elevated) !important;
  box-shadow: 0 0 0 1px var(--border-default) inset !important;
}

.el-input__wrapper:hover {
  box-shadow: 0 0 0 1px var(--text-muted) inset !important;
}

.el-input__wrapper.is-focus {
  box-shadow: 0 0 0 1px var(--accent-primary) inset !important;
}

.el-input__inner {
  color: var(--text-primary) !important;
}

.el-input__inner::placeholder {
  color: var(--text-muted) !important;
}

.el-select__wrapper {
  background-color: var(--bg-elevated) !important;
  box-shadow: 0 0 0 1px var(--border-default) inset !important;
}

.el-select__wrapper:hover {
  box-shadow: 0 0 0 1px var(--text-muted) inset !important;
}

.el-select__wrapper.is-focused {
  box-shadow: 0 0 0 1px var(--accent-primary) inset !important;
}

.el-radio-button__inner {
  background: var(--bg-elevated) !important;
  border-color: var(--border-default) !important;
  color: var(--text-secondary) !important;
}

.el-radio-button__original-radio:checked + .el-radio-button__inner {
  background: var(--accent-primary-subtle) !important;
  border-color: var(--accent-primary) !important;
  color: var(--accent-primary) !important;
  box-shadow: -1px 0 0 0 var(--accent-primary) inset !important;
}

.el-tag {
  border-radius: var(--radius-sm);
}

.el-progress__text {
  color: var(--text-primary) !important;
}

.el-dialog {
  --el-dialog-bg-color: var(--bg-surface);
  border-radius: var(--radius-lg) !important;
  border: 1px solid var(--border-subtle);
}

.el-dialog__header {
  border-bottom: 1px solid var(--border-subtle);
  padding: 16px 20px !important;
}

.el-dialog__title {
  color: var(--text-primary) !important;
  font-weight: 600;
}

.el-dialog__body {
  padding: 20px !important;
}

.el-textarea__inner {
  background-color: var(--bg-elevated) !important;
  border-color: var(--border-default) !important;
  color: var(--text-primary) !important;
}

.el-textarea__inner:focus {
  border-color: var(--accent-primary) !important;
}

.el-form-item__label {
  color: var(--text-secondary) !important;
}

/* ===== Scrollbar ===== */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--bg-muted);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>

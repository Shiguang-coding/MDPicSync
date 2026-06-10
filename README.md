# MDPicSync - Markdown 图片备份与迁移工具

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

> 基于 Electron + Vue 3 的 Markdown 图片批量迁移桌面应用。
> 支持本地图片上传至图床，或图床图片下载到本地，并自动替换 Markdown 中的引用路径。

## ✨ 功能特性

- **双向迁移**
  - 📤 本地图片 → 图床（一键上传，自动替换 URL）
  - 📥 图床图片 → 本地（一键下载，自动替换为本地路径）
- **插件化架构**：支持 Lsky Pro、CloudFlare R2、CloudFlare ImgBed 等多种图床，可扩展
- **批量处理**：自动扫描目录下的所有 Markdown 文件，一键处理
- **智能归档**：按文章名称分类存储图片，结构清晰
- **实时日志**：处理进度实时展示，支持日志导出
- **原文件备份**：处理前自动备份原 Markdown 文件
- **深色主题**：现代化 UI 设计，支持 Windows 原生风格

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9
- Windows 10/11

### 安装依赖

```bash
# 克隆项目后进入目录
cd MDPicSync

# 安装依赖
npm install

# Electron 二进制文件会自动下载，如果失败可手动下载：
# 1. 访问 https://github.com/electron/electron/releases/tag/v28.3.3
# 2. 下载 electron-v28.3.3-win32-x64.zip
# 3. 解压到 node_modules/electron/dist/ 目录
# 4. 创建 node_modules/electron/path.txt，内容填写 electron.exe
```

### 开发模式

```bash
# 同时启动 Vite 开发服务器和 Electron
npm run electron:dev

# 或分别启动
npm run dev        # 启动 Vite 开发服务器
npm run electron:start  # 启动 Electron（需确保 Vite 已运行）
```

### 生产构建

```bash
# 构建前端 + 编译主进程 + 打包为安装程序
npm run electron:build

# 打包后的安装程序位于 release/ 目录
```

## 📁 项目结构

```
MDPicSync/
├── electron/              # Electron 主进程
│   ├── main.ts            # 主进程入口
│   ├── preload.ts         # 预加载脚本（IPC 桥接）
│   └── services/          # 核心业务逻辑
│       ├── markdown-parser.ts   # Markdown 图片引用解析
│       ├── plugin-loader.ts     # 图床插件动态加载
│       └── migrator.ts          # 核心迁移引擎
├── src/                   # Vue 3 前端
│   ├── main.ts            # Vue 入口
│   ├── App.vue            # 主布局
│   ├── router.ts          # 路由
│   ├── stores/            # Pinia 状态管理
│   ├── pages/             # 页面
│   │   ├── Home.vue       # 主页面（迁移操作）
│   │   └── Settings.vue   # 图床配置页
│   └── components/        # 通用组件
├── plugins/               # 图床插件
│   ├── base-adapter.ts    # 插件接口定义
│   ├── lsky-pro.ts        # Lsky Pro 适配器
│   ├── cf-r2.ts           # CloudFlare R2 适配器
│   └── cf-imgbed.ts       # CloudFlare ImgBed 适配器
├── dist/                  # 前端构建输出（Vite 生成）
├── dist-electron/         # 主进程编译输出
└── package.json
```

## 🔌 插件开发

要添加新的图床适配器，只需在 `plugins/` 目录下创建一个新的 `.ts` 文件，实现 `IImageBedAdapter` 接口：

```typescript
import { IImageBedAdapter } from './base-adapter'

export class MyAdapter implements IImageBedAdapter {
  id = 'my-adapter'
  name = '我的图床'

  configFields = [
    { key: 'apiUrl', label: 'API 地址', type: 'text', required: true },
    { key: 'token', label: 'Token', type: 'password', required: true },
  ]

  async validateConfig(config: Record<string, string>): Promise<boolean> {
    // 验证配置是否有效
    return true
  }

  async upload(filePath: string, config: Record<string, string>): Promise<{ success: boolean; url?: string; error?: string }> {
    // 上传图片逻辑
    return { success: true, url: 'https://example.com/image.png' }
  }

  async download(imageUrl: string, targetDir: string, fileName: string, config: Record<string, string>): Promise<{ success: boolean; localPath?: string; error?: string }> {
    // 下载图片逻辑
    return { success: true, localPath: '/path/to/image.png' }
  }
}
```

## 🖼️ 使用流程

1. **选择模式**：上传至图床 / 下载至本地
2. **选择目录**
   - 源目录：包含 Markdown 文件的文件夹
   - 输出目录：处理后文件保存位置
3. **选择图床**：在设置页配置图床参数
4. **预览文件**：自动扫描并显示可处理的 Markdown 文件列表
5. **开始执行**：一键批量处理，实时查看日志和进度

## ⚙️ 配置说明

### Lsky Pro (蓝空图床)

| 配置项 | 说明 |
|--------|------|
| API 地址 | 你的 Lsky Pro 站点 API 地址，如 `https://lsky.example.com/api/v1` |
| 邮箱 | 登录邮箱 |
| 密码 | 登录密码 |

### CloudFlare R2

| 配置项 | 说明 |
|--------|------|
| Endpoint | R2 端点地址 |
| Access Key ID | R2 Access Key |
| Secret Access Key | R2 Secret Key |
| Bucket 名称 | 存储桶名称 |
| 公开访问 URL | 图片公开访问前缀 |

### CloudFlare ImgBed

| 配置项 | 说明 |
|--------|------|
| API 地址 | ImgBed 上传接口地址 |
| 鉴权码 | 可选，如需要认证则填写 |

## 🛠️ 技术栈

- **框架**：Electron 28 + Vue 3 + TypeScript
- **构建**：Vite 5
- **UI**：Element Plus（深色主题）
- **状态管理**：Pinia
- **图床通信**：Axios + AWS SDK (R2)

## 📄 开源协议

MIT License

## 🤝 致谢

本项目灵感来源于 [MarkdownImageBackupTool](https://github.com/Shiguang-coding/MarkdownImageBackupTool) Java 命令行工具。

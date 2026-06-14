# MDPicSync

> Markdown 图片备份与双向迁移工具 | 基于 Electron + Vue 3 构建

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/Shiguang-coding/MDPicSync)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/Shiguang-coding/MDPicSync/blob/main/LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/Shiguang-coding/MDPicSync)

> 本项目基于作者此前开发的 [MarkdownImageBackupTool](https://github.com/Shiguang-coding/MarkdownImageBackupTool)（Java 命令行版本），使用 Electron + Vue 3 重新构建为桌面应用，并扩展了插件化架构、图片上传、剪贴板粘贴等功能。

---

## 目录

- [目录](#目录)
  - [功能特性](#-功能特性)
  - [快速开始](#-快速开始)
  - [常见问题](#-常见问题)
  - [使用流程](#-使用流程)
  - [图床配置说明](#-图床配置说明)
  - [日志说明](#-日志说明)
  - [插件开发](#-插件开发)
  - [项目结构](#-项目结构)
  - [技术栈](#-技术栈)
  - [开源协议](#-开源协议)
  - [致谢](#-致谢)

---

## 功能特性

| 特性 | 说明 |
|------|------|
| 双向迁移 | 本地图片 → 图床（上传）/ 图床图片 → 本地（下载），一键完成 |
| 插件化架构 | 支持 Lsky Pro、CloudFlare R2、CloudFlare ImgBed，可自由扩展 |
| 批量处理 | 自动递归扫描目录，批量处理所有 Markdown 文件 |
| 智能归档 | 按文章名称分类存储图片，目录结构清晰 |
| 实时日志 | 处理进度实时展示，支持一键复制，日志按日期自动存档 |
| 原文件备份 | 处理前自动备份原文件（`.bak` 后缀），可随时回滚 |
| 深色主题 | 现代化 UI 设计，护眼深色风格 |
| 中文菜单 | 应用菜单完整中文化 |

---

## 快速开始

### 环境要求

| 依赖 | 版本要求 |
|------|----------|
| Node.js | >= 18 |
| npm | >= 9 |
| 操作系统 | Windows 10/11、macOS、Linux |

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/Shiguang-coding/MDPicSync.git
cd MDPicSync

# 安装依赖
npm install
```

> ⚠️ 如果 `npm install` 未安装 devDependencies（如 cross-env、concurrently 等），请确保项目根目录有 `.npmrc` 文件，或手动执行：
> ```bash
> npm install --omit=none
> ```

### 开发模式

```bash
# 编译 Electron 主进程（首次或修改 electron/ 后需执行）
npx tsc --project tsconfig.electron.json

# 同时启动 Vite 开发服务器和 Electron（推荐）
npm run electron:dev

# 或分别启动
npm run dev               # 启动 Vite 开发服务器
npm run electron:start    # 启动 Electron（需先启动 Vite）
```

### 生产构建

```bash
# 完整构建：前端 + 主进程 + 打包为安装程序
npm run electron:build

# 打包后的安装程序位于 release/ 目录
```

---

## 常见问题

### Electron 二进制下载失败或版本不匹配

**现象**：`npm run electron:dev` 启动时报错，常见错误包括：

```
Error: spawn ...\node_modules\electron\dist\dist\electron.exe ENOENT
```
```
Error: Electron failed to install correctly, please delete node_modules/electron and try installing again
```
```
Cannot find module 'electron'  (或 require('electron').app 为 undefined)
```

**原因**：Electron 的 npm 包（`package.json` 声明 v28）与本地下载的二进制文件版本不一致，或 `path.txt` 内容错误导致路径解析多了一层 `dist/`。

**解决方案**（按顺序尝试）：

1. **设置国内镜像重新下载**：
   ```bash
   # Windows (PowerShell)
   $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
   Remove-Item -Recurse -Force node_modules\electron\dist -ErrorAction SilentlyContinue
   Remove-Item node_modules\electron\path.txt -ErrorAction SilentlyContinue
   node node_modules\electron\install.js

   # macOS / Linux
   ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ rm -rf node_modules/electron/dist node_modules/electron/path.txt
   node node_modules/electron/install.js
   ```

2. **手动下载并安装**（推荐，国内网络最稳定）：
   - 从国内镜像下载：`https://registry.npmmirror.com/-/binary/electron/v28.3.3/electron-v28.3.3-win32-x64.zip`
   - 或从 GitHub 下载：`https://github.com/electron/electron/releases/tag/v28.3.3`
   - 将 zip 解压后的**所有文件**覆盖到 `node_modules/electron/dist/`
   - 确保 `node_modules/electron/path.txt` 内容为 `electron.exe`（Windows）/ `electron`（macOS/Linux），**不要包含 `dist/` 前缀**

3. **验证安装是否正确**：
   ```bash
   # 检查路径解析（应输出 .../node_modules/electron/dist/electron.exe）
   node -e "console.log(require('electron/index.js'))"

   # 检查二进制版本（应输出 v28.3.3）
   node_modules/electron/dist/electron.exe --version    # Windows
   node_modules/electron/dist/electron --version         # macOS/Linux
   ```

> **注意**：`node_modules/electron/path.txt` 的值会被 `electron/index.js` 拼接为 `__dirname/dist/<path.txt内容>`，因此 path.txt 中只需写 `electron.exe`，不要写 `dist/electron.exe`，否则会导致路径变成 `dist/dist/electron.exe`。

### npm install 跳过了 devDependencies

**现象**：运行 `npm run electron:dev` 提示 `cross-env 不是内部或外部命令`。

**原因**：npm 全局配置 `omit=dev` 会导致 devDependencies 不被安装。

**解决方案**：

```bash
# 项目根目录已有 .npmrc 文件（omit=[]），确保 devDependencies 被安装
npm install --omit=none
```

### Vite 端口被占用

**现象**：`electron:dev` 启动后 Vite 使用了 5174/5175 等端口，但 `wait-on` 仍等待 5173，导致 Electron 无法连接。

**解决方案**：关闭占用 5173 的进程，或在 `vite.config.ts` 中修改 `server.port` 并同步修改 `package.json` 中 `electron:dev` 脚本的 `wait-on` 端口。

---

## 使用流程

```
┌─────────────────────────────────────────────┐
│  1. 选择模式                              │
│     ├── 上传至图床（本地 → 图床）        │
│     └── 下载至本地（图床 → 本地）        │
├─────────────────────────────────────────────┤
│  2. 选择目录                              │
│     ├── 源目录：Markdown 文件所在目录     │
│     └── 输出目录：处理后文件保存位置      │
├─────────────────────────────────────────────┤
│  3. 选择图床（首次使用需先配置参数）      │
├─────────────────────────────────────────────┤
│  4. 预览文件：自动扫描并显示文件列表      │
│     └── 可勾选需要处理的文件             │
├─────────────────────────────────────────────┤
│  5. 开始执行：一键批量处理                │
│     └── 实时查看日志和进度条             │
└─────────────────────────────────────────────┘
```

### 图片路径规则

| 模式 | 图片存放位置 | Markdown 引用路径 |
|------|--------------|-------------------|
| 上传（本地→图床） | 图床 | 替换为图床 URL |
| 下载（图床→本地） | `输出目录/mdName/` | `mdName/xxx.png` |

> 示例：`blog.md` 中的图片会保存到 `输出目录/blog/` 目录，引用路径为 `blog/xxx.png`

---

## 图床配置说明

### Lsky Pro（蓝空图床）

| 配置项 | 说明 | 必填 |
|--------|------|------|
| API 地址 | Lsky Pro 站点 API 地址，如 `https://img.example.com/api/v1` | ✅ |
| 邮箱 | 登录邮箱 | ✅ |
| 密码 | 登录密码 | ✅ |

### CloudFlare R2

| 配置项 | 说明 | 必填 |
|--------|------|------|
| Endpoint | R2 端点地址（含 Bucket 名称） | ✅ |
| Access Key ID | R2 Access Key | ✅ |
| Secret Access Key | R2 Secret Key | ✅ |
| Bucket 名称 | 存储桶名称 | ✅ |
| 公开访问 URL | 图片公开访问前缀，如 `https://cdn.example.com/` | ✅ |

### CloudFlare ImgBed

| 配置项 | 说明 | 必填 |
|--------|------|------|
| API 地址 | ImgBed 上传接口地址，如 `https://imgbed.example.com/upload` | ✅ |
| 鉴权码 | 可选，需要时填写 | ❎ |

---

## 日志说明

### 日志存储位置

| 运行模式 | 日志目录 |
|----------|----------|
| 开发模式（npm run dev） | `<项目根目录>/logs/` |
| 生产模式（安装后） | `MDPicSync.exe` 同级目录下的 `logs/` |

> 如安装目录无写入权限（如 `Program Files`），日志会自动降级保存到用户数据目录。

### 日志文件规则

- **文件命名**：按日期每天一个文件，格式 `YYYY-MM-DD.log`
- **编码**：UTF-8
- **时区**：东八区（Asia/Shanghai）

### 日志格式

```
[2026-06-11 01:05:30] [INFO] 🚀 开始执行 | 模式: 本地→图床
[2026-06-11 01:05:30] [INFO] 📂 源目录: D:\WorkSpace\Blog\unback
[2026-06-11 01:05:30] [INFO] 💾 输出目录: D:\WorkSpace\Blog\backed
[2026-06-11 01:05:31] [INFO] 📄 处理文件: blog.md
[2026-06-11 01:05:31] [INFO]    找到 5 张需要处理的图片
[2026-06-11 01:05:32] [INFO]    [1/5] https://example.com/old.png
[2026-06-11 01:05:33] [INFO]       ✅ 上传成功: https://cdn.example.com/new.png
[2026-06-11 01:05:35] [INFO]    ✅ 完成: 成功 5，失败 0
```

### 查看日志

- 点击主界面顶部 **「📄 查看日志」** 按钮，自动打开日志目录
- 也可手动进入上述日志目录查看

---

## 插件开发

要添加新的图床适配器，只需在 `plugins/` 目录下创建一个新的 `.ts` 文件，实现 `IImageBedAdapter` 接口：

```typescript
// plugins/my-adapter.ts
import { IImageBedAdapter } from './base-adapter'

export class MyAdapter implements IImageBedAdapter {
  id = 'my-adapter'       // 唯一标识符
  name = '我的图床'        // 显示名称

  // 配置表单字段定义
  configFields = [
    { key: 'apiUrl',  label: 'API 地址',   type: 'text',     required: true },
    { key: 'token',   label: 'Token',       type: 'password', required: true },
  ]

  // 验证配置是否有效
  async validateConfig(config: Record<string, string>): Promise<boolean> {
    return !!config['apiUrl'] && !!config['token']
  }

  // 上传图片
  async upload(
    filePath: string,
    config: Record<string, string>
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    // 实现上传逻辑
    return { success: true, url: 'https://example.com/image.png' }
  }

  // 下载图片
  async download(
    imageUrl: string,
    targetDir: string,
    fileName: string,
    config: Record<string, string>
  ): Promise<{ success: boolean; localPath?: string; error?: string }> {
    // 实现下载逻辑
    return { success: true, localPath: '/path/to/image.png' }
  }
}
```

> 插件放置到 `plugins/` 目录后，重启应用即可在图床选择列表中看到新适配器。

---

## 项目结构

```
MDPicSync/
├── electron/                  # Electron 主进程
│   ├── main.ts               # 主进程入口（窗口管理、IPC 处理）
│   ├── preload.ts            # 预加载脚本（上下文桥接）
│   └── services/             # 核心业务逻辑
│       ├── logger.ts          # 日志服务（按日期写入文件）
│       ├── markdown-parser.ts # Markdown 图片引用解析
│       ├── plugin-loader.ts   # 图床插件动态加载
│       └── migrator.ts       # 核心迁移引擎
├── src/                      # Vue 3 前端
│   ├── main.ts               # Vue 入口
│   ├── App.vue               # 主布局
│   ├── router.ts             # 路由配置
│   ├── stores/               # Pinia 状态管理
│   ├── pages/                # 页面
│   │   ├── Home.vue          # 主页面（迁移操作）
│   │   └── Settings.vue      # 图床配置页
│   └── components/           # 通用组件
├── plugins/                  # 图床插件
│   ├── base-adapter.ts       # 插件接口定义
│   ├── lsky-pro.ts           # Lsky Pro 适配器
│   ├── cf-r2.ts              # CloudFlare R2 适配器
│   └── cf-imgbed.ts          # CloudFlare ImgBed 适配器
├── dist/                     # 前端构建输出（Vite 生成）
├── dist-electron/            # 主进程编译输出（tsc 生成）
├── release/                  # 生产打包输出（electron-builder 生成）
├── tsconfig.json             # Vue 前端 TypeScript 配置
├── tsconfig.electron.json    # Electron 主进程 TypeScript 配置
├── package.json
└── README.md
```

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Electron 28 + Vue 3 + TypeScript |
| 构建工具 | Vite 5 |
| UI 组件库 | Element Plus（深色主题） |
| 状态管理 | Pinia |
| 图床通信 | Axios + AWS SDK for JavaScript（R2） |
| 打包工具 | electron-builder |

---

## 开源协议

[MIT License](https://github.com/Shiguang-coding/MDPicSync/blob/main/LICENSE)

---

## 致谢

本项目脱胎于作者此前开发的 [MarkdownImageBackupTool](https://github.com/Shiguang-coding/MarkdownImageBackupTool)（Java 命令行版本），感谢其在 Markdown 图片迁移领域的早期探索与实践。

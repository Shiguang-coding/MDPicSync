import fs from 'fs/promises'
import path from 'path'
import { IImageBedAdapter } from '../../plugins/base-adapter'

/**
 * 从 Markdown 文本中提取所有图片引用
 * 支持 ![alt](url) 和 <img src="url"> 两种格式
 * 返回 { url, line } 数组
 */
export interface ImageRef {
  url: string
  line: number
  alt: string
  /** 原始匹配字符串，用于替换 */
  raw: string
  /** 引用类型：行内 / HTML标签 / YAML frontmatter */
  type: 'inline' | 'html' | 'frontmatter'
  /** frontmatter 字段名（仅 frontmatter 类型有值） */
  field?: string
}

export function parseImageRefs(markdown: string): ImageRef[] {
  const results: ImageRef[] = []
  const lines = markdown.split('\n')

  // 匹配 ![alt](url) 格式（支持路径含空格）
  const inlineRegex = /!\[([^\]]*)\]\(([^)]+?)\)/g
  // 匹配 <img src="url"> 格式
  const htmlRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  // 匹配 YAML frontmatter 中的图片字段：cover/image/thumbnail/banner/featured_image/hero
  const fmImageFields = /^(cover|image|thumbnail|banner|featured_image|hero)\s*:\s*["']?([^\s"']+)["']?\s*$/i

  // 检测是否在 frontmatter 区域内（--- 包围）
  let inFrontMatter = false
  let frontMatterStart = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // frontmatter 边界检测
    if (line.trim() === '---') {
      if (!inFrontMatter) {
        inFrontMatter = true
        frontMatterStart = i
        continue
      } else if (inFrontMatter && frontMatterStart !== i) {
        inFrontMatter = false
        continue
      }
    }

    // 处理 frontmatter 中的图片字段
    if (inFrontMatter) {
      const fmMatch = line.match(fmImageFields)
      if (fmMatch) {
        const url = fmMatch[2].replace(/["']$/g, '') // 去掉末尾可能的引号
        if (url && !url.startsWith('#')) {
          results.push({
            url,
            line: i + 1,
            alt: '',
            raw: line,
            type: 'frontmatter',
            field: fmMatch[1],
          })
        }
      }
      continue
    }

    // 处理 ![alt](url)
    let match: RegExpExecArray | null
    inlineRegex.lastIndex = 0
    while ((match = inlineRegex.exec(line)) !== null) {
      results.push({
        url: match[2],
        line: i + 1,
        alt: match[1],
        raw: match[0],
        type: 'inline',
      })
    }

    // 处理 <img src="url">
    htmlRegex.lastIndex = 0
    while ((match = htmlRegex.exec(line)) !== null) {
      results.push({
        url: match[1],
        line: i + 1,
        alt: '',
        raw: match[0],
        type: 'html',
      })
    }
  }

  return results
}

/**
 * 判断图片 URL 是本地路径还是网络 URL
 */
export function isLocalImage(url: string): boolean {
  return !/^https?:\/\//i.test(url)
}

/**
 * 判断图片 URL 是网络 URL 还是本地路径
 */
export function isRemoteImage(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/**
 * 递归扫描目录下所有 .md 文件，返回文件路径列表
 */
export async function scanMarkdownFiles(dirPath: string): Promise<string[]> {
  const results: string[] = []
  await scanDirRecursive(dirPath, results)
  return results
}

async function scanDirRecursive(dir: string, results: string[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // 跳过隐藏目录和 node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      await scanDirRecursive(fullPath, results)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath)
    }
  }
}

/**
 * 根据文章文件名，生成图片存放目录路径
 * 规则：在 outputDir 下创建与 md 文件同名的文件夹
 * 例如 outputDir=D:/WorkSpace/Blog/backed, mdFilePath=blog.md
 *   → D:/WorkSpace/Blog/backed/blog/
 */
export function getImageOutputDir(mdFilePath: string, outputDir: string): string {
  const mdName = path.basename(mdFilePath, '.md')
  return path.join(outputDir, mdName)
}

/**
 * 生成图片文件名（避免冲突）
 */
export function generateImageFileName(originalName: string, index: number): string {
  const ext = path.extname(originalName) || '.png'
  const base = path.basename(originalName, ext)
  return `${base}_${Date.now()}_${index}${ext}`
}

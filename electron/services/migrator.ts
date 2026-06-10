import fs from 'fs/promises'
import path from 'path'
import { IImageBedAdapter } from '../../plugins/base-adapter'
import { parseImageRefs, isLocalImage, isRemoteImage, getImageOutputDir, generateImageFileName } from './markdown-parser'

export interface MigrationResult {
  mdFile: string
  totalImages: number
  successCount: number
  failCount: number
  details: Array<{ url: string; status: 'success' | 'failed'; newUrl?: string; error?: string }>
  newContent: string
}

export type LogCallback = (message: string) => void

/**
 * 核心迁移引擎
 * mode: 'upload'   = 本地图片 → 图床
 * mode: 'download' = 图床图片 → 本地
 */
export async function runMigration(
  mdFilePath: string,
  mode: 'upload' | 'download',
  adapter: IImageBedAdapter,
  adapterConfig: Record<string, string>,
  outputDir: string,
  log: LogCallback
): Promise<MigrationResult> {
  log(`📄 处理文件: ${path.basename(mdFilePath)}`)

  const content = await fs.readFile(mdFilePath, 'utf-8')
  const imageRefs = parseImageRefs(content)
  const targetImages = mode === 'upload'
    ? imageRefs.filter(img => isLocalImage(img.url))
    : imageRefs.filter(img => isRemoteImage(img.url))

  if (targetImages.length === 0) {
    log(`   ⚠️  无需要处理的图片`)
    return {
      mdFile: mdFilePath,
      totalImages: 0,
      successCount: 0,
      failCount: 0,
      details: [],
      newContent: content,
    }
  }

  log(`   找到 ${targetImages.length} 张需要处理的图片`)

  const mdName = path.basename(mdFilePath, '.md')
  // download 模式：图片保存到 outputDir/mdName/ 目录
  const imageDir = mode === 'download' ? getImageOutputDir(mdFilePath, outputDir) : ''
  if (imageDir) {
    await fs.mkdir(imageDir, { recursive: true })
  }

  let newContent = content
  const details: MigrationResult['details'] = []
  let successCount = 0
  let failCount = 0

  for (let i = 0; i < targetImages.length; i++) {
    const img = targetImages[i]
    log(`   [${i + 1}/${targetImages.length}] ${img.url}`)

    try {
      let replacement = ''

      if (mode === 'upload') {
        // 本地 → 图床：localPath 基于【源 md 文件所在目录】解析
        const localPath = path.resolve(path.dirname(mdFilePath), img.url)
        log(`      本地路径: ${localPath}`)

        const result = await adapter.upload(localPath, adapterConfig)
        if (!result.success || !result.url) {
          throw new Error(result.error ?? '上传失败，未返回 URL')
        }

        replacement = buildReplacement(img, result.url, mdFilePath)
        log(`      ✅ 上传成功: ${result.url}`)
        details.push({ url: img.url, status: 'success', newUrl: result.url })
        successCount++

      } else {
        // 图床 → 本地：图片下载到 outputDir/mdName/ 目录
        const ext = path.extname(new URL(img.url).pathname) || '.png'
        const newFileName = generateImageFileName(path.basename(new URL(img.url).pathname), i)
        const result = await adapter.download(img.url, imageDir, newFileName, adapterConfig)

        if (!result.success || !result.localPath) {
          throw new Error(result.error ?? '下载失败')
        }

        // 引用路径：mdName/xxx.ext（与输出 md 同级，保留原始后缀）
        const posixPath = mdName + '/' + newFileName.replace(/\\/g, '/')

        replacement = buildReplacement(img, posixPath, mdFilePath)
        log(`      ✅ 下载成功: ${posixPath}`)
        details.push({ url: img.url, status: 'success', newUrl: posixPath })
        successCount++
      }

      newContent = newContent.replace(img.raw, replacement)
    } catch (e: any) {
      log(`      ❌ 处理失败: ${e.message}`)
      details.push({ url: img.url, status: 'failed', error: e.message })
      failCount++
    }
  }

  log(`   ✅ 完成: 成功 ${successCount}，失败 ${failCount}`)

  return {
    mdFile: mdFilePath,
    totalImages: targetImages.length,
    successCount,
    failCount,
    details,
    newContent,
  }
}

/**
 * 根据图片引用类型，构建替换后的字符串
 */
function buildReplacement(img: ReturnType<typeof parseImageRefs>[number], newUrl: string, mdFilePath: string): string {
  switch (img.type) {
    case 'frontmatter':
      // frontmatter 格式：field: 'url' 或 field: url
      // 保留原始引号风格
      const original = img.raw
      const hasQuotes = original.includes(`'${img.url}'`) || original.includes(`"${img.url}"`)
      if (hasQuotes) {
        const quote = original.includes(`'${img.url}'`) ? "'" : '"'
        return `${img.field}: ${quote}${newUrl}${quote}`
      }
      return `${img.field}: ${newUrl}`

    case 'html':
      // HTML <img> 标签，替换 src 属性
      return img.raw.replace(img.url, newUrl)

    case 'inline':
    default:
      // 标准 Markdown: ![alt](url)
      return `![${img.alt}](${newUrl})`
  }
}

/**
 * 将原 Markdown 文件备份（加 .bak 后缀）
 */
export async function backupFile(mdFilePath: string): Promise<string> {
  const backupPath = mdFilePath + '.bak'
  await fs.copyFile(mdFilePath, backupPath)
  return backupPath
}

/**
 * 将处理后的内容写入输出目录
 */
export async function writeOutputFile(
  originalPath: string,
  newContent: string,
  outputDir: string
): Promise<string> {
  const relativePath = path.relative(process.cwd(), originalPath)
  const outPath = path.join(outputDir, path.basename(originalPath))
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, newContent, 'utf-8')
  return outPath
}

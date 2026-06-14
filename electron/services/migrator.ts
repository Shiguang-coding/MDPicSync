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
 * 并发控制映射（方案 A：并发上传）
 * 最多同时处理 concurrency 个任务，避免图床限流
 */
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  let idx = 0
  const results: Promise<PromiseSettledResult<R>>[] = []

  async function worker() {
    while (idx < items.length) {
      const i = idx++
      try {
        const value = await mapper(items[i], i)
        results[i] = Promise.resolve({ status: 'fulfilled', value })
      } catch (reason) {
        results[i] = Promise.resolve({ status: 'rejected', reason })
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  )
  await Promise.all(workers)
  return Promise.all(results)
}

/**
 * 核心迁移引擎（并发版）
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
    log(`   ⚠️ 无需要处理的图片`)
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
  const imageDir = mode === 'download' ? getImageOutputDir(mdFilePath, outputDir) : ''
  if (imageDir) {
    await fs.mkdir(imageDir, { recursive: true })
  }

  // 并发处理（方案 A）
  const CONCURRENCY = 3

  const results = await mapConcurrent(
    targetImages,
    CONCURRENCY,
    async (img, index) => {
      log(`   [${index + 1}/${targetImages.length}] ${img.url}`)

      try {
        let replacement = ''

        if (mode === 'upload') {
          const localPath = path.resolve(path.dirname(mdFilePath), img.url)
          log(`      本地路径: ${localPath}`)

          const result = await adapter.upload(localPath, adapterConfig)
          if (!result.success || !result.url) {
            throw new Error(result.error ?? '上传失败，未返回 URL')
          }

          replacement = buildReplacement(img, result.url, mdFilePath)
          log(`      ✅ 上传成功: ${result.url}`)
        } else {
          const ext = path.extname(new URL(img.url).pathname) || '.png'
          const newFileName = generateImageFileName(path.basename(new URL(img.url).pathname), index)
          const result = await adapter.download(img.url, imageDir, newFileName, adapterConfig)

          if (!result.success || !result.localPath) {
            throw new Error(result.error ?? '下载失败')
          }

          const posixPath = mdName + '/' + newFileName.replace(/\\/g, '/')
          replacement = buildReplacement(img, posixPath, mdFilePath)
          log(`      ✅ 下载成功: ${posixPath}`)
        }

        return { originalRaw: img.raw, replacement }
      } catch (e: any) {
        log(`      ❌ 处理失败: ${e.message}`)
        throw e
      }
    }
  )

  // 应用替换（按行号+列号从后向前替换，避免偏移）
  const lines = content.split('\n')
  const details: MigrationResult['details'] = []
  let successCount = 0
  let failCount = 0

  // 构建（行号, 列号, 替换内容）列表，按位置从后往前排序
  const replacements: Array<{ lineIdx: number; colStart: number; rawLen: number; replacement: string }> = []

  for (let i = 0; i < targetImages.length; i++) {
    const img = targetImages[i]
    const result = results[i]

    if (result.status === 'fulfilled') {
      replacements.push({
        lineIdx: img.line - 1, // ImageRef.line 是 1-based
        colStart: img.colStart,
        rawLen: img.raw.length,
        replacement: result.value.replacement,
      })
      details.push({ url: img.url, status: 'success', newUrl: result.value.replacement })
      successCount++
    } else {
      details.push({ url: img.url, status: 'failed', error: (result.reason as Error)?.message ?? String(result.reason) })
      failCount++
    }
  }

  // 从后向前替换，确保前面的位置不受影响
  replacements.sort((a, b) => {
    if (a.lineIdx !== b.lineIdx) return b.lineIdx - a.lineIdx
    return b.colStart - a.colStart
  })

  for (const rep of replacements) {
    const line = lines[rep.lineIdx]
    if (line !== undefined) {
      lines[rep.lineIdx] = line.slice(0, rep.colStart) + rep.replacement + line.slice(rep.colStart + rep.rawLen)
    }
  }

  const newContent = lines.join('\n')

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
      const original = img.raw
      const hasQuotes = original.includes(`'${img.url}'`) || original.includes(`"${img.url}"`)
      if (hasQuotes) {
        const quote = original.includes(`'${img.url}'`) ? "'" : '"'
        return `${img.field}: ${quote}${newUrl}${quote}`
      }
      return `${img.field}: ${newUrl}`

    case 'html':
      return img.raw.replace(img.url, newUrl)

    case 'inline':
    default:
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

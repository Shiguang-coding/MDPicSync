import axios from 'axios'
import fs from 'fs/promises'
import path from 'path'
import { IImageBedAdapter, ImageUploadResult, ImageDownloadResult, ImageBedConfigField } from './base-adapter'

export class CfImgbedAdapter implements IImageBedAdapter {
  id = 'cf-imgbed'
  name = 'CloudFlare ImgBed'

  configFields: ImageBedConfigField[] = [
    { key: 'apiUrl', label: 'API 地址', type: 'text', placeholder: 'https://imgbed.example.com/upload', required: true },
    { key: 'authCode', label: '鉴权码 (Auth Code)', type: 'password', required: false },
  ]

  async upload(filePath: string, config: Record<string, string>): Promise<ImageUploadResult> {
    try {
      // 规范化路径，处理中文/空格
      const normalizedPath = path.resolve(filePath)
      console.log(`[cf-imgbed] 上传文件: ${normalizedPath}`)

      // 先检查文件是否存在
      await fs.access(normalizedPath)
      console.log(`[cf-imgbed] 文件存在，开始读取...`)

      const fileBuffer = await fs.readFile(normalizedPath)
      console.log(`[cf-imgbed] 文件读取成功，大小: ${fileBuffer.length} bytes`)

      const FormData = (await import('form-data')).default
      const form = new FormData()
      form.append('file', fileBuffer, path.basename(normalizedPath))

      const headers: Record<string, string> = { ...form.getHeaders() }
      if (config['authCode']) {
        headers['Authorization'] = config['authCode']
      }

      const res = await axios.post(config['apiUrl'], form, { headers })

      // 调试：打印完整响应
      console.log('[cf-imgbed] 完整响应:', JSON.stringify(res.data))

      // 优先按 CloudFlare ImgBed 官方格式解析
      // 格式1: [{"src":"/file/xxx.png"}]
      if (Array.isArray(res.data) && res.data.length > 0) {
        const src = res.data[0]?.src
        if (src) {
          const fullUrl = buildFullUrl(src, config['apiUrl'])
          return { success: true, url: fullUrl }
        }
      }

      // 格式2: {"src":"/file/xxx.png"} 或 {"url":"..."}
      const url =
        res.data?.src ??
        res.data?.url ??
        res.data?.data?.src ??
        res.data?.data?.url ??
        res.data?.link ??
        res.data?.data?.link

      if (!url) {
        return { success: false, error: `上传成功但未获取到图片 URL，API返回: ${JSON.stringify(res.data).slice(0, 200)}` }
      }

      // 如果 url 是相对路径，补全为完整 URL
      const fullUrl = url.startsWith('http') ? url : buildFullUrl(url, config['apiUrl'])
      return { success: true, url: fullUrl }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  async download(
    imageUrl: string,
    targetDir: string,
    fileName: string,
    _config: Record<string, string>
  ): Promise<ImageDownloadResult> {
    try {
      const res = await axios.get(imageUrl, { responseType: 'arraybuffer' })
      const outPath = path.join(targetDir, fileName)
      await fs.writeFile(outPath, res.data)
      return { success: true, localPath: outPath }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
}

/**
 * 将相对路径拼接为完整 URL
 * 例如: /file/xxx.png + https://img.shiguang666.eu.org/upload
 *   -> https://img.shiguang666.eu.org/file/xxx.png
 */
function buildFullUrl(src: string, apiUrl: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  try {
    const u = new URL(apiUrl)
    return u.origin + src
  } catch {
    // 解析失败，简单拼接
    let base = apiUrl
    const idx = base.indexOf('/', base.indexOf('//') + 3)
    const baseOrigin = idx === -1 ? base.replace(/\/+$/, '') : base.substring(0, idx)
    return baseOrigin + src
  }
}

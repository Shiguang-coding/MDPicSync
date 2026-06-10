import axios from 'axios'
import fs from 'fs/promises'
import path from 'path'
import https from 'https'
import { IImageBedAdapter, ImageUploadResult, ImageDownloadResult, ImageBedConfigField, ValidateResult } from './base-adapter'

// 全局共用 HTTP Agent（方案 B：连接复用）
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 5 })

export class CfImgbedAdapter implements IImageBedAdapter {
  id = 'cf-imgbed'
  name = 'CloudFlare ImgBed'

  configFields: ImageBedConfigField[] = [
    { key: 'apiUrl', label: 'API 地址', type: 'text', placeholder: 'https://imgbed.example.com/upload', required: true },
    { key: 'authCode', label: '鉴权码 (Auth Code)', type: 'password', required: false },
  ]

  /**
   * 测试连接：用 1x1 像素 PNG 真正尝试上传，验证 apiUrl + authCode 是否有效
   * 同时检测服务端是否未启用鉴权（即不带 authCode 也能上传成功）
   */
  async validateConfig(config: Record<string, string>): Promise<ValidateResult> {
    try {
      const apiUrl = config['apiUrl']
      if (!apiUrl) return { ok: false, error: 'API 地址不能为空' }

      // 校验 URL 格式
      const url = new URL(apiUrl)

      // 构造一个 1x1 像素 PNG 的 Buffer（最小合法图片）
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWgqbpQAAAABJRU5ErkJggg=='
      const pngBuffer = Buffer.from(pngBase64, 'base64')

      const FormData = (await import('form-data')).default

      // --- 第一次请求：带 authCode（如果有）---
      const form1 = new FormData()
      form1.append('file', pngBuffer, 'test-connect.png')

      const headers1: Record<string, string> = { ...form1.getHeaders() }
      if (config['authCode']) {
        headers1['Authorization'] = config['authCode']
      }

      const res1 = await axios.post(apiUrl, form1, {
        headers: headers1,
        timeout: 8000,
        validateStatus: () => true,
        httpsAgent,
      })

      // 网络层失败
      if (res1.status === 0) return { ok: false, error: '无法连接到服务器' }

      // 解析第一次请求结果
      const uploaded1 = this._hasValidUrl(res1.data)

      // 4xx/5xx：配置有误
      if (res1.status >= 400) return { ok: false, error: `服务器返回错误状态码: ${res1.status}` }

      // 2xx 但没有有效 URL，说明服务端返回了错误格式
      if (res1.status >= 200 && res1.status < 300 && !uploaded1) {
        return { ok: false, error: '上传测试失败，服务端返回格式异常' }
      }

      // 到这里说明第一次请求成功
      // --- 第二次请求：不带 authCode，检测服务端是否未启用鉴权 ---
      const hasAuthCode = !!(config['authCode'] && String(config['authCode']).trim())
      let warning = ''

      if (hasAuthCode) {
        const form2 = new FormData()
        form2.append('file', pngBuffer, 'test-connect-no-auth.png')

        const headers2: Record<string, string> = { ...form2.getHeaders() }
        // 故意不传 Authorization

        try {
          const res2 = await axios.post(apiUrl, form2, {
            headers: headers2,
            timeout: 8000,
            validateStatus: () => true,
            httpsAgent,
          })

          const uploaded2 = this._hasValidUrl(res2.data)
          // 不带 authCode 也能成功 → 服务端未启用鉴权
          if (res2.status >= 200 && res2.status < 300 && uploaded2) {
            warning = '警告：服务端未启用鉴权，您填写的鉴权码无效！请在服务端启用鉴权功能。'
          }
        } catch {
          // 第二次请求失败是正常的（说明服务端启用了鉴权）
        }
      }

      return { ok: true, warning }
    } catch (e: any) {
      console.error('[cf-imgbed] validateConfig failed:', e.message)
      return { ok: false, error: e.message || '连接测试异常' }
    }
  }

  /**
   * 从响应体中提取是否有有效图片 URL
   */
  private _hasValidUrl(body: any): boolean {
    if (Array.isArray(body) && body.length > 0 && body[0]?.src) return true
    if (body?.src || body?.url || body?.data?.src || body?.data?.url || body?.link || body?.data?.link) return true
    return false
  }

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

      const res = await axios.post(config['apiUrl'], form, { headers, httpsAgent })

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
      const res = await axios.get(imageUrl, { responseType: 'arraybuffer', httpsAgent })
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

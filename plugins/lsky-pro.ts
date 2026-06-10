import { IImageBedAdapter, ImageUploadResult, ImageDownloadResult, ImageBedConfigField } from './base-adapter'
import axios from 'axios'
import fs from 'fs/promises'
import path from 'path'

export class LskyProAdapter implements IImageBedAdapter {
  id = 'lsky-pro'
  name = 'Lsky Pro (蓝空图床)'

  configFields: ImageBedConfigField[] = [
    { key: 'apiUrl', label: 'API 地址', type: 'text', placeholder: 'https://your-lsky.com/api/v1', required: true },
    { key: 'email', label: '邮箱', type: 'text', required: true },
    { key: 'password', label: '密码', type: 'password', required: true },
  ]

  private token: string | null = null

  async validateConfig(config: Record<string, string>): Promise<boolean> {
    try {
      const res = await axios.post(`${config['apiUrl']}/tokens`, {
        email: config['email'],
        password: config['password'],
      })
      // Lsky Pro 返回格式: {"status":true,"data":{"token":"..."}}
      this.token = res.data?.data?.token ?? res.data?.token ?? null
      return !!this.token
    } catch (e: any) {
      console.error('[lsky-pro] Login failed:', e.message)
      return false
    }
  }

  async upload(filePath: string, config: Record<string, string>): Promise<ImageUploadResult> {
    try {
      if (!this.token) {
        const valid = await this.validateConfig(config)
        if (!valid) return { success: false, error: '登录失败，请检查配置' }
      }

      const FormData = (await import('form-data')).default
      const form = new FormData()
      form.append('file', await fs.readFile(filePath), path.basename(filePath))

      const res = await axios.post(`${config['apiUrl']}/upload`, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${this.token}`,
        },
      })

      // Lsky Pro 返回格式: {"status":true,"data":{"links":{"url":"..."}}}
      // 或: {"status":true,"data":{"url":"..."}}
      const body = res.data

      // 先判断 status
      if (body?.status === false || body?.status === 'false') {
        const msg = body?.message ?? '上传失败'
        return { success: false, error: msg }
      }

      const data = body?.data ?? body
      const url =
        data?.links?.url ??
        data?.url ??
        data?.image_url ??
        data?.src ??
        body?.url ??
        body?.src

      if (!url) {
        console.error('[lsky-pro] Upload response:', JSON.stringify(res.data).slice(0, 500))
        return { success: false, error: `上传成功但未获取到图片 URL，API返回: ${JSON.stringify(res.data).slice(0, 200)}` }
      }
      return { success: true, url }
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

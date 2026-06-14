import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import axios from 'axios'
import https from 'https'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { IImageBedAdapter, ImageUploadResult, ImageDownloadResult, ImageBedConfigField, ValidateResult } from './base-adapter'

export class CfR2Adapter implements IImageBedAdapter {
  id = 'cf-r2'
  name = 'CloudFlare R2'

  configFields: ImageBedConfigField[] = [
    { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'https://xxx.r2.cloudflarestorage.com', required: true },
    { key: 'accessKey', label: 'Access Key ID', type: 'text', required: true },
    { key: 'secretKey', label: 'Secret Access Key', type: 'password', required: true },
    { key: 'bucketName', label: 'Bucket 名称', type: 'text', required: true },
    { key: 'publicUrl', label: '公开访问 URL', type: 'text', placeholder: 'https://pub-xxx.r2.dev 或 https://img.example.com', required: true },
    { key: 'pathPrefix', label: '上传路径前缀', type: 'text', placeholder: 'md-images（留空则为根目录）', required: false },
  ]

  // 连接复用
  private agent = new https.Agent({ keepAlive: true, maxSockets: 5 })

  // 缓存的 S3Client 实例及对应的配置指纹
  private _cachedClient: S3Client | null = null
  private _clientConfigHash: string = ''

  /**
   * 根据配置生成指纹，用于判断是否需要重建 Client
   */
  private getConfigHash(config: Record<string, string>): string {
    return `${config['endpoint']}|${config['accessKey']}|${config['secretKey']}`
  }

  /**
   * 获取或创建 S3Client 实例（相同配置时复用）
   */
  private getClient(config: Record<string, string>): S3Client {
    const hash = this.getConfigHash(config)
    if (this._cachedClient && this._clientConfigHash === hash) {
      return this._cachedClient
    }

    // 销毁旧实例
    if (this._cachedClient) {
      this._cachedClient.destroy()
    }

    this._cachedClient = new S3Client({
      endpoint: config['endpoint'],
      region: 'auto',
      credentials: {
        accessKeyId: config['accessKey'],
        secretAccessKey: config['secretKey'],
      },
    })
    this._clientConfigHash = hash
    return this._cachedClient
  }

  /**
   * 测试连接：用 headBucket 验证 endpoint、credentials、bucket 是否有效
   */
  async validateConfig(config: Record<string, string>): Promise<ValidateResult> {
    try {
      const client = this.getClient(config)
      await client.send(new HeadBucketCommand({ Bucket: config['bucketName'] }))
      return { ok: true, warning: '' }
    } catch (e: any) {
      console.error('[cf-r2] validateConfig failed:', e.message)
      return { ok: false, error: e.message ?? '连接测试异常' }
    }
  }

  async upload(filePath: string, config: Record<string, string>): Promise<ImageUploadResult> {
    try {
      const client = this.getClient(config)
      const fileBuffer = await fs.readFile(filePath)
      const fileName = path.basename(filePath)
      const prefix = (config['pathPrefix'] || 'md-images').replace(/^\/+|\/+$/g, '')
      // 使用随机 hex 替代 Date.now()，避免并发上传时文件名冲突
      const uniqueId = crypto.randomBytes(4).toString('hex')
      const key = prefix ? `${prefix}/${uniqueId}-${fileName}` : `${uniqueId}-${fileName}`

      await client.send(
        new PutObjectCommand({
          Bucket: config['bucketName'],
          Key: key,
          Body: fileBuffer,
          ContentType: this.getMime(fileName),
        })
      )

      const rawUrl = (config['publicUrl'] || '').replace(/\/+$/, '')
      if (!rawUrl) return { success: false, error: '公开访问 URL 未配置，请在图床配置中填写' }
      const url = `${rawUrl}/${key}`
      return { success: true, url }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  async download(
    imageUrl: string,
    targetDir: string,
    fileName: string,
    config: Record<string, string>
  ): Promise<ImageDownloadResult> {
    try {
      const res = await axios.get(imageUrl, { responseType: 'arraybuffer', httpsAgent: this.agent })
      const outPath = path.join(targetDir, fileName)
      await fs.writeFile(outPath, res.data)
      return { success: true, localPath: outPath }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  private getMime(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase()
    const map: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
    }
    return map[ext] ?? 'application/octet-stream'
  }
}

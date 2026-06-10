import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import axios from 'axios'
import fs from 'fs/promises'
import path from 'path'
import { IImageBedAdapter, ImageUploadResult, ImageDownloadResult, ImageBedConfigField } from './base-adapter'

export class CfR2Adapter implements IImageBedAdapter {
  id = 'cf-r2'
  name = 'CloudFlare R2'

  configFields: ImageBedConfigField[] = [
    { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'https://xxx.r2.cloudflarestorage.com', required: true },
    { key: 'accessKey', label: 'Access Key ID', type: 'text', required: true },
    { key: 'secretKey', label: 'Secret Access Key', type: 'password', required: true },
    { key: 'bucketName', label: 'Bucket 名称', type: 'text', required: true },
    { key: 'publicUrl', label: '公开访问 URL', type: 'text', placeholder: 'https://pub-xxx.r2.dev', required: true },
  ]

  private getClient(config: Record<string, string>) {
    return new S3Client({
      endpoint: config['endpoint'],
      region: 'auto',
      credentials: {
        accessKeyId: config['accessKey'],
        secretAccessKey: config['secretKey'],
      },
    })
  }

  async upload(filePath: string, config: Record<string, string>): Promise<ImageUploadResult> {
    try {
      const client = this.getClient(config)
      const fileBuffer = await fs.readFile(filePath)
      const fileName = path.basename(filePath)
      const key = `md-images/${Date.now()}-${fileName}`

      await client.send(
        new PutObjectCommand({
          Bucket: config['bucketName'],
          Key: key,
          Body: fileBuffer,
          ContentType: this.getMime(fileName),
        })
      )

      const url = `${config['publicUrl'].replace(/\/$/, '')}/${key}`
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
      const res = await axios.get(imageUrl, { responseType: 'arraybuffer' })
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
    }
    return map[ext] ?? 'application/octet-stream'
  }
}

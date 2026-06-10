export interface ImageBedConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'number'
  placeholder?: string
  required: boolean
}

export interface ImageUploadResult {
  success: boolean
  url?: string
  error?: string
}

export interface ImageDownloadResult {
  success: boolean
  localPath?: string
  error?: string
}

/** 连接测试结果（扩展版，支持警告信息） */
export interface ValidateResult {
  ok: boolean
  error?: string
  warning?: string  // 警告（如"服务端未启用鉴权"）
}

export interface IImageBedAdapter {
  /** 图床唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 所需配置字段定义 */
  configFields: ImageBedConfigField[]

  /**
   * 上传图片，返回远程 URL
   * @param filePath 本地图片路径
   * @param config   用户配置的图床参数
   */
  upload(filePath: string, config: Record<string, string>): Promise<ImageUploadResult>

  /**
   * 从图床下载图片到本地
   * @param imageUrl  图片远程 URL
   * @param targetDir 本地保存目录
   * @param fileName  保存的文件名
   * @param config    用户配置的图床参数
   */
  download(
    imageUrl: string,
    targetDir: string,
    fileName: string,
    config: Record<string, string>
  ): Promise<ImageDownloadResult>

  /**
   * 验证配置是否有效（可选实现，默认返回 { ok: true }）
   * 返回 ValidateResult，支持 warning 字段
   */
  validateConfig?(config: Record<string, string>): Promise<ValidateResult>
}

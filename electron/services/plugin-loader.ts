import fs from 'fs/promises'
import path from 'path'
import { IImageBedAdapter } from '../../plugins/base-adapter'

/**
 * 插件加载器：动态加载 plugins/ 目录下的所有适配器
 * 由于 TypeScript 编译后需要 JS 文件，这里加载编译后的 .js 文件
 */
const pluginsDir = path.resolve(__dirname, '../../plugins')

export async function loadAdapters(): Promise<IImageBedAdapter[]> {
  const adapters: IImageBedAdapter[] = []

  try {
    const files = await fs.readdir(pluginsDir)
    for (const file of files) {
      if (!file.endsWith('.js') && !file.endsWith('.ts')) continue
      if (file === 'base-adapter.ts' || file === 'base-adapter.js') continue

      try {
        // 动态 require（编译后加载 .js）
        const filePath = path.join(pluginsDir, file)
        const module = require(filePath)
        for (const exportKey of Object.keys(module)) {
          const ExportClass = module[exportKey]
          if (typeof ExportClass === 'function' && ExportClass.prototype) {
            try {
              const instance = new ExportClass()
              if (instance && typeof instance.id === 'string' && typeof instance.upload === 'function') {
                adapters.push(instance)
              }
            } catch (err) {
              // 忽略无法实例化的导出
            }
          }
        }
      } catch (e) {
        console.warn(`加载插件失败: ${file}`, e)
      }
    }
  } catch (e) {
    console.error('读取插件目录失败', e)
  }

  return adapters
}

/**
 * 根据 id 查找适配器
 */
export function findAdapter(adapters: IImageBedAdapter[], id: string): IImageBedAdapter | undefined {
  return adapters.find(a => a.id === id)
}

/**
 * 剪贴板工具 - 用于获取剪贴板中的图片
 * 支持 Windows 系统，使用 PowerShell 命令获取剪贴板图片
 */
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getCurrentWorkDir } from './pathUtils.js'

/**
 * 从剪贴板获取图片并保存到 .front/design/ 目录
 * @returns {Promise<string|null>} - 保存的图片路径，如果没有图片则返回 null
 */
export async function saveClipboardImage() {
  const designDir = path.join(getCurrentWorkDir(), '.front', 'design')

  // 确保 design 目录存在
  if (!fs.existsSync(designDir)) {
    fs.mkdirSync(designDir, { recursive: true })
  }

  // 生成唯一的文件名（使用时间戳）
  const timestamp = Date.now()
  const fileName = `clipboard_${timestamp}.png`
  const filePath = path.join(designDir, fileName)

  // PowerShell 命令：从剪贴板获取图片并保存
  // 使用 .NET 的 System.Windows.Forms.Clipboard 类
  const psCommand = `
    Add-Type -AssemblyName System.Windows.Forms
    $clipboard = [System.Windows.Forms.Clipboard]::GetImage()
    if ($clipboard -ne $null) {
      $clipboard.Save('${filePath.replace(/\\/g, '\\\\')}')
      Write-Output 'SUCCESS'
    } else {
      Write-Output 'NO_IMAGE'
    }
  `.trim()

  return new Promise((resolve, reject) => {
    // 执行 PowerShell 命令
    exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
      if (error) {
        // 如果 PowerShell 命令执行失败，可能是没有图片或其他错误
        reject(new Error('无法获取剪贴板图片'))
        return
      }

      const result = stdout.trim()
      if (result === 'SUCCESS') {
        // 图片保存成功
        resolve(filePath)
      } else {
        // 剪贴板中没有图片
        resolve(null)
      }
    })
  })
}

/**
 * 检查剪贴板中是否有图片
 * @returns {Promise<boolean>} - 是否有图片
 */
export async function hasClipboardImage() {
  const psCommand = `
    Add-Type -AssemblyName System.Windows.Forms
    $clipboard = [System.Windows.Forms.Clipboard]::GetImage()
    if ($clipboard -ne $null) {
      Write-Output 'HAS_IMAGE'
    } else {
      Write-Output 'NO_IMAGE'
    }
  `.trim()

  return new Promise((resolve, reject) => {
    exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
      if (error) {
        resolve(false)
        return
      }

      resolve(stdout.trim() === 'HAS_IMAGE')
    })
  })
}

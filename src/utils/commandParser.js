/**
 * 指令解析器 - 解析用户输入中的指令、文件引用和图片引用
 */
import fs from 'fs'
import path from 'path'
import { getCurrentWorkDir } from './pathUtils.js'

/**
 * 解析用户输入
 * @param {string} input - 用户输入的文本
 * @returns {Object} - 解析结果
 *   - isCommand: 是否是指令
 *   - command: 指令名称（如果是指令）
 *   - args: 指令参数（如果是指令）
 *   - hasFileRefs: 是否包含文件引用
 *   - fileRefs: 文件引用列表
 *   - hasImageRefs: 是否包含图片引用
 *   - imageRefs: 图片引用列表
 *   - cleanInput: 清理后的输入文本
 */
export function parseInput(input) {
  const trimmedInput = input.trim()
  const result = {
    isCommand: false,
    command: null,
    args: null,
    hasFileRefs: false,
    fileRefs: [],
    hasImageRefs: false,
    imageRefs: [],
    cleanInput: trimmedInput
  }

  // 检查是否是指令（以 / 开头，前后无空格）
  if (trimmedInput.startsWith('/') && !trimmedInput.startsWith('/ ')) {
    const parts = trimmedInput.split(/\s+/)
    result.isCommand = true
    result.command = parts[0].toLowerCase()
    result.args = parts.slice(1).join(' ') || null
  }

  // 提取文件引用
  const fileRefs = extractFileReferences(trimmedInput)
  if (fileRefs.length > 0) {
    result.hasFileRefs = true
    result.fileRefs = fileRefs
  }

  // 提取图片引用
  const imageRefs = extractImageReferences(trimmedInput)
  if (imageRefs.length > 0) {
    result.hasImageRefs = true
    result.imageRefs = imageRefs
  }

  return result
}

/**
 * 提取输入中的文件引用
 * @param {string} input - 用户输入
 * @returns {Array} - 文件引用列表 [{reference, filePath}]
 */
export function extractFileReferences(input) {
  const fileRefs = []
  // 匹配 @ 开头的文件路径（支持路径中的字母、数字、下划线、斜杠、点、横杠）
  const regex = /@([a-zA-Z0-9_/\\.\-]+)/g
  let match

  while ((match = regex.exec(input)) !== null) {
    const reference = match[0] // 完整的 @xxx
    const filePath = match[1]  // 文件路径部分

    // 验证文件是否存在
    const fullPath = path.resolve(getCurrentWorkDir(), filePath)
    if (fs.existsSync(fullPath)) {
      fileRefs.push({
        reference,
        filePath,
        fullPath
      })
    }
  }

  return fileRefs
}

/**
 * 提取输入中的图片引用
 * @param {string} input - 用户输入
 * @returns {Array} - 图片引用列表 [{reference, fileName, fullPath}]
 */
export function extractImageReferences(input) {
  const imageRefs = []
  // 匹配 # 开头的图片文件名（支持字母、数字、下划线、点、横杠）
  const regex = /#([a-zA-Z0-9_\-\.]+\.(png|jpg|jpeg|gif|webp|bmp))/gi
  let match

  while ((match = regex.exec(input)) !== null) {
    const reference = match[0] // 完整的 #xxx.png
    const fileName = match[1]  // 文件名部分

    // 图片文件存放在 .front/design/ 目录下
    const fullPath = path.join(getCurrentWorkDir(), '.front', 'design', fileName)

    // 验证文件是否存在
    if (fs.existsSync(fullPath)) {
      imageRefs.push({
        reference,
        fileName,
        fullPath
      })
    }
  }

  return imageRefs
}

/**
 * 读取文件内容
 * @param {string} filePath - 文件路径
 * @returns {string} - 文件内容
 */
export function readFileContent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return content
  } catch (error) {
    console.error(`读取文件失败: ${error.message}`)
    return null
  }
}

/**
 * 处理文件引用，将文件内容作为上下文
 * @param {string} input - 用户输入
 * @param {Array} fileRefs - 文件引用列表
 * @returns {Object} - 处理结果
 *   - message: 处理后的消息
 *   - context: 文件内容上下文
 */
export function processFileReferences(input, fileRefs) {
  if (!fileRefs || fileRefs.length === 0) {
    return {
      message: input,
      context: null
    }
  }

  // 读取所有引用的文件内容
  const fileContents = []
  for (const ref of fileRefs) {
    const content = readFileContent(ref.fullPath)
    if (content) {
      fileContents.push({
        path: ref.filePath,
        content
      })
    }
  }

  // 构建上下文
  let context = null
  if (fileContents.length > 0) {
    context = fileContents.map(file =>
      `文件: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``
    ).join('\n\n')
  }

  // 移除输入中的 @ 引用标记，保留问题部分
  let cleanMessage = input
  for (const ref of fileRefs) {
    cleanMessage = cleanMessage.replace(ref.reference, '').trim()
  }

  // 如果清理后没有内容，使用默认问题
  if (!cleanMessage) {
    cleanMessage = '请分析这些文件的内容'
  }

  return {
    message: cleanMessage,
    context
  }
}

/**
 * 处理图片引用，将图片转换为 base64 格式
 * @param {string} input - 用户输入
 * @param {Array} imageRefs - 图片引用列表
 * @returns {Object} - 处理结果
 *   - message: 处理后的消息（移除图片引用标记）
 *   - images: 图片数据数组 [{fileName, base64, mimeType}]
 */
export function processImageReferences(input, imageRefs) {
  if (!imageRefs || imageRefs.length === 0) {
    return {
      message: input,
      images: []
    }
  }

  // 读取所有图片并转换为 base64
  const images = []
  for (const ref of imageRefs) {
    try {
      const imageBuffer = fs.readFileSync(ref.fullPath)
      const base64 = imageBuffer.toString('base64')

      // 根据文件扩展名确定 MIME 类型
      const ext = path.extname(ref.fileName).toLowerCase()
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp'
      }
      const mimeType = mimeTypes[ext] || 'image/png'

      images.push({
        fileName: ref.fileName,
        base64,
        mimeType
      })
    } catch (error) {
      console.error(`读取图片失败: ${ref.fileName}`, error.message)
    }
  }

  // 移除输入中的 # 引用标记，保留问题部分
  let cleanMessage = input
  for (const ref of imageRefs) {
    cleanMessage = cleanMessage.replace(ref.reference, '').trim()
  }

  // 如果清理后没有内容，使用默认问题
  if (!cleanMessage) {
    cleanMessage = '请分析这张图片'
  }

  return {
    message: cleanMessage,
    images
  }
}

/**
 * 获取项目文件列表
 * @param {string} dir - 目录路径
 * @param {string} basePath - 基础路径（用于相对路径）
 * @returns {Array} - 文件列表 [{name, path}]
 */
export function getProjectFileList(dir = null, basePath = '') {
  const targetDir = dir || getCurrentWorkDir()
  const files = []

  try {
    const items = fs.readdirSync(targetDir)

    for (const item of items) {
      // 跳过隐藏文件和 node_modules
      if (item.startsWith('.') || item === 'node_modules') {
        continue
      }

      const fullPath = path.join(targetDir, item)
      const relativePath = path.join(basePath, item)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        // 递归读取子目录
        files.push(...getProjectFileList(fullPath, relativePath))
      } else {
        files.push({
          name: relativePath,
          description: getFileDescription(item),
          path: fullPath
        })
      }
    }
  } catch (error) {
    console.error(`读取目录失败: ${error.message}`)
  }

  return files
}

/**
 * 获取文件描述（根据扩展名）
 * @param {string} fileName - 文件名
 * @returns {string} - 文件描述
 */
function getFileDescription(fileName) {
  const ext = path.extname(fileName).toLowerCase()
  const descriptions = {
    '.js': 'JavaScript',
    '.mjs': 'JavaScript Module',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.ts': 'TypeScript',
    '.jsx': 'React JSX',
    '.tsx': 'React TSX',
    '.css': 'CSS',
    '.html': 'HTML',
    '.txt': 'Text',
    '.yml': 'YAML',
    '.yaml': 'YAML',
    '.env': 'Environment'
  }
  return descriptions[ext] || 'File'
}

/**
 * 检查输入是否需要触发选择器
 * @param {string} input - 当前输入
 * @returns {Object} - 触发信息
 *   - shouldTrigger: 是否需要触发
 *   - type: 触发类型（'command' 或 'file'）
 *   - triggerChar: 触发字符
 */
export function checkTrigger(input) {
  const trimmed = input.trim()

  // 检查 / 触发（指令选择）
  // 条件：以 / 开头，且不是已经完整的指令（如 /help）
  if (trimmed === '/' || (trimmed.startsWith('/') && !trimmed.includes(' ') && trimmed.length < 10)) {
    return {
      shouldTrigger: true,
      type: 'command',
      triggerChar: '/'
    }
  }

  // 检查 @ 触发（文件选择）
  // 条件：以 @ 开头，且后面没有完整的文件路径
  if (trimmed === '@' || (trimmed.startsWith('@') && !trimmed.includes(' ') && trimmed.length < 50)) {
    return {
      shouldTrigger: true,
      type: 'file',
      triggerChar: '@'
    }
  }

  return {
    shouldTrigger: false,
    type: null,
    triggerChar: null
  }
}

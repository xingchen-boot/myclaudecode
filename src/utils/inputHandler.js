/**
 * 输入处理器 - 支持 / 指令、@ 文件选择和 # 图片选择
 * 输入 /、@ 或 # 时立即显示选择列表
 * 支持输入法、光标移动、Tab/Enter 确认、Ctrl+V 粘贴图片
 */
import readline from 'readline'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { getCommandList } from '../commands/index.js'
import { getProjectFileList } from './commandParser.js'
import { getCurrentWorkDir } from './pathUtils.js'
import { saveClipboardImage } from './clipboardUtils.js'

/**
 * 输入处理器类
 */
export class InputHandler {
  constructor() {
    // 是否正在显示选择器
    this.isShowingSelector = false
    // 输入缓冲区
    this.inputBuffer = ''
    // 光标位置
    this.cursorPosition = 0
    // 输入完成回调
    this.resolveInput = null
    // 转义序列缓冲区
    this.escBuffer = ''
    // 转义序列计时器
    this.escTimer = null
  }

  /**
   * 获取用户输入
   * @returns {Promise<string>} - 用户输入的文本
   */
  getInput() {
    return new Promise((resolve) => {
      this.resolveInput = resolve
      this.inputBuffer = ''
      this.cursorPosition = 0
      this.isShowingSelector = false
      this.escBuffer = ''

      // 清除当前行并显示提示符
      this.clearLine()
      process.stdout.write(chalk.green('问：'))

      // 启用原始模式以监听键盘事件
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true)
      }
      process.stdin.resume()
      process.stdin.setEncoding('utf8')

      // 监听键盘事件
      this.handleKeyPress = this.handleKeyPress.bind(this)
      process.stdin.on('data', this.handleKeyPress)
    })
  }

  /**
   * 处理键盘输入
   * @param {string} data - 按键数据
   */
  async handleKeyPress(data) {
    // 如果正在显示选择器，不处理
    if (this.isShowingSelector) {
      return
    }

    const key = data.toString()
    const keyCode = key.charCodeAt(0)

    // 处理箭头键（转义序列）
    // 左箭头: \x1B[D 或分段发送
    if (key === '\x1B[D' || (this.escBuffer === '\x1B[' && key === 'D')) {
      this.escBuffer = ''
      this.moveCursorLeft()
      return
    }
    if (key === '\x1B[C' || (this.escBuffer === '\x1B[' && key === 'C')) {
      this.escBuffer = ''
      this.moveCursorRight()
      return
    }
    if (key === '\x1B[A' || (this.escBuffer === '\x1B[' && key === 'A')) {
      this.escBuffer = ''
      return
    }
    if (key === '\x1B[B' || (this.escBuffer === '\x1B[' && key === 'B')) {
      this.escBuffer = ''
      return
    }

    // 处理转义序列的开始
    if (key === '\x1B') {
      this.escBuffer = '\x1B'
      return
    }
    if (this.escBuffer === '\x1B' && key === '[') {
      this.escBuffer = '\x1B['
      return
    }

    // 如果有未完成的转义序列，清空
    if (this.escBuffer.length > 0) {
      this.escBuffer = ''
    }

    // 处理特殊按键
    switch (key) {
      case '\r': // Enter
      case '\n':
        this.finishInput()
        return

      case '': // Ctrl+C
        this.cleanup()
        process.exit(0)
        return

      case '': // Backspace
      case '\b':
        this.handleBackspace()
        return

      case '\x16': // Ctrl+V - 粘贴图片
        await this.handlePasteImage()
        return

      case '\x01': // Ctrl+A - 光标移到开头
        this.cursorPosition = 0
        this.refreshDisplay()
        return

      case '\x05': // Ctrl+E - 光标移到末尾
        this.cursorPosition = this.inputBuffer.length
        this.refreshDisplay()
        return

      case '\x0B': // Ctrl+K - 删除光标后的内容
        this.inputBuffer = this.inputBuffer.slice(0, this.cursorPosition)
        this.refreshDisplay()
        return

      case '\x15': // Ctrl+U - 删除光标前的内容
        this.inputBuffer = this.inputBuffer.slice(this.cursorPosition)
        this.cursorPosition = 0
        this.refreshDisplay()
        return

      default:
        // 处理普通字符（支持输入法一次性输入多个字符）
        if (key.length >= 1 && key >= ' ') {
          await this.handleCharInput(key)
        }
    }
  }

  /**
   * 处理字符输入
   * @param {string} char - 输入的字符（可能是多个字符，如输入法一次性输入）
   */
  async handleCharInput(char) {
    // 在光标位置插入字符
    this.inputBuffer =
      this.inputBuffer.slice(0, this.cursorPosition) +
      char +
      this.inputBuffer.slice(this.cursorPosition)
    // 光标位置增加输入字符的长度（支持输入法一次性输入多个字符）
    this.cursorPosition += char.length

    // 刷新显示
    this.refreshDisplay()

    // 检查是否需要触发选择器（只检查最后一个字符）
    await this.checkAndTriggerSelector(char[char.length - 1])
  }

  /**
   * 处理退格键
   */
  handleBackspace() {
    if (this.cursorPosition > 0) {
      this.inputBuffer =
        this.inputBuffer.slice(0, this.cursorPosition - 1) +
        this.inputBuffer.slice(this.cursorPosition)
      this.cursorPosition--
      this.refreshDisplay()
    }
  }

  /**
   * 光标左移
   */
  moveCursorLeft() {
    if (this.cursorPosition > 0) {
      this.cursorPosition--
      this.refreshDisplay()
    }
  }

  /**
   * 光标右移
   */
  moveCursorRight() {
    if (this.cursorPosition < this.inputBuffer.length) {
      this.cursorPosition++
      this.refreshDisplay()
    }
  }

  /**
   * 处理 Ctrl+V 粘贴图片
   */
  async handlePasteImage() {
    try {
      // 显示正在处理的提示
      this.clearLine()
      process.stdout.write(chalk.yellow('正在从剪贴板获取图片...'))

      // 调用剪贴板工具保存图片
      const imagePath = await saveClipboardImage()

      // 清除提示
      this.clearLine()

      if (imagePath) {
        // 获取图片文件名
        const fileName = path.basename(imagePath)
        // 将图片路径插入到输入框
        this.inputBuffer =
          this.inputBuffer.slice(0, this.cursorPosition) +
          `#${fileName} ` +
          this.inputBuffer.slice(this.cursorPosition)
        this.cursorPosition += fileName.length + 2 // # + 文件名 + 空格
        this.refreshDisplay()
        process.stdout.write(chalk.green(`✓ 已粘贴图片: ${fileName}`))
      } else {
        this.refreshDisplay()
        process.stdout.write(chalk.red('剪贴板中没有图片'))
      }
    } catch (error) {
      this.clearLine()
      this.refreshDisplay()
      process.stdout.write(chalk.red(`粘贴图片失败: ${error.message}`))
    }
  }

  /**
   * 计算字符串的显示宽度（中文字符占2个宽度，ASCII字符占1个宽度）
   * @param {string} str - 字符串
   * @returns {number} - 显示宽度
   */
  getStringWidth(str) {
    let width = 0
    for (const char of str) {
      const code = char.charCodeAt(0)
      // 中文字符、全角字符等占用2个宽度
      if (code > 0x7F) {
        width += 2
      } else {
        width += 1
      }
    }
    return width
  }

  /**
   * 刷新显示
   */
  refreshDisplay() {
    // 清除当前行
    this.clearLine()

    // 显示提示符和输入内容
    const beforeCursor = this.inputBuffer.slice(0, this.cursorPosition)
    const afterCursor = this.inputBuffer.slice(this.cursorPosition)

    process.stdout.write(chalk.green('问：') + beforeCursor)

    // 如果光标不在末尾，移动光标
    if (afterCursor) {
      process.stdout.write(afterCursor)
      // 使用显示宽度计算光标移动距离
      const afterWidth = this.getStringWidth(afterCursor)
      readline.moveCursor(process.stdout, -afterWidth, 0)
    }
  }

  /**
   * 清除当前行
   */
  clearLine() {
    readline.cursorTo(process.stdout, 0)
    readline.clearLine(process.stdout, 0)
  }

  /**
   * 检查并触发选择器
   * @param {string} char - 刚输入的字符
   */
  async checkAndTriggerSelector(char) {
    // 检查是否输入了 /、@ 或 #
    if (char === '/' && this.shouldTriggerCommandSelector()) {
      await this.triggerCommandSelector()
    } else if (char === '@' && this.shouldTriggerFileSelector()) {
      await this.triggerFileSelector()
    } else if (char === '#' && this.shouldTriggerImageSelector()) {
      await this.triggerImageSelector()
    }
  }

  /**
   * 判断是否应该触发指令选择器
   * @returns {boolean}
   */
  shouldTriggerCommandSelector() {
    // 条件：/ 是第一个字符，或者前面是空格
    const beforeSlash = this.inputBuffer.slice(0, this.cursorPosition - 1)
    return beforeSlash === '' || beforeSlash.endsWith(' ')
  }

  /**
   * 判断是否应该触发文件选择器
   * @returns {boolean}
   */
  shouldTriggerFileSelector() {
    // 条件：@ 是第一个字符，或者前面是空格
    const beforeAt = this.inputBuffer.slice(0, this.cursorPosition - 1)
    return beforeAt === '' || beforeAt.endsWith(' ')
  }

  /**
   * 判断是否应该触发图片选择器
   * @returns {boolean}
   */
  shouldTriggerImageSelector() {
    // 条件：# 是第一个字符，或者前面是空格
    const beforeHash = this.inputBuffer.slice(0, this.cursorPosition - 1)
    return beforeHash === '' || beforeHash.endsWith(' ')
  }

  /**
   * 获取图片文件列表
   * @returns {Array} - 图片文件列表 [{name, description, path}]
   */
  getImageFileList() {
    const designDir = path.join(getCurrentWorkDir(), '.front', 'design')
    const images = []

    // 如果 design 目录不存在，创建它
    if (!fs.existsSync(designDir)) {
      fs.mkdirSync(designDir, { recursive: true })
      return images
    }

    // 支持的图片格式
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']

    try {
      const files = fs.readdirSync(designDir)
      for (const file of files) {
        const ext = path.extname(file).toLowerCase()
        if (imageExtensions.includes(ext)) {
          const fullPath = path.join(designDir, file)
          const stat = fs.statSync(fullPath)
          const sizeKB = Math.round(stat.size / 1024)
          images.push({
            name: file,
            description: `${ext.toUpperCase().slice(1)} - ${sizeKB}KB`,
            path: fullPath
          })
        }
      }
    } catch (error) {
      console.error(`读取图片目录失败: ${error.message}`)
    }

    return images
  }

  /**
   * 触发指令选择器
   */
  async triggerCommandSelector() {
    this.isShowingSelector = true

    // 移除刚输入的 /
    this.inputBuffer =
      this.inputBuffer.slice(0, this.cursorPosition - 1) +
      this.inputBuffer.slice(this.cursorPosition)
    this.cursorPosition--

    // 暂时移除键盘监听
    process.stdin.removeListener('data', this.handleKeyPress)

    // 清除当前行
    this.clearLine()

    // 显示指令选择器
    const commandList = getCommandList()
    const result = await this.showCommandSelector(commandList)

    // 恢复输入
    this.isShowingSelector = false

    if (result) {
      if (result.method === 'enter') {
        // Enter 键：直接执行指令
        this.cleanup()
        if (this.resolveInput) {
          this.resolveInput(result.name)
          this.resolveInput = null
        }
        return
      } else {
        // Tab 键：填入输入框
        this.inputBuffer = result.name + ' '
        this.cursorPosition = this.inputBuffer.length
      }
    }

    // 刷新显示
    this.refreshDisplay()

    // 重新启用原始模式并监听键盘事件
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true)
    }
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', this.handleKeyPress)
  }

  /**
   * 触发文件选择器
   */
  async triggerFileSelector() {
    this.isShowingSelector = true

    // 移除刚输入的 @
    this.inputBuffer =
      this.inputBuffer.slice(0, this.cursorPosition - 1) +
      this.inputBuffer.slice(this.cursorPosition)
    this.cursorPosition--

    // 暂时移除键盘监听
    process.stdin.removeListener('data', this.handleKeyPress)

    // 清除当前行
    this.clearLine()

    // 显示文件选择器
    const fileList = getProjectFileList()
    const items = fileList.map(file => ({
      name: file.name,
      description: file.description || ''
    }))
    const result = await this.showFileSelector(items)

    // 恢复输入
    this.isShowingSelector = false

    if (result) {
      // 文件：无论 Tab 还是 Enter，都填入输入框
      this.inputBuffer = `@${result.name} `
      this.cursorPosition = this.inputBuffer.length
    }

    // 刷新显示
    this.refreshDisplay()

    // 重新启用原始模式并监听键盘事件
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true)
    }
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', this.handleKeyPress)
  }

  /**
   * 触发图片选择器
   */
  async triggerImageSelector() {
    this.isShowingSelector = true

    // 移除刚输入的 #
    this.inputBuffer =
      this.inputBuffer.slice(0, this.cursorPosition - 1) +
      this.inputBuffer.slice(this.cursorPosition)
    this.cursorPosition--

    // 暂时移除键盘监听
    process.stdin.removeListener('data', this.handleKeyPress)

    // 清除当前行
    this.clearLine()

    // 显示图片选择器
    const imageList = this.getImageFileList()
    const result = await this.showImageSelector(imageList)

    // 恢复输入
    this.isShowingSelector = false

    if (result) {
      // 图片：无论 Tab 还是 Enter，都填入输入框（与 @ 行为一致）
      this.inputBuffer = `#${result.name} `
      this.cursorPosition = this.inputBuffer.length
    }

    // 刷新显示
    this.refreshDisplay()

    // 重新启用原始模式并监听键盘事件
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true)
    }
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', this.handleKeyPress)
  }

  /**
   * 完成输入
   */
  finishInput() {
    const input = this.inputBuffer.trim()
    this.cleanup()

    if (this.resolveInput) {
      this.resolveInput(input)
      this.resolveInput = null
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    process.stdin.removeListener('data', this.handleKeyPress)
    if (this.escTimer) {
      clearTimeout(this.escTimer)
    }
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false)
    }
    process.stdin.pause()
  }

  /**
   * 显示指令选择器
   * @param {Array} commandList - 指令列表
   * @returns {Promise<Object|null>} - 选中的指令 {name, method} 或 null
   */
  async showCommandSelector(commandList) {
    return this.showSelector('可用指令', commandList, 'command')
  }

  /**
   * 显示文件选择器
   * @param {Array} fileList - 文件列表
   * @returns {Promise<Object|null>} - 选中的文件 {name, method} 或 null
   */
  async showFileSelector(fileList) {
    return this.showSelector('项目文件', fileList, 'file')
  }

  /**
   * 显示图片选择器
   * @param {Array} imageList - 图片列表
   * @returns {Promise<Object|null>} - 选中的图片 {name, method} 或 null
   */
  async showImageSelector(imageList) {
    return this.showSelector('设计图片', imageList, 'image')
  }

  /**
   * 显示选择列表
   * @param {string} title - 列表标题
   * @param {Array} items - 列表项 [{name, description}]
   * @param {string} type - 选择器类型 ('command' 或 'file')
   * @returns {Promise<Object|null>} - 选中的项 {name, method} 或 null
   */
  showSelector(title, items, type) {
    return new Promise((resolve) => {
      // 当前选中索引
      let selectedIndex = 0
      // 筛选文本
      let filterText = ''
      // 筛选后的列表
      let filteredItems = [...items]
      // 列表起始索引
      let startIndex = 0
      // 最大显示项数
      const maxVisible = 10

      // 渲染列表
      const render = () => {
        // 清除之前的输出（使用上次实际渲染的行数）
        if (render.hasRendered) {
          const linesToClear = render.lastLineCount || 0
          if (linesToClear > 0) {
            // 光标回到上次渲染区域的起始行
            readline.moveCursor(process.stdout, 0, -linesToClear)
            for (let i = 0; i < linesToClear; i++) {
              readline.clearLine(process.stdout, 0)
              if (i < linesToClear - 1) {
                readline.moveCursor(process.stdout, 0, 1)
              }
            }
            // 光标回到起始行，准备重新渲染
            readline.moveCursor(process.stdout, 0, -linesToClear + 1)
          }
        }

        // 记录本次渲染的行数（用于下次清除）
        let lineCount = 0

        // 绘制顶部边框
        console.log(chalk.blue('┌' + '─'.repeat(50) + '┐'))
        lineCount++

        // 绘制标题
        const titlePadding = Math.max(0, 50 - title.length - 2)
        console.log(chalk.blue('│') + chalk.cyan.bold(` ${title} `) + ' '.repeat(titlePadding) + chalk.blue('│'))
        lineCount++

        // 绘制分隔线
        console.log(chalk.blue('├' + '─'.repeat(50) + '┤'))
        lineCount++

        // 计算显示范围
        const visibleItems = filteredItems.slice(startIndex, startIndex + maxVisible)

        // 绘制列表项
        for (let i = 0; i < maxVisible; i++) {
          const itemIndex = startIndex + i
          const item = filteredItems[itemIndex]

          if (item) {
            const isSelected = itemIndex === selectedIndex
            const prefix = isSelected ? chalk.green('>') : ' '
            const name = isSelected ? chalk.white.bold(item.name) : chalk.gray(item.name)
            const desc = item.description ? chalk.dim(` - ${item.description}`) : ''

            // 计算填充空格
            const content = `${prefix} ${name}${desc}`
            const visibleLength = content.replace(/\x1B\[[0-9;]*m/g, '').length
            const padding = Math.max(0, 50 - visibleLength - 1)

            console.log(chalk.blue('│') + content + ' '.repeat(padding) + chalk.blue('│'))
          } else {
            // 空行
            console.log(chalk.blue('│') + ' '.repeat(50) + chalk.blue('│'))
          }
          lineCount++
        }

        // 绘制底部边框
        console.log(chalk.blue('└' + '─'.repeat(50) + '┘'))
        lineCount++

        // 显示筛选提示
        if (filterText) {
          console.log(chalk.yellow(`筛选: ${filterText}`))
          lineCount++
        }

        // 显示操作提示
        console.log(chalk.dim('↑/↓ 选择 | Tab/Enter 确认 | Esc 取消 | 输入筛选'))
        lineCount++

        render.hasRendered = true
        render.lastLineCount = lineCount
      }

      // 筛选列表
      const filterItems = () => {
        if (!filterText) {
          filteredItems = [...items]
        } else {
          filteredItems = items.filter(item =>
            item.name.toLowerCase().includes(filterText.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(filterText.toLowerCase()))
          )
        }
        selectedIndex = 0
        startIndex = 0
      }

      // 处理键盘输入
      const handleKeyPress = (data) => {
        const key = data.toString()

        // 上箭头
        if (key === '[A') {
          if (selectedIndex > 0) {
            selectedIndex--
            if (selectedIndex < startIndex) {
              startIndex = selectedIndex
            }
            render()
          }
          return
        }

        // 下箭头
        if (key === '[B') {
          if (selectedIndex < filteredItems.length - 1) {
            selectedIndex++
            if (selectedIndex >= startIndex + maxVisible) {
              startIndex = selectedIndex - maxVisible + 1
            }
            render()
          }
          return
        }

        // Tab - 填充到输入框
        if (key === '\t') {
          cleanup()
          if (filteredItems.length > 0) {
            resolve({ name: filteredItems[selectedIndex].name, method: 'tab' })
          } else {
            resolve(null)
          }
          return
        }

        // Enter - 根据类型决定行为
        if (key === '\r' || key === '\n') {
          cleanup()
          if (filteredItems.length > 0) {
            if (type === 'command') {
              // 指令：Enter 直接执行
              resolve({ name: filteredItems[selectedIndex].name, method: 'enter' })
            } else {
              // 文件：Enter 填充到输入框
              resolve({ name: filteredItems[selectedIndex].name, method: 'tab' })
            }
          } else {
            resolve(null)
          }
          return
        }

        // Esc - 取消
        if (key === '') {
          cleanup()
          resolve(null)
          return
        }

        // Backspace - 删除筛选字符
        if (key === '' || key === '\b') {
          if (filterText.length > 0) {
            filterText = filterText.slice(0, -1)
            filterItems()
            render()
          }
          return
        }

        // 普通字符 - 添加到筛选文本
        if (key.length === 1 && key >= ' ') {
          filterText += key
          filterItems()
          render()
        }
      }

      // 清理
      const cleanup = () => {
        process.stdin.removeListener('data', handleKeyPress)
      }

      // 监听键盘事件
      process.stdin.on('data', handleKeyPress)

      // 初始渲染
      render()
    })
  }
}

/**
 * 创建输入处理器实例
 * @returns {InputHandler}
 */
export function createInputHandler() {
  return new InputHandler()
}

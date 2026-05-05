/**
 * 输入处理器 - 实现实时键盘监听和选择器触发
 * 支持按下 / 或 @ 立即显示选择列表
 */
import readline from 'readline'
import chalk from 'chalk'
import { showCommandSelector, showFileSelector } from './selector.js'
import { getCommandList } from '../commands/index.js'
import { getProjectFileList } from './commandParser.js'

/**
 * 输入处理器类
 */
export class InputHandler {
  constructor() {
    // 当前输入缓冲区
    this.inputBuffer = ''
    // 光标位置
    this.cursorPosition = 0
    // 是否正在显示选择器
    this.isShowingSelector = false
    // 输入完成回调
    this.resolveInput = null
    // 选择器类型
    this.selectorType = null
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

      // 检查是否支持原始模式（TTY 环境）
      if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
        // 原始模式：实时监听键盘事件
        this.useRawMode = true

        // 清除当前行并显示提示符
        this.clearLine()
        process.stdout.write(chalk.green('问：'))

        // 启用原始模式以监听键盘事件
        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.setEncoding('utf8')

        // 监听键盘事件
        this.handleKeyPress = this.handleKeyPress.bind(this)
        process.stdin.on('data', this.handleKeyPress)
      } else {
        // 非 TTY 环境：回退到 readline 方式
        this.useRawMode = false
        this.getInputWithReadline(resolve)
      }
    })
  }

  /**
   * 使用 readline 方式获取输入（非 TTY 环境）
   * @param {Function} resolve - Promise resolve 函数
   */
  getInputWithReadline(resolve) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    rl.question('问：', (input) => {
      rl.close()
      resolve(input.trim())
    })
  }

  /**
   * 处理键盘输入
   * @param {string} data - 按键数据
   */
  async handleKeyPress(data) {
    const key = data.toString()

    // 如果正在显示选择器，不处理输入
    if (this.isShowingSelector) {
      return
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

      case '': // Backspace
      case '\b':
        this.handleBackspace()
        return

      case '': // Esc
        // 清空输入
        this.inputBuffer = ''
        this.cursorPosition = 0
        this.refreshDisplay()
        return

      default:
        // 处理普通字符
        if (key.length === 1 && key >= ' ') {
          await this.handleCharInput(key)
        }
    }
  }

  /**
   * 处理字符输入
   * @param {string} char - 输入的字符
   */
  async handleCharInput(char) {
    // 在光标位置插入字符
    this.inputBuffer =
      this.inputBuffer.slice(0, this.cursorPosition) +
      char +
      this.inputBuffer.slice(this.cursorPosition)
    this.cursorPosition++

    // 刷新显示
    this.refreshDisplay()

    // 检查是否需要触发选择器
    await this.checkAndTriggerSelector(char)
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
      readline.moveCursor(process.stdout, -afterCursor.length, 0)
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
    // 检查是否输入了 / 或 @
    if (char === '/' && this.shouldTriggerCommandSelector()) {
      await this.triggerCommandSelector()
    } else if (char === '@' && this.shouldTriggerFileSelector()) {
      await this.triggerFileSelector()
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
   * 触发指令选择器
   */
  async triggerCommandSelector() {
    this.isShowingSelector = true
    this.selectorType = 'command'

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
    const result = await showCommandSelector(commandList)

    // 恢复输入
    this.isShowingSelector = false
    this.selectorType = null

    if (result) {
      if (result.method === 'enter') {
        // Enter 键：直接执行指令
        this.cleanup()
        if (this.resolveInput) {
          this.resolveInput(result.item.name)
          this.resolveInput = null
        }
        return
      } else {
        // Tab 键：填入输入框，让用户继续编辑
        this.inputBuffer = result.item.name + ' '
        this.cursorPosition = this.inputBuffer.length
      }
    }

    // 刷新显示并继续监听
    this.refreshDisplay()
    process.stdin.on('data', this.handleKeyPress)
  }

  /**
   * 触发文件选择器
   */
  async triggerFileSelector() {
    this.isShowingSelector = true
    this.selectorType = 'file'

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
    const result = await showFileSelector(fileList)

    // 恢复输入
    this.isShowingSelector = false
    this.selectorType = null

    if (result) {
      if (result.method === 'enter') {
        // Enter 键：直接执行（发送文件内容给 AI）
        this.cleanup()
        if (this.resolveInput) {
          this.resolveInput(`@${result.item.name}`)
          this.resolveInput = null
        }
        return
      } else {
        // Tab 键：填入输入框，让用户继续编辑
        this.inputBuffer = `@${result.item.name} `
        this.cursorPosition = this.inputBuffer.length
      }
    }

    // 刷新显示并继续监听
    this.refreshDisplay()
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
    if (this.useRawMode) {
      process.stdin.removeListener('data', this.handleKeyPress)
      if (typeof process.stdin.setRawMode === 'function') {
        process.stdin.setRawMode(false)
      }
      process.stdin.pause()
    }
  }
}

/**
 * 创建输入处理器实例
 * @returns {InputHandler}
 */
export function createInputHandler() {
  return new InputHandler()
}

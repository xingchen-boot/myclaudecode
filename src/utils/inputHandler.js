/**
 * 输入处理器 - 支持 / 指令和 @ 文件选择
 * 输入 / 或 @ 时立即显示选择列表
 * 支持输入法、光标选择、Tab/Enter 确认
 */
import readline from 'readline'
import chalk from 'chalk'
import { getCommandList } from '../commands/index.js'
import { getProjectFileList } from './commandParser.js'

/**
 * 输入处理器类
 */
export class InputHandler {
  constructor() {
    // readline 接口实例
    this.rl = null
    // 是否正在显示选择器
    this.isShowingSelector = false
    // 当前输入缓冲区
    this.inputBuffer = ''
  }

  /**
   * 获取用户输入
   * @returns {Promise<string>} - 用户输入的文本
   */
  getInput() {
    return new Promise((resolve) => {
      this.resolveInput = resolve
      this.inputBuffer = ''
      this.isShowingSelector = false

      // 创建 readline 接口
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer: (line) => this.completer(line)
      })

      // 监听行输入
      this.rl.on('line', async (line) => {
        const trimmedLine = line.trim()

        // 检查是否需要触发选择器
        if (trimmedLine === '/' || trimmedLine === '@') {
          // 暂停 readline
          this.rl.pause()

          if (trimmedLine === '/') {
            // 显示指令选择器
            const selected = await this.showCommandSelector()
            if (selected) {
              // 用户选择了指令，填入输入框
              this.rl.resume()
              this.rl.write(selected + ' ')
              // 继续等待用户输入
              return
            }
          } else if (trimmedLine === '@') {
            // 显示文件选择器
            const selected = await this.showFileSelector()
            if (selected) {
              // 用户选择了文件，填入输入框
              this.rl.resume()
              this.rl.write(`@${selected} `)
              // 继续等待用户输入
              return
            }
          }

          // 用户取消了选择，恢复 readline
          this.rl.resume()
          this.rl.prompt()
          return
        }

        // 普通输入，直接返回
        this.rl.close()
        resolve(trimmedLine)
      })

      // 监听关闭事件
      this.rl.on('close', () => {
        if (this.resolveInput) {
          this.resolveInput('exit')
          this.resolveInput = null
        }
      })

      // 显示提示符
      this.rl.prompt()
    })
  }

  /**
   * 补全函数 - 处理 / 指令和 @ 文件
   * @param {string} line - 当前输入的文本
   * @returns {Array} - [completions, originalText]
   */
  completer(line) {
    const trimmedLine = line.trim()

    // 处理 / 指令补全
    if (trimmedLine.startsWith('/')) {
      return this.completeCommand(trimmedLine)
    }

    // 处理 @ 文件补全
    if (trimmedLine.startsWith('@')) {
      return this.completeFile(trimmedLine)
    }

    // 普通输入，不补全
    return [[], line]
  }

  /**
   * 指令补全
   * @param {string} line - 当前输入
   * @returns {Array} - [completions, originalText]
   */
  completeCommand(line) {
    const commandList = getCommandList()
    const hits = []
    const completions = []

    // 获取所有指令名称
    for (const cmd of commandList) {
      completions.push(cmd.name)
    }

    // 筛选匹配的指令
    for (const cmd of completions) {
      if (cmd.startsWith(line)) {
        hits.push(cmd)
      }
    }

    // 如果没有匹配项，显示所有指令
    if (hits.length === 0) {
      return [completions, line]
    }

    return [hits, line]
  }

  /**
   * 文件补全
   * @param {string} line - 当前输入
   * @returns {Array} - [completions, originalText]
   */
  completeFile(line) {
    const fileList = getProjectFileList()
    const hits = []
    const completions = []

    // 获取所有文件名（添加 @ 前缀）
    for (const file of fileList) {
      completions.push(`@${file.name}`)
    }

    // 筛选匹配的文件
    for (const file of completions) {
      if (file.startsWith(line)) {
        hits.push(file)
      }
    }

    // 如果没有匹配项，显示所有文件
    if (hits.length === 0) {
      return [completions, line]
    }

    return [hits, line]
  }

  /**
   * 显示指令选择器
   * @returns {Promise<string|null>} - 选中的指令或 null
   */
  async showCommandSelector() {
    const commandList = getCommandList()
    return this.showSelector('可用指令', commandList)
  }

  /**
   * 显示文件选择器
   * @returns {Promise<string|null>} - 选中的文件或 null
   */
  async showFileSelector() {
    const fileList = getProjectFileList()
    // 转换格式
    const items = fileList.map(file => ({
      name: file.name,
      description: file.description || ''
    }))
    return this.showSelector('项目文件', items)
  }

  /**
   * 显示选择列表
   * @param {string} title - 列表标题
   * @param {Array} items - 列表项 [{name, description}]
   * @returns {Promise<string|null>} - 选中的名称或 null
   */
  showSelector(title, items) {
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
        // 计算需要清除的行数
        const linesToClear = maxVisible + 4

        // 清除之前的输出
        if (render.hasRendered) {
          readline.moveCursor(process.stdout, 0, -linesToClear)
          for (let i = 0; i < linesToClear; i++) {
            readline.clearLine(process.stdout, 0)
            if (i < linesToClear - 1) {
              readline.moveCursor(process.stdout, 0, 1)
            }
          }
          readline.moveCursor(process.stdout, 0, -linesToClear + 1)
        }

        // 绘制顶部边框
        console.log(chalk.blue('┌' + '─'.repeat(50) + '┐'))

        // 绘制标题
        const titlePadding = Math.max(0, 50 - title.length - 2)
        console.log(chalk.blue('│') + chalk.cyan.bold(` ${title} `) + ' '.repeat(titlePadding) + chalk.blue('│'))

        // 绘制分隔线
        console.log(chalk.blue('├' + '─'.repeat(50) + '┤'))

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
        }

        // 绘制底部边框
        console.log(chalk.blue('└' + '─'.repeat(50) + '┘'))

        // 显示筛选提示
        if (filterText) {
          console.log(chalk.yellow(`筛选: ${filterText}`))
        }

        // 显示操作提示
        console.log(chalk.dim('↑/↓ 选择 | Tab/Enter 确认 | Esc 取消 | 输入筛选'))

        render.hasRendered = true
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

        // Tab 或 Enter - 确认选择
        if (key === '\t' || key === '\r' || key === '\n') {
          cleanup()
          if (filteredItems.length > 0) {
            resolve(filteredItems[selectedIndex].name)
          } else {
            resolve(null)
          }
          return
        }

        // Esc - 取消
        if (key === '') {
          cleanup()
          resolve(null)
          return
        }

        // Backspace - 删除筛选字符
        if (key === '' || key === '\b') {
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
        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(false)
        }
      }

      // 启用原始模式
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true)
      }
      process.stdin.resume()
      process.stdin.setEncoding('utf8')

      // 监听键盘事件
      process.stdin.on('data', handleKeyPress)

      // 初始渲染
      render()
    })
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.rl) {
      this.rl.close()
      this.rl = null
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

/**
 * 选择器组件 - 用于显示指令列表和文件列表
 * 支持键盘上下选择、Tab 确认、实时筛选
 */
import chalk from 'chalk'
import readline from 'readline'

// 最大显示列表项数
const MAX_VISIBLE_ITEMS = 10

/**
 * 显示选择列表并处理用户交互
 * @param {Object} options - 配置选项
 * @param {string} options.title - 列表标题
 * @param {Array} options.items - 列表项数组 [{name, description}]
 * @returns {Promise<Object|null>} - 返回选中项或 null（取消）
 */
export async function showSelector({ title, items }) {
  return new Promise((resolve) => {
    // 当前选中索引
    let selectedIndex = 0
    // 当前筛选文本
    let filterText = ''
    // 筛选后的列表
    let filteredItems = [...items]
    // 列表起始索引（用于滚动）
    let startIndex = 0

    // 清除当前行
    function clearLines(count) {
      for (let i = 0; i < count; i++) {
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
        if (i < count - 1) {
          readline.moveCursor(process.stdout, 0, -1)
        }
      }
    }

    // 渲染列表 UI
    function render() {
      // 计算需要清除的行数（标题 + 列表项 + 边框）
      const linesToClear = MAX_VISIBLE_ITEMS + 3

      // 如果不是第一次渲染，清除之前的输出
      if (render.hasRendered) {
        readline.moveCursor(process.stdout, 0, -(linesToClear))
        clearLines(linesToClear)
      }

      // 绘制顶部边框
      console.log(chalk.blue('┌' + '─'.repeat(50) + '┐'))

      // 绘制标题
      const titlePadding = Math.max(0, 50 - title.length - 2)
      console.log(chalk.blue('│') + chalk.cyan.bold(` ${title} `) + ' '.repeat(titlePadding) + chalk.blue('│'))

      // 绘制分隔线
      console.log(chalk.blue('├' + '─'.repeat(50) + '┤'))

      // 计算显示范围
      const visibleItems = filteredItems.slice(startIndex, startIndex + MAX_VISIBLE_ITEMS)

      // 绘制列表项
      for (let i = 0; i < MAX_VISIBLE_ITEMS; i++) {
        const itemIndex = startIndex + i
        const item = filteredItems[itemIndex]

        if (item) {
          const isSelected = itemIndex === selectedIndex
          const prefix = isSelected ? chalk.green('>') : ' '
          const name = isSelected ? chalk.white.bold(item.name) : chalk.gray(item.name)
          const desc = item.description ? chalk.dim(` - ${item.description}`) : ''

          // 计算填充空格
          const content = `${prefix} ${name}${desc}`
          const visibleLength = getVisibleLength(content)
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
      console.log(chalk.dim('↑/↓ 选择 | Tab 确认 | Esc 取消 | 输入筛选'))

      render.hasRendered = true
    }

    // 获取文本可见长度（去除 ANSI 转义码）
    function getVisibleLength(text) {
      return text.replace(/\x1B\[[0-9;]*m/g, '').length
    }

    // 筛选列表
    function filterItems() {
      if (!filterText) {
        filteredItems = [...items]
      } else {
        filteredItems = items.filter(item =>
          item.name.toLowerCase().includes(filterText.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(filterText.toLowerCase()))
        )
      }
      // 重置选中索引
      selectedIndex = 0
      startIndex = 0
    }

    // 处理键盘输入
    function handleKeyPress(data) {
      const key = data.toString()

      // 上箭头
      if (key === '[A') {
        if (selectedIndex > 0) {
          selectedIndex--
          // 调整显示范围
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
          // 调整显示范围
          if (selectedIndex >= startIndex + MAX_VISIBLE_ITEMS) {
            startIndex = selectedIndex - MAX_VISIBLE_ITEMS + 1
          }
          render()
        }
        return
      }

      // Tab 键 - 确认选择（用于填充输入框）
      if (key === '\t') {
        cleanup()
        if (filteredItems.length > 0) {
          resolve({ item: filteredItems[selectedIndex], method: 'tab' })
        } else {
          resolve(null)
        }
        return
      }

      // Enter 键 - 确认选择（用于直接执行）
      if (key === '\r' || key === '\n') {
        cleanup()
        if (filteredItems.length > 0) {
          resolve({ item: filteredItems[selectedIndex], method: 'enter' })
        } else {
          resolve(null)
        }
        return
      }

      // Esc 键 - 取消
      if (key === '') {
        cleanup()
        resolve(null)
        return
      }

      // Backspace 键 - 删除筛选字符
      if (key === '' || key === '\b') {
        if (filterText.length > 0) {
          filterText = filterText.slice(0, -1)
          filterItems()
          render()
        }
        return
      }

      // 普通字符输入 - 添加到筛选文本
      if (key.length === 1 && key >= ' ') {
        filterText += key
        filterItems()
        render()
      }
    }

    // 清理事件监听
    function cleanup() {
      process.stdin.removeListener('data', handleKeyPress)
      // 恢复正常模式
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false)
      }
      process.stdin.pause()
    }

    // 启用原始模式以监听键盘事件
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
 * 显示指令选择器
 * @param {Array} commands - 指令数组 [{name, description}]
 * @returns {Promise<Object|null>} - 返回选中的指令或 null
 */
export async function showCommandSelector(commands) {
  return showSelector({
    title: '可用指令',
    items: commands
  })
}

/**
 * 显示文件选择器
 * @param {Array} files - 文件数组 [{name, description}]
 * @returns {Promise<Object|null>} - 返回选中的文件或 null
 */
export async function showFileSelector(files) {
  return showSelector({
    title: '项目文件',
    items: files
  })
}

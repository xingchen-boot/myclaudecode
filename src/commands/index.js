/**
 * 指令定义模块 - 定义所有可用指令及其处理函数
 * 指令类型：
 *   - blocking（阻断类）：执行后不给大模型发送请求，直接返回
 *   - non-blocking（非阻断类）：执行后返回字符串，和用户输入一起发送给大模型
 * 自定义指令：
 *   - 从用户目录 ~/.front/commands/ 和项目目录 .front/commands/ 加载
 *   - 每个子文件夹是一个指令，文件夹内的md文件是指令内容
 *   - 例如：.front/commands/comms/a/c.md → 指令 /a:c
 */
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { getUserHomeDir, getCurrentWorkDir } from '../utils/pathUtils.js'

/**
 * 指令列表
 * 每个指令包含：name（名称）、description（描述）、handler（处理函数）、type（类型）
 * type: 'blocking' 表示阻断类，'non-blocking' 表示非阻断类
 */
export const commands = {
  '/help': {
    name: '/help',
    description: '显示帮助信息',
    handler: showHelp,
    type: 'blocking'
  },
  '/clear': {
    name: '/clear',
    description: '清空对话历史',
    handler: clearHistory,
    type: 'blocking'
  },
  '/history': {
    name: '/history',
    description: '查看对话历史',
    handler: showHistory,
    type: 'blocking'
  },
  '/exit': {
    name: '/exit',
    description: '退出程序',
    handler: exitProgram,
    type: 'blocking'
  },
  '/quit': {
    name: '/quit',
    description: '退出程序',
    handler: exitProgram,
    type: 'blocking'
  },
  '/model': {
    name: '/model',
    description: '查看当前模型',
    handler: showModel,
    type: 'blocking'
  },
  '/config': {
    name: '/config',
    description: '查看配置信息',
    handler: showConfig,
    type: 'blocking'
  }
}

/**
 * 加载自定义指令
 * 从用户目录 ~/.front/commands/ 和项目目录 .front/commands/ 加载
 * 每个子文件夹是一个指令，文件夹内的md文件是指令内容
 */
export function loadCustomCommands() {
  const userHome = getUserHomeDir()
  const currentDir = getCurrentWorkDir()

  // 自定义指令目录列表（项目目录优先级高于用户目录）
  const commandDirs = [
    path.join(currentDir, '.front', 'commands'),
    path.join(userHome, '.front', 'commands')
  ]

  const addedCommands = new Set()

  for (const commandsDir of commandDirs) {
    if (!fs.existsSync(commandsDir)) {
      continue
    }

    try {
      // 读取commands目录下的所有子文件夹
      const items = fs.readdirSync(commandsDir, { withFileTypes: true })

      for (const item of items) {
        if (!item.isDirectory()) {
          continue
        }

        // 子文件夹名称作为指令分组
        const groupName = item.name
        const groupPath = path.join(commandsDir, groupName)

        // 递归扫描文件夹内的md文件
        const mdFiles = findMarkdownFiles(groupPath)

        for (const mdFile of mdFiles) {
          // 计算相对路径，用于生成指令名称
          const relativePath = path.relative(groupPath, mdFile)
          // 去掉.md扩展名，将路径分隔符替换为冒号
          const commandName = relativePath.replace(/\.md$/i, '').replace(/[\\\/]/g, ':')
          // 生成指令名称：/groupName:commandName
          const fullCommandName = `/${groupName}:${commandName}`

          // 避免重复添加
          if (addedCommands.has(fullCommandName)) {
            continue
          }

          // 创建自定义指令
          commands[fullCommandName] = {
            name: fullCommandName,
            description: `自定义指令 - ${groupName}:${commandName}`,
            handler: createCustomCommandHandler(mdFile),
            type: 'non-blocking'
          }

          addedCommands.add(fullCommandName)
        }
      }
    } catch (error) {
      console.error(chalk.yellow(`加载自定义指令目录失败: ${commandsDir}`))
      console.error(chalk.dim(error.message))
    }
  }
}

/**
 * 递归查找目录下的所有markdown文件
 * @param {string} dir - 目录路径
 * @returns {Array<string>} - markdown文件路径列表
 */
function findMarkdownFiles(dir) {
  const results = []

  try {
    const items = fs.readdirSync(dir, { withFileTypes: true })

    for (const item of items) {
      const fullPath = path.join(dir, item.name)

      if (item.isDirectory()) {
        // 递归扫描子目录
        results.push(...findMarkdownFiles(fullPath))
      } else if (item.isFile() && /\.md$/i.test(item.name)) {
        // 添加md文件
        results.push(fullPath)
      }
    }
  } catch (error) {
    console.error(chalk.dim(`扫描目录失败: ${dir}`))
  }

  return results
}

/**
 * 创建自定义指令处理函数
 * @param {string} mdFilePath - markdown文件路径
 * @returns {Function} - 指令处理函数
 */
function createCustomCommandHandler(mdFilePath) {
  return function (args) {
    try {
      // 读取md文件内容
      const content = fs.readFileSync(mdFilePath, 'utf-8')
      return content
    } catch (error) {
      console.error(chalk.red(`读取自定义指令文件失败: ${mdFilePath}`))
      console.error(chalk.dim(error.message))
      return `错误：无法读取指令文件 ${mdFilePath}`
    }
  }
}

/**
 * 获取指令列表（用于选择器显示）
 * @returns {Array} - 指令数组 [{name, description}]
 */
export function getCommandList() {
  const commandList = []
  const addedCommands = new Set()

  for (const [key, cmd] of Object.entries(commands)) {
    // 避免重复显示 /exit 和 /quit
    if (key === '/quit' && addedCommands.has('/exit')) {
      continue
    }
    commandList.push({
      name: cmd.name,
      description: cmd.description
    })
    addedCommands.add(key)
  }

  return commandList
}

/**
 * 获取所有指令列表（别名，供 input 模块使用）
 * @returns {Array} - 指令数组 [{name, description}]
 */
export function getAllCommands() {
  return getCommandList()
}

/**
 * 根据关键词筛选指令
 * @param {string} query - 筛选关键词
 * @returns {Array} - 匹配的指令数组 [{name, description}]
 */
export function filterCommands(query) {
  const all = getCommandList()
  if (!query) return all
  const lowerQuery = query.toLowerCase()
  return all.filter(cmd =>
    cmd.name.toLowerCase().includes(lowerQuery) ||
    cmd.description.toLowerCase().includes(lowerQuery)
  )
}

/**
 * 判断输入是否为指令
 * @param {string} input - 用户输入
 * @returns {boolean}
 */
export function isCommand(input) {
  return input.trim().startsWith('/')
}

/**
 * 从输入中移除指令部分，返回剩余内容
 * @param {string} input - 用户输入
 * @returns {string} - 移除指令后的文本
 */
export function removeCommandFromInput(input) {
  const trimmed = input.trim()
  // 匹配 /xxx 开头的指令，移除指令部分
  const match = trimmed.match(/^\/[^\s]+/)
  if (match) {
    return trimmed.slice(match[0].length).trim()
  }
  return trimmed
}

/**
 * 执行指令
 * @param {string} command - 指令名称（如 "/help"）
 * @param {string} args - 指令参数
 * @param {Object} context - 执行上下文
 * @param {Array} context.messages - 对话历史
 * @param {Function} context.clearMessages - 清空对话历史的函数
 * @returns {Promise<Object>} - 执行结果
 *   - shouldContinue: 是否继续对话（false 表示退出程序）
 *   - type: 指令类型（'blocking' 或 'non-blocking'）
 *   - result: 指令执行结果（非阻断类指令返回的字符串）
 */
export async function executeCommand(command, args, context = {}) {
  const cmd = commands[command]

  if (!cmd) {
    console.log(chalk.red(`未知指令: ${command}`))
    console.log(chalk.yellow('输入 /help 查看可用指令'))
    return { shouldContinue: true, type: 'blocking', result: null }
  }

  try {
    const result = await cmd.handler(args, context)
    return {
      shouldContinue: result !== false,
      type: cmd.type || 'blocking',
      result: cmd.type === 'non-blocking' ? result : null
    }
  } catch (error) {
    console.log(chalk.red(`执行指令失败: ${error.message}`))
    return { shouldContinue: true, type: 'blocking', result: null }
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log('')
  console.log(chalk.cyan.bold('可用指令：'))
  console.log(chalk.cyan('─'.repeat(40)))

  const helpItems = [
    { cmd: '/help', desc: '显示此帮助信息' },
    { cmd: '/clear', desc: '清空当前对话历史' },
    { cmd: '/history', desc: '查看当前会话的对话历史' },
    { cmd: '/exit 或 /quit', desc: '退出程序' },
    { cmd: '/model', desc: '查看当前使用的模型' },
    { cmd: '/config', desc: '查看配置信息' }
  ]

  for (const item of helpItems) {
    console.log(chalk.green(`  ${item.cmd.padEnd(18)}`) + chalk.white(item.desc))
  }

  console.log(chalk.cyan('─'.repeat(40)))
  console.log(chalk.dim('提示：输入 / 后可选择指令，输入 @ 后可引用文件'))
  console.log('')

  return true
}

/**
 * 清空对话历史
 * @param {string} args - 参数
 * @param {Object} context - 上下文
 * @returns {boolean} - 是否继续对话
 */
function clearHistory(args, context) {
  if (context.clearMessages) {
    context.clearMessages()
    console.log(chalk.green('✓ 对话历史已清空'))
  } else {
    console.log(chalk.yellow('无法清空对话历史'))
  }
  return true
}

/**
 * 显示对话历史
 * @param {string} args - 参数
 * @param {Object} context - 上下文
 * @returns {boolean} - 是否继续对话
 */
function showHistory(args, context) {
  const messages = context.messages || []

  if (messages.length === 0) {
    console.log(chalk.yellow('暂无对话历史'))
    return true
  }

  console.log('')
  console.log(chalk.cyan.bold('对话历史：'))
  console.log(chalk.cyan('─'.repeat(40)))

  for (const msg of messages) {
    const role = msg.role === 'user' ? chalk.green('问：') : chalk.blue('AI：')
    const content = msg.content.length > 100
      ? msg.content.substring(0, 100) + '...'
      : msg.content
    console.log(role + ' ' + content)
  }

  console.log(chalk.cyan('─'.repeat(40)))
  console.log(chalk.dim(`共 ${messages.length} 条消息`))
  console.log('')

  return true
}

/**
 * 退出程序
 * @returns {boolean} - 是否继续对话（false 表示退出）
 */
function exitProgram() {
  console.log('')
  console.log(chalk.yellow('再见！感谢使用 AI 终端助手。👋'))
  console.log('')
  return false
}

/**
 * 显示当前模型
 * @returns {boolean} - 是否继续对话
 */
function showModel() {
  try {
    const userHome = getUserHomeDir()
    const currentDir = getCurrentWorkDir()

    // 读取配置文件
    const configPaths = [
      path.join(currentDir, '.front', 'settings.json'),
      path.join(userHome, '.front', 'settings.json')
    ]

    let config = null
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        break
      }
    }

    if (config && config.model) {
      console.log('')
      console.log(chalk.cyan('当前模型：') + chalk.green(config.model))
      console.log('')
    } else {
      console.log(chalk.yellow('无法读取模型配置'))
    }
  } catch (error) {
    console.log(chalk.red(`读取配置失败: ${error.message}`))
  }

  return true
}

/**
 * 显示配置信息
 * @returns {boolean} - 是否继续对话
 */
function showConfig() {
  try {
    const userHome = getUserHomeDir()
    const currentDir = getCurrentWorkDir()

    // 读取配置文件
    const configPaths = [
      path.join(currentDir, '.front', 'settings.json'),
      path.join(userHome, '.front', 'settings.json')
    ]

    let config = null
    let configPath = null
    for (const cp of configPaths) {
      if (fs.existsSync(cp)) {
        config = JSON.parse(fs.readFileSync(cp, 'utf-8'))
        configPath = cp
        break
      }
    }

    if (config) {
      console.log('')
      console.log(chalk.cyan.bold('配置信息：'))
      console.log(chalk.cyan('─'.repeat(40)))
      console.log(chalk.green('配置文件：') + chalk.white(configPath))
      console.log(chalk.green('模型：    ') + chalk.white(config.model || '未设置'))
      console.log(chalk.green('API 地址：') + chalk.white(config.baseURL || '未设置'))
      console.log(chalk.green('API Key：') + chalk.white(config.apiKey ? '****' + config.apiKey.slice(-4) : '未设置'))
      console.log(chalk.cyan('─'.repeat(40)))
      console.log('')
    } else {
      console.log(chalk.yellow('未找到配置文件'))
    }
  } catch (error) {
    console.log(chalk.red(`读取配置失败: ${error.message}`))
  }

  return true
}

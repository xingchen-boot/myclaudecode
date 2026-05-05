/**
 * 指令定义模块 - 定义所有可用指令及其处理函数
 */
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { getUserHomeDir, getCurrentWorkDir } from '../utils/pathUtils.js'

/**
 * 指令列表
 * 每个指令包含：name（名称）、description（描述）、handler（处理函数）
 */
export const commands = {
  '/help': {
    name: '/help',
    description: '显示帮助信息',
    handler: showHelp
  },
  '/clear': {
    name: '/clear',
    description: '清空对话历史',
    handler: clearHistory
  },
  '/history': {
    name: '/history',
    description: '查看对话历史',
    handler: showHistory
  },
  '/exit': {
    name: '/exit',
    description: '退出程序',
    handler: exitProgram
  },
  '/quit': {
    name: '/quit',
    description: '退出程序',
    handler: exitProgram
  },
  '/model': {
    name: '/model',
    description: '查看当前模型',
    handler: showModel
  },
  '/config': {
    name: '/config',
    description: '查看配置信息',
    handler: showConfig
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
 * 执行指令
 * @param {string} command - 指令名称
 * @param {string} args - 指令参数
 * @param {Object} context - 执行上下文
 * @param {Array} context.messages - 对话历史
 * @param {Function} context.clearMessages - 清空对话历史的函数
 * @returns {Promise<boolean>} - 是否继续对话
 */
export async function executeCommand(command, args, context = {}) {
  const cmd = commands[command]

  if (!cmd) {
    console.log(chalk.red(`未知指令: ${command}`))
    console.log(chalk.yellow('输入 /help 查看可用指令'))
    return true
  }

  try {
    return await cmd.handler(args, context)
  } catch (error) {
    console.log(chalk.red(`执行指令失败: ${error.message}`))
    return true
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

/**
 * 输入处理器 - 使用 readline completer 实现指令和文件选择
 * 支持输入法，兼容各种终端环境
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
  }

  /**
   * 获取用户输入
   * @returns {Promise<string>} - 用户输入的文本
   */
  getInput() {
    return new Promise((resolve) => {
      // 创建 readline 接口，配置 completer
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer: (line) => this.completer(line)
      })

      // 监听关闭事件
      this.rl.on('close', () => {
        resolve('exit')
      })

      // 提示用户输入
      this.rl.question('问：', (answer) => {
        this.rl.close()
        resolve(answer.trim())
      })
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
      // 显示所有可用指令
      console.log('')
      console.log(chalk.cyan.bold('可用指令：'))
      for (const cmd of commandList) {
        console.log(chalk.green(`  ${cmd.name.padEnd(18)}`) + chalk.white(cmd.description))
      }
      console.log('')
      return [[], line]
    }

    // 显示匹配的指令描述
    if (hits.length === 1) {
      // 只有一个匹配项，显示描述
      const matchedCmd = commandList.find(cmd => cmd.name === hits[0])
      if (matchedCmd) {
        console.log('')
        console.log(chalk.dim(`  ${matchedCmd.description}`))
      }
    } else {
      // 多个匹配项，显示列表
      console.log('')
      console.log(chalk.cyan.bold('匹配的指令：'))
      for (const hit of hits) {
        const matchedCmd = commandList.find(cmd => cmd.name === hit)
        if (matchedCmd) {
          console.log(chalk.green(`  ${hit.padEnd(18)}`) + chalk.white(matchedCmd.description))
        }
      }
      console.log('')
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
      // 显示所有可用文件
      console.log('')
      console.log(chalk.cyan.bold('项目文件：'))
      for (const file of fileList) {
        console.log(chalk.green(`  @${file.name.padEnd(30)}`) + chalk.dim(file.description || ''))
      }
      console.log('')
      return [[], line]
    }

    // 显示匹配的文件信息
    if (hits.length === 1) {
      // 只有一个匹配项，显示信息
      const matchedFile = fileList.find(file => `@${file.name}` === hits[0])
      if (matchedFile) {
        console.log('')
        console.log(chalk.dim(`  ${matchedFile.description || ''}`))
      }
    } else {
      // 多个匹配项，显示列表
      console.log('')
      console.log(chalk.cyan.bold('匹配的文件：'))
      for (const hit of hits) {
        const fileName = hit.substring(1) // 移除 @ 前缀
        const matchedFile = fileList.find(file => file.name === fileName)
        if (matchedFile) {
          console.log(chalk.green(`  ${hit.padEnd(30)}`) + chalk.dim(matchedFile.description || ''))
        }
      }
      console.log('')
    }

    return [hits, line]
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

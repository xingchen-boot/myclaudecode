/**
 * 整个项目的启动入口
 * 支持指令选择（/）和文件引用（@）
 */
import ora from 'ora'
import chalk from 'chalk'
import { createOpenAIClient, getAIResponse } from "./request/index.js"
import logger from "./utils/logger.js"
import { welcomeLog } from "./utils/init.js"
import { writeHistoryToFrontFile } from "./utils/fsHandle.js"
import { createInputHandler } from "./utils/inputHandler.js"
import { parseInput, processFileReferences } from "./utils/commandParser.js"
import { executeCommand } from "./commands/index.js"

// 创建 OpenAI 客户端实例
const openai = createOpenAIClient()

// 创建输入处理器
const inputHandler = createInputHandler()

// 对话历史记录
const messages = []

/**
 * 清空对话历史
 */
function clearMessages() {
  messages.length = 0
}

/**
 * 处理用户输入
 */
async function promptUser() {
  try {
    // 使用输入处理器获取用户输入（支持实时选择器）
    const input = await inputHandler.getInput()

    // 检查退出命令
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      logger.log('', 'white')
      logger.log('再见！感谢使用 AI 终端助手。👋', 'yellow')
      logger.log('', 'white')
      process.exit(0)
    }

    // 处理空输入
    if (!input) {
      promptUser()
      return
    }

    // 解析输入
    const parsed = parseInput(input)

    // 如果是指令，执行指令
    if (parsed.isCommand) {
      const shouldContinue = await executeCommand(parsed.command, parsed.args, {
        messages,
        clearMessages
      })

      // 如果指令返回 false，退出程序
      if (!shouldContinue) {
        process.exit(0)
      }

      // 继续下一轮对话
      promptUser()
      return
    }

    // 处理文件引用
    let processedInput = parsed.cleanInput
    let contextMessage = null

    if (parsed.hasFileRefs) {
      const result = processFileReferences(parsed.cleanInput, parsed.fileRefs)
      processedInput = result.message
      contextMessage = result.context
    }

    // 构建发送给 AI 的消息
    let userMessage = processedInput
    if (contextMessage) {
      userMessage = `${processedInput}\n\n参考文件内容：\n${contextMessage}`
    }

    // 添加到对话历史
    messages.push({ role: 'user', content: userMessage })

    // 显示加载提示
    const spinner = ora('AI 正在思考...').start()

    // 获取 AI 回复
    const aiResponse = await getAIResponse({
      openai,
      messages
    })

    // 添加 AI 回复到历史
    messages.push(aiResponse)

    // 停止加载提示并显示回复
    spinner.stop()
    logger.log('AI: ', "green")
    logger.logMarkdown(aiResponse.content)

    // 每轮对话结束后保存历史记录
    writeHistoryToFrontFile(messages)

    // 继续等待下一轮对话
    promptUser()
  } catch (error) {
    logger.log(`错误: ${error.message}`, 'red')
    promptUser()
  }
}

// 显示欢迎信息
welcomeLog()

// 显示使用提示
console.log(chalk.dim('提示：输入 / 后按 Tab 查看指令列表，输入 @ 后按 Tab 查看文件列表'))
console.log('')

// 启动对话
promptUser()

// 处理程序退出
process.on('exit', () => {
  inputHandler.cleanup()
  writeHistoryToFrontFile(messages)
})

process.on('SIGINT', () => {
  console.log('\n')
  logger.log('再见！感谢使用 AI 终端助手。👋', 'yellow')
  inputHandler.cleanup()
  process.exit(0)
})

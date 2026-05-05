/**
 * 整个项目的启动入口
 * 支持指令选择（/）和文件引用（@）
 */
import readline from 'readline'
import ora from 'ora'
import { createOpenAIClient, getAIResponse } from "./request/index.js"
import logger from "./utils/logger.js"
import { welcomeLog } from "./utils/init.js"
import { writeHistoryToFrontFile } from "./utils/fsHandle.js"
import { showCommandSelector, showFileSelector } from "./utils/selector.js"
import { parseInput, processFileReferences, getProjectFileList, checkTrigger } from "./utils/commandParser.js"
import { getCommandList, executeCommand } from "./commands/index.js"

// 创建 OpenAI 客户端实例
const openai = createOpenAIClient()

// 对话历史记录
const messages = []

/**
 * 清空对话历史
 */
function clearMessages() {
  messages.length = 0
}

/**
 * 获取用户输入（支持选择器）
 * @returns {Promise<string>} - 用户输入
 */
async function getUserInput() {
  return new Promise((resolve) => {
    // 创建临时的 readline 接口
    const tempRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    // 监听输入
    tempRl.question('问：', async (input) => {
      const trimmedInput = input.trim()

      // 检查是否需要触发选择器
      const trigger = checkTrigger(trimmedInput)

      if (trigger.shouldTrigger) {
        // 关闭临时 readline
        tempRl.close()

        let selectedItem = null

        if (trigger.type === 'command') {
          // 显示指令选择器
          const commandList = getCommandList()
          selectedItem = await showCommandSelector(commandList)
        } else if (trigger.type === 'file') {
          // 显示文件选择器
          const fileList = getProjectFileList()
          selectedItem = await showFileSelector(fileList)
        }

        if (selectedItem) {
          // 用户选择了项目，构建完整输入
          let fullInput = ''
          if (trigger.type === 'command') {
            // 指令：直接使用选中的指令
            fullInput = selectedItem.name
          } else if (trigger.type === 'file') {
            // 文件：使用 @ 文件路径格式
            fullInput = `@${selectedItem.name}`
          }

          // 询问用户是否继续输入（可选）
          console.log(`\n已选择: ${fullInput}`)

          // 再次获取用户输入（让用户可以继续编辑）
          const finalRl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          })

          finalRl.question('问：' + fullInput + ' ', async (additionalInput) => {
            finalRl.close()

            // 如果用户有额外输入，拼接起来
            if (additionalInput.trim()) {
              resolve(`${fullInput} ${additionalInput.trim()}`)
            } else {
              resolve(fullInput)
            }
          })
        } else {
          // 用户取消了选择，重新获取输入
          resolve(await getUserInput())
        }
      } else {
        // 没有触发选择器，直接返回输入
        tempRl.close()
        resolve(trimmedInput)
      }
    })
  })
}

/**
 * 处理用户输入
 */
async function promptUser() {
  try {
    // 获取用户输入（支持选择器）
    const input = await getUserInput()

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

// 启动对话
promptUser()

// 处理程序退出
process.on('exit', () => {
  writeHistoryToFrontFile(messages)
})

process.on('SIGINT', () => {
  console.log('\n')
  logger.log('再见！感谢使用 AI 终端助手。👋', 'yellow')
  process.exit(0)
})

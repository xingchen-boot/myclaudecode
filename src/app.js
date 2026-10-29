#!/usr/bin/env node
/**
 * 整个项目的启动入口
 * 支持指令选择（/）、文件引用（@）和图片选择（#）
 * 支持 Ctrl+V 粘贴剪贴板图片
 */
import ora from 'ora'
import chalk from 'chalk'
import { createOpenAIClient, getAIResponse } from "./request/index.js"
import logger from "./utils/logger.js"
import { welcomeLog } from "./utils/init.js"
import { writeHistoryToFrontFile } from "./utils/fsHandle.js"
import { createInputHandler } from "./utils/inputHandler.js"
import { parseInput, processFileReferences, processImageReferences } from "./utils/commandParser.js"
import { executeCommand, loadCustomCommands } from "./commands/index.js"
import { readSystem, readRules, matchRules, getSkillHeaders, buildTurnContext } from './utils/contextRead.js'
import toolResult from "./tools/index.js"
import { searchLocalVector } from "./utils/ragHandle.js"
import { markUntrustedData } from "./utils/untrustedText.js"
import { loadLatestSession, resetActiveSessionFile } from "./utils/sessionStore.js"
import { clearDangerApproval } from "./tools/local/dangerApproval.js"
import { resetWorkflowForTurn } from "./tools/local/workflowState.js"

/**
 * 检索片段按资料包起来。没有结果时返回空字符串
 * @param {string[]} snippets
 * @returns {string}
 */
function ragContentFromSnippets(snippets) {
  if (!Array.isArray(snippets) || snippets.length === 0) {
    return ''
  }
  return markUntrustedData('检索到的资料', snippets.join('\n'))
}

// 创建 OpenAI 客户端实例
const openai = createOpenAIClient()
const rulesMap = readRules()

// 加载自定义指令
loadCustomCommands()

// 创建输入处理器
const inputHandler = createInputHandler()

// 系统提示和 skill 摘要在启动时读取。用户要求和记忆每次提问前再读
const systemMessage = { role: 'system', content: readSystem() }
const skillMessage = { role: 'user', content: getSkillHeaders() }

// 对话历史记录
const messages = []

/**
 * 清空对话历史
 */
function clearMessages() {
  messages.length = 0
  resetActiveSessionFile()
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

    // 新的一条用户消息，上一轮的危险操作确认作废
    clearDangerApproval()

    // 解析输入
    const parsed = parseInput(input)
    resetWorkflowForTurn(input, Boolean(parsed.hasImageRefs))

    // 如果是指令，执行指令
    if (parsed.isCommand) {
      const commandResult = await executeCommand(parsed.command, parsed.args, {
        messages,
        clearMessages
      })

      // 如果指令返回 false，退出程序
      if (!commandResult.shouldContinue) {
        process.exit(0)
      }

      // 如果是阻断类指令，直接继续下一轮对话
      if (commandResult.type === 'blocking') {
        promptUser()
        return
      }

      // 如果是非阻断类指令，将指令结果和用户输入一起发送给大模型
      if (commandResult.type === 'non-blocking' && commandResult.result) {
        const inputWithCommandResult = `${parsed.args || ''}\n\n指令执行结果：\n${commandResult.result}`
        messages.push({ role: 'user', content: inputWithCommandResult })

        console.log('')
        const spinner = ora('AI 正在思考...').start()

        const ragResults = await searchLocalVector(parsed.args || '')
        const contextList = buildTurnContext({
          systemContent: systemMessage.content,
          skillContent: skillMessage.content,
          ragContent: ragContentFromSnippets(ragResults)
        })

        const nowMessage = await getAIResponse({
          openai,
          toolResult,
          contextMessageList: contextList,
          messages: messages,
          spinner
        })

        spinner.stop()
        logger.log('AI: ', "green")

        const lastAssistantMessage = [...nowMessage].reverse().find(msg => msg.role === 'assistant')
        if (lastAssistantMessage) {
          logger.logMarkdown(lastAssistantMessage.content)
        }

        writeHistoryToFrontFile(messages)
      }

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

      // 获取文件路径列表，匹配规则
      const filePaths = parsed.fileRefs.map(ref => ref.fullPath)
      const matchedRulesContent = matchRules(filePaths, rulesMap)
      if (matchedRulesContent) {
        processedInput = `${processedInput}\n\n--- 匹配到的规则 ---\n${matchedRulesContent}`
      }
    }

    // 处理图片引用
    let imageContents = []
    if (parsed.hasImageRefs) {
      const imageResult = processImageReferences(processedInput, parsed.imageRefs)
      processedInput = imageResult.message
      imageContents = imageResult.images
    }

    // 构建发送给 AI 的消息
    if (imageContents.length > 0) {
      // 包含图片时使用多模态消息格式
      const content = []

      // 添加文本内容
      let textContent = processedInput
      if (contextMessage) {
        textContent = `${processedInput}\n\n参考文件内容：\n${contextMessage}`
      }
      content.push({ type: 'text', text: textContent })

      // 添加图片内容，并附带图片文件路径信息
      for (const image of imageContents) {
        content.push({ type: 'text', text: `设计图路径: ${image.fullPath}` })
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${image.mimeType};base64,${image.base64}`
          }
        })
      }

      messages.push({ role: 'user', content })
    } else {
      // 没有图片时使用普通文本格式
      let userMessage = processedInput
      if (contextMessage) {
        userMessage = `${processedInput}\n\n参考文件内容：\n${contextMessage}`
      }
      messages.push({ role: 'user', content: userMessage })
    }

    console.log('')
    // 如果包含图片，提示使用视觉模型
    const spinnerText = imageContents.length > 0
      ? 'AI 正在思考... (使用视觉模型)'
      : 'AI 正在思考...'
    const spinner = ora(spinnerText).start()

    const ragTexts = await searchLocalVector(processedInput)
    const contextList = buildTurnContext({
      systemContent: systemMessage.content,
      skillContent: skillMessage.content,
      ragContent: ragContentFromSnippets(ragTexts)
    })

    const nowMessage = await getAIResponse({
      openai,
      toolResult,
      contextMessageList: contextList,
      messages: messages,
      spinner
    })

    spinner.stop()
    logger.log('AI: ', "green")

    const lastAssistantMessage = [...nowMessage].reverse().find(msg => msg.role === 'assistant')
    if (lastAssistantMessage) {
      logger.logMarkdown(lastAssistantMessage.content)
    }

    writeHistoryToFrontFile(messages)

    promptUser()
  } catch (error) {
    logger.log(`错误: ${error.message}`, 'red')
    promptUser()
  }
}

async function startFrontCode() {
  welcomeLog()

  console.log(chalk.dim('提示：输入 / 后按 Tab 查看指令列表，输入 @ 后按 Tab 查看文件列表'))
  console.log(chalk.dim('      输入 # 后按 Tab 查看图片列表，复制图片后自动检测并插入'))

  const mcpFailures = await toolResult.mcpReady
  if (Array.isArray(mcpFailures) && mcpFailures.length > 0) {
    for (const failure of mcpFailures) {
      console.log(chalk.yellow(`MCP 未连接：${failure.name}（${failure.message}）`))
    }
  }

  const restoredMessages = loadLatestSession()
  if (restoredMessages.length > 0) {
    messages.push(...restoredMessages)
    console.log(chalk.dim(`已恢复上次对话，共 ${restoredMessages.length} 条消息。/undo 回退，/redo 回到放弃的分支，/clear 清空。`))
  }
  console.log('')

  promptUser()
}

startFrontCode()

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

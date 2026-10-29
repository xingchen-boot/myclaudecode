import OpenAI from 'openai'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { getUserHomeDir, getCurrentWorkDir } from '../utils/pathUtils.js'
import { transformToOpenAi } from '../tools/util.js'
import { excuteTool } from '../tools/index.js'
import { getWorkflowSnapshot, getWorkflowToolNeeds } from '../tools/local/workflowState.js'
import { selectTurnTools, wantsChoice } from '../tools/selectTurnTools.js'
import { addUsage } from '../utils/usageCounter.js'
import { createChatCompletion } from './apiRetry.js'
import { buildModelMessages, compactMessages, planCompaction } from '../utils/sessionStore.js'

// 进程启动时所在的目录。评测会切到题目目录，不能因此改用别的配置
const launchDirectory = process.cwd()

// 读取配置文件
export function loadConfig() {
  const userHome = getUserHomeDir()
  const currentDir = getCurrentWorkDir()

  // 先用启动目录，再用当前目录，最后用用户目录
  const configPaths = [
    path.join(launchDirectory, '.front', 'settings.json'),
    path.join(currentDir, '.front', 'settings.json'),
    path.join(userHome, '.front', 'settings.json')
  ]
  const seenPaths = new Set()

  for (const configPath of configPaths) {
    if (seenPaths.has(configPath) || !fs.existsSync(configPath)) {
      continue
    }
    seenPaths.add(configPath)
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return config
  }

  throw new Error('未找到配置文件，请在用户目录或当前目录创建 .front/settings.json')
}

// 创建 OpenAI 客户端实例
export function createOpenAIClient() {
  const config = loadConfig()
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL
  })
}

// 检查消息中是否包含图片
function hasImageContent(messages) {
  for (const message of messages) {
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'image_url') {
          return true
        }
      }
    }
  }
  return false
}

// 同一工具连续失败达到这个次数后，停止自动重试
const MAX_TOOL_FAILURE_STREAK = 2

/**
 * 判断工具结果是不是失败
 * 空搜索结果不算失败，只有明确的错误文本或 isError 才算
 * @param {string} text
 * @param {boolean} isError
 * @returns {boolean}
 */
/**
 * 流程拦截要让模型改走当前步骤，不能算成工具故障
 * @param {string} text
 * @returns {boolean}
 */
function isWorkflowBlock(text) {
  return typeof text === 'string' && text.includes('已拦截')
}

function isToolFailure(text, isError) {
  if (isWorkflowBlock(text)) {
    return false
  }
  if (isError) {
    return true
  }
  if (typeof text !== 'string') {
    return false
  }
  const trimmed = text.trim()
  return trimmed.startsWith('错误')
    || trimmed.startsWith('Error:')
    || trimmed.startsWith('执行失败')
    || trimmed.startsWith('文件写入失败')
    || trimmed.startsWith('读取文件失败')
    || trimmed.startsWith('搜索出错')
}

/**
 * 把将被压缩的消息收成一段文字，避免摘要请求本身过大
 * @param {Array} droppedMessages
 * @returns {string}
 */
function transcriptText(droppedMessages) {
  return droppedMessages.map((message) => {
    const content = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content || '')
    return `${message.role}: ${content.slice(0, 1500)}`
  }).join('\n').slice(0, 30000)
}

/**
 * 对话太长时先写摘要。摘要失败就继续用原文
 * @param {object} openai
 * @param {string} model
 * @param {Array} messages
 */
async function compactLongConversation(openai, model, messages) {
  const plan = planCompaction(messages)
  if (!plan || !model) {
    return
  }
  try {
    const completion = await createChatCompletion(openai, {
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: '把对话压成一段中文摘要。保留用户目标、已修改的文件、关键决定和未完成事项。不要调用工具。'
        },
        { role: 'user', content: transcriptText(plan.droppedMessages) }
      ]
    })
    addUsage(completion.usage)
    const summary = completion.choices?.[0]?.message?.content
    if (typeof summary === 'string' && summary.trim()) {
      compactMessages(messages, summary, plan.firstKeptMessage)
    }
  } catch (error) {
    process.stdout.write(`[会话] 压缩失败，继续使用原文：${error.message}\n`)
  }
}

// 与 AI 对话的异步函数
export async function getAIResponse(questionObj) {
  const { openai, toolResult, contextMessageList, messages, spinner } = questionObj
  const config = loadConfig()

  try {
    // 将 contextMessageList 中的字符串统一包装为 system 消息对象
    const normalizedContext = (contextMessageList || []).map(item =>
      typeof item === 'string' ? { role: 'system', content: item } : item
    )

    await compactLongConversation(openai, config.model, messages)

    // 检查是否需要使用视觉模型。压缩后不再把更早的图片算进去
    const modelMessages = buildModelMessages(messages)
    const allMessages = [...normalizedContext, ...modelMessages]
    const useVision = hasImageContent(allMessages)
    const model = useVision ? (config.visionModel || config.model) : config.model

    // 连续失败两次后，这一轮不再提供工具，让模型直接向用户说明原因
    const requestBody = {
      model,
      messages: allMessages,
      temperature: 0.7
    }
    if (!questionObj.disableTools) {
      const toolNeeds = getWorkflowToolNeeds()
      const turnTools = selectTurnTools(toolResult.tools, {
        wantsPreview: toolNeeds.wantsPreview,
        hasDesign: toolNeeds.hasDesign,
        wantsChoice: wantsChoice(messages)
      })
      requestBody.tools = transformToOpenAi(turnTools)
    }

    // 限流、超时和 5xx 会重试。欠费、密钥无效不会重试
    const completion = await createChatCompletion(openai, requestBody)
    addUsage(completion.usage)

    let aiMessage = completion.choices[0].message
    //ai回复插入到messages中，保持对话历史记录的完整性
    messages.push(aiMessage)
    // 检查是否有工具调用
    if(aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      questionObj.toolRounds = (questionObj.toolRounds || 0) + 1
      const reachedToolRoundLimit = questionObj.maxToolRounds
        && questionObj.toolRounds > questionObj.maxToolRounds
      // 停止重试后模型若仍给出工具调用，只补齐协议要求的结果，不再执行
      if (questionObj.disableTools || reachedToolRoundLimit) {
        const stopReason = reachedToolRoundLimit
          ? '错误：已达到本轮工具调用次数上限，本次未执行。'
          : '错误：已停止自动重试，本次未执行。'
        for (const toolCall of aiMessage.tool_calls) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: stopReason
          })
        }
        messages.push({
          role: 'assistant',
          content: reachedToolRoundLimit
            ? '本轮工具调用次数已到上限，停止继续调用工具。'
            : '工具已连续失败，自动重试已停止。请根据上面的错误信息继续处理。'
        })
        return messages
      }

      // 工具调用前停掉spinner，避免清行冲突
      if (spinner) {
        // 使用 clear() 清除 spinner 输出，然后停止
        spinner.clear()
        spinner.stop()
        // 确保光标在新行
        process.stdout.write('\n')
      }

      if (!questionObj.failureState) {
        questionObj.failureState = { toolName: '', count: 0 }
      }
      const failureState = questionObj.failureState
      let shouldStopRetry = false

      //执行所有工具调用
      for(const toolCall of aiMessage.tool_calls) {
        const functionName = toolCall.function.name
        let functionArgs = {}
        let toolText = ''
        let isError = false

        // 已经决定停止时，剩余工具只回填结果，不再执行，也不计入失败次数
        if (shouldStopRetry) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `错误：已停止自动重试，未执行工具 ${functionName}`
          })
          process.stdout.write(chalk.dim(`[工具] ${functionName} 已跳过\n`))
          continue
        }

        try {
          functionArgs = JSON.parse(toolCall.function.arguments || '{}')
        } catch (error) {
          toolText = `错误：工具参数不是合法 JSON：${error.message}`
          isError = true
        }

        if (!isError) {
          // 输出工具调用信息（使用 process.stdout.write 避免额外换行）
          process.stdout.write(chalk.dim(`[工具] ${functionName} ...\n`))
          const executeResult = await excuteTool(functionName, functionArgs)
          toolText = executeResult.text
          isError = executeResult.isError
        }

        const workflowBlocked = isWorkflowBlock(toolText)
        const failed = isToolFailure(toolText, isError)
        if (workflowBlocked) {
          toolText += '\n\n这是流程拦截，不是工具故障。请改调用当前允许的工具，不要重复刚才被拒绝的调用。'
          process.stdout.write(chalk.yellow(`[工具] ${functionName} 被流程拦住\n`))
        } else if (failed) {
          if (failureState.toolName === functionName) {
            failureState.count += 1
          } else {
            failureState.toolName = functionName
            failureState.count = 1
          }

          // 第一次失败时要求模型反思后再试；第二次停止，避免同一错误死循环
          if (failureState.count >= MAX_TOOL_FAILURE_STREAK) {
            shouldStopRetry = true
            questionObj.disableTools = true
            toolText += '\n\n该工具已连续失败 2 次，停止自动重试。请向用户说明失败原因，不要再调用工具。'
            process.stdout.write(chalk.red(`[工具] ${functionName} 连续失败，已停止重试\n`))
          } else {
            const workflowStep = getWorkflowSnapshot().step
            const writeStepHint = workflowStep === 'write' || workflowStep === 'review'
              ? '当前仍是写入步骤。请根据错误里的原文再次调用 edit_file 或 write_file，不要调用 confirm。'
              : '请根据错误反思原因，更换参数或换一种做法后再试一次。不要用完全相同的参数重复调用。'
            toolText += `\n\n工具调用失败。${writeStepHint}`
            process.stdout.write(chalk.yellow(`[工具] ${functionName} 失败，将反思后重试\n`))
          }
        } else if (failureState.toolName === functionName) {
          failureState.toolName = ''
          failureState.count = 0
          process.stdout.write(chalk.green(`[工具] ${functionName} ✓\n`))
        } else {
          process.stdout.write(chalk.green(`[工具] ${functionName} ✓\n`))
        }

        //将工具响应到消息
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolText
        })
      }

      // 重新启动 spinner 显示"正在思考"
      if (spinner) {
        spinner.start('AI 正在思考...')
      }

      return await getAIResponse(questionObj)
    // 返回 AI 回复
    }
    //如果没有工具调用，直接返回整个消息
    return messages
  } catch (error) {
    console.error(`获取 AI 回复失败: ${error.message}`)
    throw error
  }
}

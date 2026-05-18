import OpenAI from 'openai'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { getUserHomeDir, getCurrentWorkDir } from '../utils/pathUtils.js'
import { transformToOpenAi } from '../tools/util.js'
import { excuteTool } from '../tools/index.js'

// 读取配置文件
function loadConfig() {
  const userHome = getUserHomeDir()
  const currentDir = getCurrentWorkDir()

  // 优先使用当前终端目录下的配置，其次使用用户目录下的配置
  const configPaths = [
    path.join(currentDir, '.front', 'settings.json'),
    path.join(userHome, '.front', 'settings.json')
  ]

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      return config
    }
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

// 与 AI 对话的异步函数
export async function getAIResponse(questionObj) {
  const { openai, toolResult, contextMessageList, messages, spinner } = questionObj
  const config = loadConfig()

  try {
    // 将 contextMessageList 中的字符串统一包装为 system 消息对象
    const normalizedContext = (contextMessageList || []).map(item =>
      typeof item === 'string' ? { role: 'system', content: item } : item
    )

    // 调用 OpenAI API
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [...normalizedContext, ...messages],
      temperature: 0.7,
      tools: transformToOpenAi(toolResult.tools)
    })

    let aiMessage = completion.choices[0].message
    //ai回复插入到messages中，保持对话历史记录的完整性
    messages.push(aiMessage)
    // 检查是否有工具调用
    if(aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {

      // 工具调用前停掉spinner，避免清行冲突
      if (spinner) spinner.stop()

      //执行所有工具调用
      for(const toolCall of aiMessage.tool_calls) {
        const functionName = toolCall.function.name
        const functionArgs = JSON.parse(toolCall.function.arguments)
        console.log(chalk.dim(`[工具] ${functionName} ...`))
        //自己调用太麻烦，直接用excuteTool
        const excuteResult = await excuteTool(functionName, functionArgs)
        //将工具响应到消息
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: excuteResult
        })
        console.log(chalk.green(`[工具] ${functionName} ✓`))
      }
      return await getAIResponse(questionObj)
    // 返回 AI 回复
    } 
    //如果没有工具调用，直接返回整个消息
    return messages
  } catch (error) {
    console.error('获取 AI 回复失败:', error)
    throw error
  }
}

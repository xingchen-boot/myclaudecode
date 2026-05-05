import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { getUserHomeDir, getCurrentWorkDir } from '../utils/pathUtils.js'

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
export async function getAIResponse({ openai, messages }) {
  const config = loadConfig()

  try {
    // 调用 OpenAI API
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages
    })

    // 返回 AI 回复
    return completion.choices[0].message
  } catch (error) {
    console.error('\x1b[31m请求出错:\x1b[0m', error.message)
    return { role: 'assistant', content: '抱歉，请求出错：' + error.message }
  }
}

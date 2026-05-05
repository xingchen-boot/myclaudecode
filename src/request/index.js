import OpenAI from 'openai'

// 创建 OpenAI 客户端实例
export function createClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL
  })
}

// 存储对话历史，用于保持上下文连贯性
const messages = []

// 与 AI 对话的异步函数
export async function chat(userMessage) {
  // 每次调用时创建客户端
  const client = createClient()
  // 将用户消息添加到对话历史
  messages.push({ role: 'user', content: userMessage })

  // 显示正在思考提示
  process.stdout.write('\x1b[32mAI: 正在思考...\x1b[0m')

  try {
    // 调用 OpenAI API，启用流式输出
    const stream = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages,
      stream: true
    })

    // 存储 AI 的完整回复内容
    let assistantMessage = ''
    // 标记是否已显示 AI 前缀
    let prefixShown = false

    // 逐块读取流式响应并实时输出
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        // 收到第一个数据时，清除正在思考提示，显示 AI 前缀
        if (!prefixShown) {
          process.stdout.write('\r\x1b[K\x1b[32mAI: \x1b[0m')
          prefixShown = true
        }
        process.stdout.write(content)
        assistantMessage += content
      }
    }

    console.log('')
    // 将 AI 回复添加到对话历史
    messages.push({ role: 'assistant', content: assistantMessage })
  } catch (error) {
    console.error('\x1b[31m请求出错:\x1b[0m', error.message)
  }
}

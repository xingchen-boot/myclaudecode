import 'dotenv/config'
import readline from 'readline'
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
})

const messages = []

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function prompt() {
  return new Promise((resolve) => {
    rl.question('\x1b[36m你: \x1b[0m', (input) => {
      resolve(input.trim())
    })
  })
}

async function chat(userMessage) {
  messages.push({ role: 'user', content: userMessage })

  try {
    const stream = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages,
      stream: true
    })

    let assistantMessage = ''
    process.stdout.write('\x1b[32mAI: \x1b[0m')

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        process.stdout.write(content)
        assistantMessage += content
      }
    }

    console.log('')
    messages.push({ role: 'assistant', content: assistantMessage })
  } catch (error) {
    console.error('\x1b[31m请求出错:\x1b[0m', error.message)
  }
}

async function main() {
  console.log('\x1b[1m\x1b[35m=== AI 终端助手 ===\x1b[0m')
  console.log('输入消息开始对话，输入 "exit" 或 "quit" 退出\n')

  while (true) {
    const input = await prompt()

    if (input === 'exit' || input === 'quit') {
      console.log('\n再见!')
      rl.close()
      break
    }

    if (input === '') {
      continue
    }

    await chat(input)
  }
}

main()

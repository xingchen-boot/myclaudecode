import 'dotenv/config'
import readline from 'readline'
import { chat, createClient } from './request/index.js'

// 创建 readline 接口，绑定标准输入输出
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// 获取用户输入的异步函数
function prompt() {
  return new Promise((resolve) => {
    rl.question('\x1b[36m你: \x1b[0m', (input) => {
      resolve(input.trim())
    })
  })
}

// 主函数，程序入口
async function main() {
  // 创建 OpenAI 客户端实例
  const client = createClient()
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

import { readSystem } from '../utils/contextRead.js'

function fail(message) {
    console.error(message)
    process.exit(1)
}

const systemPrompt = readSystem()

if (systemPrompt.includes('${systemInfo}') || systemPrompt.includes('${workPath}')) {
    fail('系统提示里的环境变量没有替换')
}
if (!systemPrompt.includes('dev-simple') || !systemPrompt.includes('dev-complex')) {
    fail('系统提示没有指向两个开发 skill')
}
if (systemPrompt.includes('项目功能开发记录')) {
    fail('记忆清单仍写在每轮系统提示里')
}
if (systemPrompt.length > 900) {
    fail(`系统提示仍然太长: ${systemPrompt.length} 字`)
}

console.log(`系统提示检查通过，${systemPrompt.length} 字`)

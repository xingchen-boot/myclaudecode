import fs from 'fs'
import os from 'os'
import path from 'path'
import {
    setSessionHistoryDir,
    resetActiveSessionFile,
    planCompaction,
    compactMessages,
    buildModelMessages,
    loadLatestSession
} from '../utils/sessionStore.js'

const historyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontcode-compact-'))
setSessionHistoryDir(historyDir)
resetActiveSessionFile()

function fail(message) {
    console.error(message)
    process.exit(1)
}

const shortMessages = [
    { role: 'user', content: '短对话' },
    { role: 'assistant', content: '好' }
]
if (planCompaction(shortMessages, { charLimit: 10, keepChars: 5 })) {
    fail('太短的对话不应该压缩')
}

const earlyUser = { role: 'user', content: '先做登录页'.repeat(40) }
const earlyAssistant = { role: 'assistant', content: '登录页已写好'.repeat(40) }
const laterUser = { role: 'user', content: '再改按钮' }
const laterAssistant = { role: 'assistant', content: '按钮已改' }
const messages = [earlyUser, earlyAssistant, laterUser, laterAssistant]

const plan = planCompaction(messages, { charLimit: 200, keepChars: 80 })
if (!plan || plan.firstKeptMessage !== laterUser || !plan.droppedMessages.includes(earlyUser)) {
    fail('没有把更早的一轮放进摘要范围')
}

if (!compactMessages(messages, '用户先做了登录页。', laterUser)) {
    fail('压缩没有写进会话')
}

const modelMessages = buildModelMessages(messages)
const modelText = modelMessages.map((message) => message.content).join('\n')
if (!modelText.includes('登录页') || modelText.includes('先做登录页'.repeat(40))) {
    fail('发给模型的内容没有用摘要换掉原文')
}
if (modelMessages[1] !== laterUser) {
    fail('最近一轮没有保留')
}

const sessionFile = fs.readdirSync(historyDir).find((name) => name.endsWith('.jsonl'))
const stored = fs.readFileSync(path.join(historyDir, sessionFile), 'utf8')
if (!stored.includes('先做登录页') || !stored.includes('"type":"compaction"')) {
    fail('原文或压缩节点没有留在文件里')
}

resetActiveSessionFile()
const restored = loadLatestSession()
const restoredView = buildModelMessages(restored).map((message) => message.content).join('\n')
if (!restoredView.includes('用户先做了登录页') || restoredView.includes('先做登录页'.repeat(40))) {
    fail('重新加载后没有按压缩记录发给模型')
}
if (!restored.some((message) => String(message.content).includes('先做登录页'))) {
    fail('重新加载后原文从会话里消失了')
}

console.log('会话压缩检查通过')

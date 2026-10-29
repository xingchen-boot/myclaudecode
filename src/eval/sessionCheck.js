import fs from 'fs'
import os from 'os'
import path from 'path'
import {
    setSessionHistoryDir,
    resetActiveSessionFile,
    syncSession,
    undoActiveSession,
    redoActiveSession,
    loadLatestSession
} from '../utils/sessionStore.js'

const historyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontcode-session-'))
setSessionHistoryDir(historyDir)

function fail(message) {
    console.error(message)
    process.exit(1)
}

function readEntries(filePath) {
    return fs.readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line))
}

const firstUser = { role: 'user', content: '先做按钮' }
const firstAssistant = { role: 'assistant', content: '按钮已改' }
const secondUser = { role: 'user', content: '再改颜色' }
const secondAssistant = { role: 'assistant', content: '颜色方案' }
const messages = [firstUser, firstAssistant, secondUser, secondAssistant]

const sessionFile = syncSession(messages)
if (!sessionFile || !sessionFile.endsWith('.jsonl')) {
    fail('没有写成 jsonl')
}

const undone = undoActiveSession(messages)
if (!undone.undone || undone.removedCount !== 2 || messages.length !== 2) {
    fail(`回退后的消息数量不对: ${JSON.stringify(undone)}`)
}
if (messages[1] !== firstAssistant) {
    fail('回退后叶节点不是第一条助手回复')
}

const afterUndo = readEntries(sessionFile)
const nodeEntries = afterUndo.filter((entry) => entry.type === 'node')
if (nodeEntries.length !== 4) {
    fail(`回退把节点删掉了，现在只有 ${nodeEntries.length} 个`)
}
if (!afterUndo.some((entry) => entry.type === 'leaf')) {
    fail('回退没有写下叶指针')
}

const redone = redoActiveSession(messages)
if (!redone.redone || messages.length !== 4 || messages[3].content !== '颜色方案') {
    fail('redo 没有回到刚才放弃的分支')
}

undoActiveSession(messages)
const newUser = { role: 'user', content: '换个做法' }
messages.push(newUser)
syncSession(messages)

if (redoActiveSession(messages).redone) {
    fail('写过新消息之后不应该还能 redo')
}

const stored = readEntries(sessionFile)
const storedNodes = stored.filter((entry) => entry.type === 'node')
const abandoned = storedNodes.find((entry) => entry.message.content === '再改颜色')
const replacement = storedNodes.find((entry) => entry.message.content === '换个做法')
if (!abandoned || !replacement) {
    fail('放弃的分支或新方案没有留在文件里')
}
if (abandoned.parentId !== replacement.parentId) {
    fail('新方案没有从同一个父节点分出来')
}

resetActiveSessionFile()
const restored = loadLatestSession()
const restoredText = restored.map((message) => message.content).join('|')
if (restoredText !== '先做按钮|按钮已改|换个做法') {
    fail(`重载没有沿着叶指针走: ${restoredText}`)
}

resetActiveSessionFile()
const legacyFile = path.join(historyDir, `${Date.now() + 10}.json`)
fs.writeFileSync(legacyFile, JSON.stringify([
    { role: 'user', content: '旧快照' },
    {
        role: 'assistant',
        tool_calls: [{ id: 'call-broken', function: { name: 'read_file', arguments: '{}' } }]
    }
]), 'utf8')
const legacyMessages = loadLatestSession()
if (legacyMessages.length !== 1 || legacyMessages[0].content !== '旧快照') {
    fail('旧 json 快照没有丢掉配不齐的工具调用')
}
const legacySession = syncSession(legacyMessages)
const legacyNodes = readEntries(legacySession).filter((entry) => entry.type === 'node')
if (legacyNodes.length !== 1) {
    fail('旧快照同步时把半截工具调用写回去了')
}

console.log('会话树检查通过')

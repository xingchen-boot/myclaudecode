import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'

// 测试时可改到临时目录，避免写到用户家目录
let historyDirOverride = ''

// 本次进程要续写的会话文件。空字符串表示下一次写入再新建
let activeSessionFile = ''

// 当前叶节点。发给模型的上下文是从根走到这里的一条链
let leafNodeId = ''

// 当前这条链上的节点，和内存里的 messages 一一对应
let activePath = []

// 已经追加进文件的节点，避免把整份会话重写掉
const appendedNodeIds = new Set()

// 刚离开的叶节点。/redo 只沿着这个栈把指针移回去，新消息一写就清空
let redoLeafIds = []

// 文件里的压缩记录。不改父节点，只决定发给模型时从哪里开始保留原文
let storedCompactions = []

// 当前链上生效的压缩。firstKeptMessage 是保留下来的那条消息对象
let compactionState = null

const DEFAULT_CONTEXT_CHAR_LIMIT = 48000
const DEFAULT_KEEP_CHARS = 16000

/**
 * 指定历史目录。只给测试用
 * @param {string} directoryPath
 */
export function setSessionHistoryDir(directoryPath) {
    historyDirOverride = directoryPath || ''
}

/**
 * 当前项目的历史会话目录
 * @returns {string}
 */
function getProjectHistoryDir() {
    if (historyDirOverride) {
        return historyDirOverride
    }
    const projectName = path.basename(process.cwd())
    return path.join(os.homedir(), '.front', 'history', projectName)
}

/**
 * 当前进程正在续写的会话文件
 * @returns {string}
 */
export function getActiveSessionFile() {
    return activeSessionFile
}

/**
 * 指定后续历史写入哪一个文件
 * @param {string} filePath
 */
export function setActiveSessionFile(filePath) {
    activeSessionFile = filePath || ''
}

/**
 * 清空内存里的树指针。磁盘上的旧文件保留
 */
export function resetActiveSessionFile() {
    activeSessionFile = ''
    leafNodeId = ''
    activePath = []
    appendedNodeIds.clear()
    redoLeafIds = []
    storedCompactions = []
    compactionState = null
}

/**
 * 丢掉配不齐的工具调用，避免恢复后请求格式不合法
 * 助手消息若声明了 tool_calls，后面必须紧跟每一条对应的 tool 结果
 * @param {Array} rawMessages - 原始消息
 * @returns {Array}
 */
export function sanitizeSessionMessages(rawMessages) {
    if (!Array.isArray(rawMessages)) {
        return []
    }

    const cleanedMessages = []

    for (let index = 0; index < rawMessages.length; index += 1) {
        const message = rawMessages[index]
        if (!message || typeof message !== 'object') {
            continue
        }

        if (message.role === 'tool') {
            const previousAssistant = [...cleanedMessages].reverse().find((item) => {
                return item.role === 'assistant' && Array.isArray(item.tool_calls)
            })
            const belongsToAssistant = previousAssistant?.tool_calls?.some((toolCall) => {
                return toolCall.id === message.tool_call_id
            })
            if (belongsToAssistant) {
                cleanedMessages.push(message)
            }
            continue
        }

        if (message.role === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
            const missingIds = new Set(message.tool_calls.map((toolCall) => toolCall.id))

            for (let nextIndex = index + 1; nextIndex < rawMessages.length; nextIndex += 1) {
                const nextMessage = rawMessages[nextIndex]
                if (!nextMessage || nextMessage.role !== 'tool') {
                    break
                }
                if (missingIds.has(nextMessage.tool_call_id)) {
                    missingIds.delete(nextMessage.tool_call_id)
                }
            }

            // 工具结果不齐就整段丢掉，不把半截工具调用放回对话
            if (missingIds.size === 0) {
                cleanedMessages.push(message)
            }
            continue
        }

        if (message.role === 'user' || message.role === 'assistant' || message.role === 'system') {
            cleanedMessages.push(message)
        }
    }

    return cleanedMessages
}

/**
 * 保证会话目录和当前 jsonl 文件存在
 * @returns {string}
 */
function ensureSessionFile() {
    const historyDir = getProjectHistoryDir()
    fs.mkdirSync(historyDir, { recursive: true })
    if (!activeSessionFile) {
        activeSessionFile = path.join(historyDir, `${Date.now()}.jsonl`)
    }
    return activeSessionFile
}

/**
 * 往当前会话文件追加一行
 * @param {object} entry
 */
function appendSessionEntry(entry) {
    const filePath = ensureSessionFile()
    fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, 'utf-8')
}

/**
 * 把内存里已有的节点补写进文件。不改叶指针
 * @param {{id: string, parentId: string|null, message: object}} node
 */
function writeStoredNode(node) {
    if (appendedNodeIds.has(node.id)) {
        return
    }
    appendSessionEntry({
        type: 'node',
        id: node.id,
        parentId: node.parentId,
        message: node.message
    })
    appendedNodeIds.add(node.id)
}

/**
 * 把一条消息追加成节点。父节点是当前叶，旧节点不动
 * @param {object} message
 * @returns {string} 新节点 id
 */
function appendMessageNode(message) {
    const nodeId = randomUUID()
    const parentId = leafNodeId || null
    activePath.push({ id: nodeId, parentId, message })
    leafNodeId = nodeId
    appendSessionEntry({
        type: 'node',
        id: nodeId,
        parentId,
        message
    })
    appendedNodeIds.add(nodeId)
    // 已经往新方案上写了，就不能再 redo 回刚放弃的那一支
    redoLeafIds = []
    return nodeId
}

/**
 * 把叶指针记到文件末尾。节点本身不删
 * @param {string} nextLeafId
 */
function appendLeafPointer(nextLeafId) {
    appendSessionEntry({
        type: 'leaf',
        leafId: nextLeafId || null
    })
}

/**
 * 读一个 jsonl 会话，得到全部节点和最后一次叶指针
 * @param {string} filePath
 * @returns {{ nodes: Map<string, {id: string, parentId: string|null, message: object}>, leafId: string }}
 */
function readSessionTree(filePath) {
    const nodes = new Map()
    const compactions = []
    let leafId = ''
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const lines = fileContent.split(/\r?\n/)

    for (const line of lines) {
        if (!line.trim()) {
            continue
        }
        let entry = null
        try {
            entry = JSON.parse(line)
        } catch {
            continue
        }
        if (!entry || typeof entry !== 'object') {
            continue
        }
        if (entry.type === 'node' && entry.id && entry.message) {
            const parentId = entry.parentId || null
            nodes.set(entry.id, { id: entry.id, parentId, message: entry.message })
            leafId = entry.id
            continue
        }
        if (entry.type === 'leaf') {
            leafId = entry.leafId || ''
            continue
        }
        if (entry.type === 'compaction' && entry.anchorId && entry.firstKeptEntryId && entry.summary) {
            compactions.push({
                id: entry.id || randomUUID(),
                anchorId: entry.anchorId,
                firstKeptEntryId: entry.firstKeptEntryId,
                summary: entry.summary
            })
        }
    }

    return { nodes, leafId, compactions }
}

/**
 * 从叶节点沿着 parentId 走回根，得到当前这条链
 * @param {Map} nodes
 * @param {string} leafId
 * @returns {Array<{id: string, parentId: string|null, message: object}>}
 */
function chainFromLeaf(nodes, leafId) {
    const chain = []
    const seenIds = new Set()
    let currentId = leafId

    while (currentId && !seenIds.has(currentId)) {
        const node = nodes.get(currentId)
        if (!node) {
            break
        }
        seenIds.add(currentId)
        chain.push(node)
        currentId = node.parentId
    }

    chain.reverse()
    return chain
}

/**
 * 配不齐的工具调用从当前链上拿掉，文件里的节点仍保留
 * @param {Array} chain
 * @returns {Array}
 */
function sanitizeChain(chain) {
    const cleanedMessages = sanitizeSessionMessages(chain.map((node) => node.message))
    const keptMessages = new Set(cleanedMessages)
    return chain.filter((node) => keptMessages.has(node.message))
}

/**
 * 用一条链替换内存中的活动路径
 * @param {Array} chain
 */
function adoptChain(chain) {
    activePath = chain.map((node) => ({
        id: node.id,
        parentId: node.parentId || null,
        message: node.message
    }))
    leafNodeId = activePath.length > 0 ? activePath[activePath.length - 1].id : ''
    appendedNodeIds.clear()
    for (const node of activePath) {
        appendedNodeIds.add(node.id)
    }
    // 文件里还有没走到的分支，但活动路径上的节点都已经落过盘
    // 分支上的其它节点也算已落盘，避免重写时再追加一遍
}

/**
 * 把文件里所有节点都记成已落盘，这样同步时只会追加新消息
 * @param {Map} nodes
 */
function rememberStoredNodes(nodes) {
    appendedNodeIds.clear()
    for (const nodeId of nodes.keys()) {
        appendedNodeIds.add(nodeId)
    }
}

/**
 * 找到目录里最新的会话文件。jsonl 优先于旧的整份 json
 * @returns {string}
 */
function findLatestSessionFile() {
    const historyDir = getProjectHistoryDir()
    if (!fs.existsSync(historyDir)) {
        return ''
    }

    const historyFiles = fs.readdirSync(historyDir)
        .filter((fileName) => /^\d+\.jsonl?$/.test(fileName))
        .sort((leftName, rightName) => {
            const leftTimestamp = parseInt(path.basename(leftName).replace(/\.jsonl?$/, ''), 10)
            const rightTimestamp = parseInt(path.basename(rightName).replace(/\.jsonl?$/, ''), 10)
            return rightTimestamp - leftTimestamp
        })

    if (historyFiles.length === 0) {
        return ''
    }
    return path.join(historyDir, historyFiles[0])
}

/**
 * 旧的整份 json 快照读成一条链，下次写入时再追加到新的 jsonl
 * @param {string} filePath
 * @returns {Array}
 */
function loadLegacySnapshot(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const storedMessages = JSON.parse(fileContent)
    const cleanedMessages = sanitizeSessionMessages(storedMessages)
    activeSessionFile = ''
    activePath = []
    leafNodeId = ''
    appendedNodeIds.clear()
    redoLeafIds = []
    storedCompactions = []
    compactionState = null
    for (const message of cleanedMessages) {
        const nodeId = randomUUID()
        const parentId = leafNodeId || null
        activePath.push({ id: nodeId, parentId, message })
        leafNodeId = nodeId
    }
    return cleanedMessages
}

/**
 * 读取最近一次保存的会话，并只返回叶指针走到的那条链
 * @returns {Array}
 */
export function loadLatestSession() {
    const latestFilePath = findLatestSessionFile()
    if (!latestFilePath) {
        resetActiveSessionFile()
        return []
    }

    try {
        if (latestFilePath.endsWith('.json')) {
            return loadLegacySnapshot(latestFilePath)
        }

        const { nodes, leafId, compactions } = readSessionTree(latestFilePath)
        const chain = sanitizeChain(chainFromLeaf(nodes, leafId))
        activeSessionFile = latestFilePath
        redoLeafIds = []
        storedCompactions = compactions
        adoptChain(chain)
        bindCompaction(activePath)
        rememberStoredNodes(nodes)
        if ((leafId || '') !== leafNodeId) {
            appendLeafPointer(leafNodeId)
        }
        return activePath.map((node) => node.message)
    } catch (error) {
        console.error(`读取最近会话失败: ${latestFilePath}`, error.message)
        resetActiveSessionFile()
        return []
    }
}

/**
 * 把内存里新出现的消息追加进会话树
 * 已经在文件里的节点不会重写，放弃的分支也不会被删掉
 * @param {Array} messages
 * @returns {string} 会话文件路径
 */
export function syncSession(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return activeSessionFile
    }

    const prefixMatches = messages.length >= activePath.length
        && activePath.every((node, index) => messages[index] === node.message)

    // 内存被换掉时，前缀对不上就整段当作新会话追加，避免把别的对话焊到旧叶上
    if (!prefixMatches) {
        resetActiveSessionFile()
        for (const message of messages) {
            appendMessageNode(message)
        }
        return activeSessionFile
    }

    // 旧快照读进来时节点还只在内存里，先按原来的父子关系补写
    for (const node of activePath) {
        writeStoredNode(node)
    }
    for (const message of messages.slice(activePath.length)) {
        appendMessageNode(message)
    }
    return activeSessionFile
}

/**
 * 回退到上一条用户消息之前。只移动叶指针，文件里的节点保留
 * @param {Array} messages - 当前对话数组，会被原地缩短
 * @returns {{ undone: boolean, removedCount: number, remainingCount: number }}
 */
export function undoActiveSession(messages) {
    if (!Array.isArray(messages)) {
        return { undone: false, removedCount: 0, remainingCount: 0 }
    }

    syncSession(messages)
    const lastUserIndex = activePath.findLastIndex((node) => node.message?.role === 'user')
    if (lastUserIndex < 0) {
        return { undone: false, removedCount: 0, remainingCount: messages.length }
    }

    const removedCount = activePath.length - lastUserIndex
    const previousLeafId = leafNodeId
    activePath = activePath.slice(0, lastUserIndex)
    leafNodeId = activePath.length > 0 ? activePath[activePath.length - 1].id : ''
    messages.splice(lastUserIndex)
    if (previousLeafId && previousLeafId !== leafNodeId) {
        redoLeafIds.push(previousLeafId)
    }
    appendLeafPointer(leafNodeId)
    return { undone: true, removedCount, remainingCount: messages.length }
}

/**
 * 把叶指针移回刚才放弃的那一支。新写过消息之后这个栈是空的
 * @param {Array} messages
 * @returns {{ redone: boolean, remainingCount: number }}
 */
export function redoActiveSession(messages) {
    if (!Array.isArray(messages) || redoLeafIds.length === 0 || !activeSessionFile) {
        return { redone: false, remainingCount: Array.isArray(messages) ? messages.length : 0 }
    }

    const targetLeafId = redoLeafIds[redoLeafIds.length - 1]
    const { nodes, compactions } = readSessionTree(activeSessionFile)
    if (!nodes.has(targetLeafId)) {
        redoLeafIds.pop()
        return { redone: false, remainingCount: messages.length }
    }

    const chain = sanitizeChain(chainFromLeaf(nodes, targetLeafId))
    if (chain.length === 0 || chain[chain.length - 1].id !== targetLeafId) {
        redoLeafIds.pop()
        return { redone: false, remainingCount: messages.length }
    }

    redoLeafIds.pop()
    storedCompactions = compactions
    adoptChain(chain)
    bindCompaction(activePath)
    rememberStoredNodes(nodes)
    messages.splice(0, messages.length, ...activePath.map((node) => node.message))
    appendLeafPointer(leafNodeId)
    return { redone: true, remainingCount: messages.length }
}

/**
 * 一条消息大概占多少字。用来判断要不要压缩，不是精确 token
 * @param {object} message
 * @returns {number}
 */
function messageChars(message) {
    if (!message) {
        return 0
    }
    if (typeof message.content === 'string') {
        return message.content.length
    }
    try {
        return JSON.stringify(message.content || '').length
    } catch {
        return 0
    }
}

/**
 * 在当前链上选中最靠近叶节点的那次压缩
 * @param {Array} chain
 */
function bindCompaction(chain) {
    const indexById = new Map(chain.map((node, index) => [node.id, index]))
    let chosen = null
    let chosenAnchorIndex = -1

    for (const item of storedCompactions) {
        const anchorIndex = indexById.get(item.anchorId)
        const keptIndex = indexById.get(item.firstKeptEntryId)
        if (anchorIndex === undefined || keptIndex === undefined || keptIndex > anchorIndex) {
            continue
        }
        if (anchorIndex >= chosenAnchorIndex) {
            chosen = item
            chosenAnchorIndex = anchorIndex
        }
    }

    if (!chosen) {
        compactionState = null
        return
    }

    const keptNode = chain[indexById.get(chosen.firstKeptEntryId)]
    compactionState = {
        summary: chosen.summary,
        firstKeptMessage: keptNode.message,
        anchorId: chosen.anchorId,
        firstKeptEntryId: chosen.firstKeptEntryId
    }
}

/**
 * 发给模型的消息。有压缩时用摘要替换更早的原文，原文仍留在会话里
 * @param {Array} messages
 * @returns {Array}
 */
export function buildModelMessages(messages) {
    if (!Array.isArray(messages) || !compactionState) {
        return messages || []
    }
    const keptIndex = messages.indexOf(compactionState.firstKeptMessage)
    if (keptIndex <= 0) {
        return messages
    }
    return [
        {
            role: 'user',
            content: `之前的对话已压缩，摘要如下：\n${compactionState.summary}`
        },
        ...messages.slice(keptIndex)
    ]
}

/**
 * 决定要丢掉哪一段。至少保留最近一条用户消息，并且不从工具结果中间切开
 * @param {Array} messages
 * @param {{ charLimit?: number, keepChars?: number }} options
 * @returns {{ droppedMessages: Array, firstKeptMessage: object } | null}
 */
export function planCompaction(messages, options = {}) {
    const charLimit = options.charLimit ?? DEFAULT_CONTEXT_CHAR_LIMIT
    const keepChars = options.keepChars ?? DEFAULT_KEEP_CHARS
    if (!Array.isArray(messages) || messages.length < 4) {
        return null
    }

    const currentChars = buildModelMessages(messages).reduce((sum, message) => sum + messageChars(message), 0)
    if (currentChars < charLimit) {
        return null
    }

    const userIndexes = []
    messages.forEach((message, index) => {
        if (message?.role === 'user') {
            userIndexes.push(index)
        }
    })
    if (userIndexes.length < 2) {
        return null
    }

    const earlierUserIndexes = userIndexes.slice(0, -1)
    let chosenIndex = null
    for (let index = earlierUserIndexes.length - 1; index >= 0; index -= 1) {
        const messageIndex = earlierUserIndexes[index]
        const keptChars = messages.slice(messageIndex).reduce((sum, message) => sum + messageChars(message), 0)
        if (keptChars <= keepChars) {
            chosenIndex = messageIndex
            break
        }
    }
    if (chosenIndex === null) {
        chosenIndex = userIndexes[userIndexes.length - 1]
    }
    if (chosenIndex <= 0) {
        return null
    }

    return {
        droppedMessages: messages.slice(0, chosenIndex),
        firstKeptMessage: messages[chosenIndex]
    }
}

/**
 * 记下一次压缩。旧节点不删，之后的新消息仍接在原来的叶节点后面
 * @param {Array} messages
 * @param {string} summary
 * @param {object} firstKeptMessage
 * @returns {boolean}
 */
export function compactMessages(messages, summary, firstKeptMessage) {
    const summaryText = typeof summary === 'string' ? summary.trim() : ''
    if (!summaryText || !firstKeptMessage) {
        return false
    }

    syncSession(messages)
    const keptNode = activePath.find((node) => node.message === firstKeptMessage)
    const anchorNode = activePath[activePath.length - 1]
    if (!keptNode || !anchorNode) {
        return false
    }

    const compactionId = randomUUID()
    appendSessionEntry({
        type: 'compaction',
        id: compactionId,
        anchorId: anchorNode.id,
        firstKeptEntryId: keptNode.id,
        summary: summaryText
    })
    storedCompactions.push({
        id: compactionId,
        anchorId: anchorNode.id,
        firstKeptEntryId: keptNode.id,
        summary: summaryText
    })
    bindCompaction(activePath)
    return Boolean(compactionState)
}

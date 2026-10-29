/**
 * 这一轮要不要带上选择、调试、对比设计图
 * 其它本地工具和 MCP 工具保持可用
 * @param {Array} messages
 * @returns {boolean}
 */
export function wantsChoice(messages) {
    const text = userText(messages)
    return /选项|挑一个|选一个|从这几个/.test(text)
}

/**
 * 按本轮需要裁剪工具。没选中的工具不会出现在请求里
 * @param {Array} tools
 * @param {{ wantsPreview?: boolean, hasDesign?: boolean, wantsChoice?: boolean }} needs
 * @returns {Array}
 */
export function selectTurnTools(tools, needs) {
    return (tools || []).filter((tool) => {
        const toolName = tool?.name || ''
        if (toolName.includes('__')) {
            return true
        }
        if (toolName === 'debugger_page') {
            return Boolean(needs?.wantsPreview)
        }
        if (toolName === 'diff_pic') {
            return Boolean(needs?.hasDesign)
        }
        if (toolName === 'select') {
            return Boolean(needs?.wantsChoice)
        }
        return true
    })
}

/**
 * 取出用户消息里的文字
 * @param {Array} messages
 * @returns {string}
 */
function userText(messages) {
    const chunks = []
    for (const message of messages || []) {
        if (!message || message.role !== 'user') {
            continue
        }
        if (typeof message.content === 'string') {
            chunks.push(message.content)
            continue
        }
        if (Array.isArray(message.content)) {
            for (const part of message.content) {
                if (part?.type === 'text' && part.text) {
                    chunks.push(part.text)
                }
            }
        }
    }
    return chunks.join('\n')
}

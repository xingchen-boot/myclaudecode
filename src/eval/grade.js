import fs from 'fs'
import path from 'path'

/**
 * 从对话里找出工具调用和对应结果
 * @param {Array} messages
 * @returns {{ name: string, arguments: string, result: string }[]}
 */
export function collectToolResults(messages) {
    const results = []
    const pendingCalls = []

    for (const message of messages || []) {
        if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
            for (const toolCall of message.tool_calls) {
                pendingCalls.push({
                    id: toolCall.id,
                    name: toolCall.function?.name || '',
                    arguments: toolCall.function?.arguments || ''
                })
            }
        }
        if (message.role === 'tool') {
            const matched = pendingCalls.find((call) => call.id === message.tool_call_id)
            results.push({
                name: matched?.name || '',
                arguments: matched?.arguments || '',
                result: typeof message.content === 'string' ? message.content : ''
            })
        }
    }

    return results
}

/**
 * 按 expect.json 验收工作区
 * @param {{ workspaceDir: string, originalDir: string, expectConfig: object, messages: Array }} input
 * @returns {{ passed: boolean, failures: { check: string, message: string }[], skillLoaded: boolean, toolCalls: number, blockedCalls: number }}
 */
export function gradeTask(input) {
    const { workspaceDir, originalDir, expectConfig, messages } = input
    const toolResults = collectToolResults(messages)
    const failures = []
    const checks = Array.isArray(expectConfig.checks) ? expectConfig.checks : []

    for (const check of checks) {
        const failure = runCheck(check, workspaceDir, originalDir, toolResults, expectConfig)
        if (failure) {
            failures.push(failure)
        }
    }

    const skillName = expectConfig.skill || ''
    const skillLoaded = skillName
        ? toolResults.some((tool) => tool.name === 'skill' && tool.arguments.includes(skillName) && !tool.result.startsWith('错误'))
        : false

    return {
        passed: failures.length === 0,
        failures,
        skillLoaded,
        toolCalls: toolResults.length,
        blockedCalls: toolResults.filter((tool) => tool.result.includes('已拦截')).length
    }
}

/**
 * 执行一条验收条件，通过时返回 null
 * @returns {{ check: string, message: string } | null}
 */
function runCheck(check, workspaceDir, originalDir, toolResults, expectConfig) {
    const checkName = check.type || 'unknown'
    if (check.type === 'fileContains' || check.type === 'fileNotContains') {
        const filePath = path.join(workspaceDir, check.path)
        if (!fs.existsSync(filePath)) {
            return { check: checkName, message: `文件不存在: ${check.path}` }
        }
        const content = fs.readFileSync(filePath, 'utf8')
        const found = content.includes(check.text)
        if (check.type === 'fileContains' && !found) {
            return { check: checkName, message: `${check.path} 里没有「${check.text}」` }
        }
        if (check.type === 'fileNotContains' && found) {
            return { check: checkName, message: `${check.path} 仍包含「${check.text}」` }
        }
        return null
    }

    if (check.type === 'fileUnchanged') {
        const currentPath = path.join(workspaceDir, check.path)
        const originalPath = path.join(originalDir, check.path)
        if (!fs.existsSync(currentPath) || !fs.existsSync(originalPath)) {
            return { check: checkName, message: `无法比较文件: ${check.path}` }
        }
        const currentText = fs.readFileSync(currentPath, 'utf8')
        const originalText = fs.readFileSync(originalPath, 'utf8')
        if (currentText !== originalText) {
            return { check: checkName, message: `${check.path} 被改动了` }
        }
        return null
    }

    if (check.type === 'skillLoaded') {
        const skillName = check.skill || expectConfig.skill
        const loaded = toolResults.some((tool) => {
            return tool.name === 'skill' && tool.arguments.includes(skillName) && !tool.result.startsWith('错误')
        })
        if (!loaded) {
            return { check: checkName, message: `没有成功加载 ${skillName}` }
        }
        return null
    }

    if (check.type === 'debuggerClean') {
        const debuggerResults = toolResults.filter((tool) => tool.name === 'debugger_page')
        const lastResult = debuggerResults[debuggerResults.length - 1]
        if (!lastResult) {
            return { check: checkName, message: '没有调用 debugger_page' }
        }
        if (!lastResult.result.includes('"success":true') || lastResult.result.includes('"success":false')) {
            return { check: checkName, message: '最后一次调试没有无报错通过' }
        }
        return null
    }

    if (check.type === 'toolCalled') {
        const toolName = check.tool || ''
        const matchedResults = toolResults.filter((tool) => tool.name === toolName)
        const lastResult = matchedResults[matchedResults.length - 1]
        if (!lastResult) {
            return { check: checkName, message: `没有调用 ${toolName}` }
        }
        if (lastResult.result.includes('已拦截') || lastResult.result.trim().startsWith('错误')) {
            return { check: checkName, message: `${toolName} 没有成功` }
        }
        return null
    }

    return { check: checkName, message: `不认识的验收类型: ${checkName}` }
}

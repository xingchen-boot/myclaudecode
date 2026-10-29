//把本地和mcp合并成一个最终的
import { linkMcpAndListTool } from "./mcp/index.js"
import getLocalTool from "./local/index.js"
import { appendToolTrace, getMcpCircuitBlock, normalizeMcpContent, noteMcpOutcome } from "../utils/toolTrace.js"
import { getWorkflowSnapshot, inspectWorkflowCall, noteWorkflowResult } from "./local/workflowState.js"

// MCP 工具单独超时，避免远端工具一直挂住本轮对话
const MCP_TIMEOUT_MS = 30000

const { localTools, localMap } = getLocalTool()

//初始只有本地的工具
const tools = [...localTools]
const toolNameMap = {
    ...localMap,
}

// mcp连接完成的promise，外部可以 await 等待
export const mcpReady = linkMcpAndListTool(tools, toolNameMap).catch((error) => {
    return [{ name: 'MCP', message: error.message || String(error) }]
})

/**
 * 给异步任务加超时。超时后本轮不再等待，底层请求可能仍会自己结束
 * @param {Promise} taskPromise - 原始任务
 * @param {number} timeoutMs - 超时毫秒
 * @param {string} timeoutMessage - 超时提示
 * @returns {Promise}
 */
function withTimeout(taskPromise, timeoutMs, timeoutMessage) {
    let timer = null
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(timeoutMessage))
        }, timeoutMs)
        if (typeof timer.unref === 'function') {
            timer.unref()
        }
    })

    return Promise.race([taskPromise, timeoutPromise]).finally(() => {
        if (timer) {
            clearTimeout(timer)
        }
    })
}

/**
 * 把异常收成统一的错误文本，方便上层判断失败并重试
 * @param {Error} error
 * @returns {string}
 */
function toErrorText(error) {
    const message = error?.message || String(error)
    if (message.startsWith('错误')) {
        return message
    }
    return `错误：${message}`
}

/**
 * 记一条调用结果。拦截和失败都算未成功
 * @param {string} toolName
 * @param {boolean} isMcp
 * @param {string} text
 * @param {boolean} isError
 * @param {number} startedAt
 */
function recordToolCall(toolName, isMcp, text, isError, startedAt, workflowTrace) {
    const blocked = typeof text === 'string' && text.includes('已拦截')
    const failedText = typeof text === 'string' && text.trim().startsWith('错误')
    const success = !isError && !blocked && !failedText
    appendToolTrace({
        toolName,
        isMcp,
        success,
        blocked,
        durationMs: Date.now() - startedAt,
        reason: success ? '' : text,
        workflowMode: workflowTrace.mode,
        workflowStep: workflowTrace.step,
        workflowAllowed: workflowTrace.allowed,
        workflowNextStep: workflowTrace.nextStep
    })
}

// 执行工具，返回文本和是否失败
export async function excuteTool(name, args) {
    const startedAt = Date.now()
    const client = toolNameMap[name]
    if (!client) {
        const text = `错误：工具 "${name}" 不存在，请检查可用工具列表`
        const missingSnapshot = getWorkflowSnapshot()
        recordToolCall(name, false, text, true, startedAt, {
            ...missingSnapshot,
            allowed: false,
            nextStep: missingSnapshot.step
        })
        return {
            text,
            isError: true
        }
    }

    const isMcp = !client.isLocalClient
    const workflowDecision = inspectWorkflowCall(name)
    if (!workflowDecision.allowed) {
        recordToolCall(name, isMcp, workflowDecision.reason, true, startedAt, {
            mode: workflowDecision.mode,
            step: workflowDecision.step,
            allowed: false,
            nextStep: workflowDecision.step
        })
        return {
            text: workflowDecision.reason,
            isError: true
        }
    }

    if (isMcp) {
        const circuitBlock = getMcpCircuitBlock(name)
        if (circuitBlock.blocked) {
            const circuitSnapshot = getWorkflowSnapshot()
            recordToolCall(name, true, circuitBlock.text, true, startedAt, {
                ...circuitSnapshot,
                allowed: false,
                nextStep: circuitSnapshot.step
            })
            return {
                text: circuitBlock.text,
                isError: true
            }
        }
    }

    try {
        const callPromise = client.callTool({
            name: name,
            arguments: args
        })
        const result = isMcp
            ? await withTimeout(
                callPromise,
                MCP_TIMEOUT_MS,
                `MCP 工具 ${name} 调用超时（${MCP_TIMEOUT_MS / 1000} 秒）`
            )
            : await callPromise
        const normalized = isMcp
            ? normalizeMcpContent(result)
            : {
                text: result?.content?.[0]?.text || '',
                isError: Boolean(result?.isError)
            }
        if (isMcp) {
            noteMcpOutcome(name, !normalized.isError)
        }
        noteWorkflowResult(name, normalized.text, normalized.isError, args)
        const nextSnapshot = getWorkflowSnapshot()
        recordToolCall(name, isMcp, normalized.text, normalized.isError, startedAt, {
            mode: workflowDecision.mode,
            step: workflowDecision.step,
            allowed: true,
            nextStep: nextSnapshot.step
        })
        return normalized
    } catch (error) {
        const text = toErrorText(error)
        if (isMcp) {
            noteMcpOutcome(name, false)
        }
        noteWorkflowResult(name, text, true, args)
        const nextSnapshot = getWorkflowSnapshot()
        recordToolCall(name, isMcp, text, true, startedAt, {
            mode: workflowDecision.mode,
            step: workflowDecision.step,
            allowed: true,
            nextStep: nextSnapshot.step
        })
        return {
            text,
            isError: true
        }
    }
}

export default {
    tools,
    toolNameMap,
    mcpReady
}

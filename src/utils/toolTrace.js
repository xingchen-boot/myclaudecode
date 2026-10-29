import fs from 'fs'
import path from 'path'
import os from 'os'

// MCP 连续失败达到这个次数后，短时间内不再调用
const MCP_FAILURE_LIMIT = 2
// 熔断时长
const MCP_COOLDOWN_MS = 60 * 1000
// 写回上下文的 MCP 文本上限
const MCP_TEXT_LIMIT = 8000
// 统计时最多读取最近这么多条，避免记录文件越积越大
const STATS_RECORD_LIMIT = 2000

// 进程内记住每个 MCP 工具的连续失败次数和熔断截止时间
const mcpCircuitMap = new Map()

/**
 * 当前项目的工具调用记录文件
 * @returns {string}
 */
function getTraceFilePath() {
    const projectName = path.basename(process.cwd()) || 'unknown-project'
    return path.join(os.homedir(), '.front', 'trace', `${projectName}.jsonl`)
}

/**
 * 追加一条工具调用记录。写盘失败不影响工具结果
 * @param {{toolName: string, isMcp: boolean, success: boolean, blocked: boolean, durationMs: number, reason: string}} record
 */
export function appendToolTrace(record) {
    try {
        const filePath = getTraceFilePath()
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        const line = JSON.stringify({
            time: new Date().toISOString(),
            toolName: record.toolName,
            isMcp: Boolean(record.isMcp),
            success: Boolean(record.success),
            blocked: Boolean(record.blocked),
            durationMs: record.durationMs,
            reason: (record.reason || '').slice(0, 300),
            workflowMode: record.workflowMode || 'none',
            workflowStep: record.workflowStep || '',
            workflowAllowed: record.workflowAllowed !== false,
            workflowNextStep: record.workflowNextStep || ''
        })
        fs.appendFileSync(filePath, `${line}\n`, 'utf8')
    } catch (error) {
        console.error('写入工具记录失败:', error.message)
    }
}

/**
 * 读取当前项目最近的工具调用记录
 * @returns {Array}
 */
export function readRecentTraceRecords() {
    const filePath = getTraceFilePath()
    if (!fs.existsSync(filePath)) {
        return []
    }

    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split(/\r?\n/).filter((line) => line.trim())
    const recentLines = lines.slice(-STATS_RECORD_LIMIT)
    const records = []

    for (const line of recentLines) {
        try {
            records.push(JSON.parse(line))
        } catch (error) {
            // 坏行跳过，不影响其余统计
        }
    }

    return records
}

/**
 * 把记录汇总成次数和成功率
 * @param {Array} records
 * @returns {{totalCount: number, successCount: number, failureCount: number, blockedCount: number, successRate: number}}
 */
export function summarizeTraceRecords(records) {
    const totalCount = records.length
    const successCount = records.filter((record) => record.success).length
    const blockedCount = records.filter((record) => record.blocked).length
    const failureCount = records.filter((record) => !record.success && !record.blocked).length
    const successRate = totalCount === 0 ? 0 : Math.round((successCount / totalCount) * 100)

    return {
        totalCount,
        successCount,
        failureCount,
        blockedCount,
        successRate
    }
}

/**
 * 熔断仍然生效时返回拦截文案
 * @param {string} toolName
 * @returns {{blocked: boolean, text: string}}
 */
export function getMcpCircuitBlock(toolName) {
    const circuitState = mcpCircuitMap.get(toolName)
    if (!circuitState || circuitState.openUntil <= Date.now()) {
        return { blocked: false, text: '' }
    }

    const remainingSeconds = Math.ceil((circuitState.openUntil - Date.now()) / 1000)
    return {
        blocked: true,
        text: `错误：已拦截：MCP 工具 ${toolName} 连续失败，${remainingSeconds} 秒内不再调用。`
    }
}

/**
 * 记录一次 MCP 调用结果。连续失败达到上限后进入熔断
 * @param {string} toolName
 * @param {boolean} success
 */
export function noteMcpOutcome(toolName, success) {
    if (success) {
        mcpCircuitMap.delete(toolName)
        return
    }

    const circuitState = mcpCircuitMap.get(toolName) || { failureCount: 0, openUntil: 0 }
    circuitState.failureCount += 1
    if (circuitState.failureCount >= MCP_FAILURE_LIMIT) {
        circuitState.openUntil = Date.now() + MCP_COOLDOWN_MS
        circuitState.failureCount = 0
    }
    mcpCircuitMap.set(toolName, circuitState)
}

/**
 * 只接受文本结果，超长则截断，避免脏数据整段进入上下文
 * @param {{content?: Array, isError?: boolean}} result
 * @returns {{text: string, isError: boolean}}
 */
export function normalizeMcpContent(result) {
    const contentPart = result?.content?.[0]
    if (!contentPart || contentPart.type !== 'text' || typeof contentPart.text !== 'string') {
        return {
            text: '错误：MCP 返回不是文本，已拒绝写入上下文。',
            isError: true
        }
    }

    if (contentPart.text.length <= MCP_TEXT_LIMIT) {
        return {
            text: contentPart.text,
            isError: Boolean(result.isError)
        }
    }

    return {
        text: `${contentPart.text.slice(0, MCP_TEXT_LIMIT)}\n\n（输出已截断，原长度 ${contentPart.text.length} 字）`,
        isError: Boolean(result.isError)
    }
}

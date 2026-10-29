// 模型接口的失败分类。限流和短暂故障会重试，欠费、密钥无效这类错误立刻停止

const MAX_API_RETRIES = 3
const BASE_DELAY_MS = 2000

const PERMANENT_STATUS = new Set([400, 401, 403, 404, 422])
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504])

const PERMANENT_TEXT = /AccountOverdue|overdue balance|invalid api key|incorrect api key|insufficient_quota|model[_ ]not[_ ]found|unsupported model|billing/i
const RETRYABLE_TEXT = /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed|timeout|overloaded|rate limit|APIConnection/i

/**
 * 第几次重试要等多久。第一次 2 秒，之后翻倍
 * @param {number} attempt - 从 1 开始
 * @returns {number}
 */
export function retryDelayMs(attempt) {
    const power = Math.max(0, attempt - 1)
    return BASE_DELAY_MS * (2 ** power)
}

/**
 * 判断这次接口错误能不能重试
 * @param {Error & { status?: number, code?: string, error?: { code?: string } }} error
 * @returns {{ retryable: boolean, reason: string }}
 */
export function classifyApiError(error) {
    const status = Number(error?.status) || 0
    const nestedCode = error?.error?.code || ''
    const text = `${error?.code || ''} ${nestedCode} ${error?.message || ''} ${error?.name || ''}`

    if (PERMANENT_STATUS.has(status) || PERMANENT_TEXT.test(text)) {
        return { retryable: false, reason: '接口拒绝了这次请求' }
    }

    if (RETRYABLE_STATUS.has(status) || RETRYABLE_TEXT.test(text)) {
        const reason = status === 429 ? '接口限流' : '接口暂时失败'
        return { retryable: true, reason }
    }

    return { retryable: false, reason: '接口请求失败' }
}

/**
 * 等待一段时间。测试可以换成空函数
 * @param {number} durationMs
 * @returns {Promise<void>}
 */
function waitMilliseconds(durationMs) {
    return new Promise((resolve) => {
        setTimeout(resolve, durationMs)
    })
}

/**
 * 调用对话接口。短暂失败最多再试 3 次，永久性错误马上抛出
 * @param {{ chat: { completions: { create: Function } } }} openai
 * @param {object} requestBody
 * @param {{ sleep?: (durationMs: number) => Promise<void>, maxRetries?: number }} options
 * @returns {Promise<object>}
 */
export async function createChatCompletion(openai, requestBody, options = {}) {
    const sleep = options.sleep || waitMilliseconds
    const maxRetries = options.maxRetries ?? MAX_API_RETRIES
    let attempt = 0

    while (true) {
        try {
            return await openai.chat.completions.create(requestBody)
        } catch (error) {
            const decision = classifyApiError(error)
            if (!decision.retryable || attempt >= maxRetries) {
                throw error
            }
            attempt += 1
            const delayMs = retryDelayMs(attempt)
            process.stdout.write(`[接口] ${decision.reason}，${delayMs / 1000} 秒后重试（${attempt}/${maxRetries}）\n`)
            await sleep(delayMs)
        }
    }
}

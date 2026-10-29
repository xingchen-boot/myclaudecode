import { classifyApiError, createChatCompletion, retryDelayMs } from '../request/apiRetry.js'

function fail(message) {
    console.error(message)
    process.exit(1)
}

if (retryDelayMs(1) !== 2000 || retryDelayMs(2) !== 4000 || retryDelayMs(3) !== 8000) {
    fail(`重试间隔不对: ${retryDelayMs(1)} ${retryDelayMs(2)} ${retryDelayMs(3)}`)
}

const overdue = classifyApiError({
    status: 403,
    code: 'AccountOverdueError',
    message: 'The request failed because your account has an overdue balance.'
})
if (overdue.retryable) {
    fail('欠费不应该重试')
}

const invalidKey = classifyApiError({ status: 401, message: 'Incorrect API key provided' })
if (invalidKey.retryable) {
    fail('无效密钥不应该重试')
}

const rateLimit = classifyApiError({ status: 429, message: 'rate limit' })
if (!rateLimit.retryable || rateLimit.reason !== '接口限流') {
    fail('限流应该重试')
}

const serverError = classifyApiError({ status: 503, message: 'overloaded' })
if (!serverError.retryable) {
    fail('5xx 应该重试')
}

const dropped = classifyApiError({ code: 'ECONNRESET', message: 'socket hang up' })
if (!dropped.retryable) {
    fail('连接中断应该重试')
}

const localBug = classifyApiError(new TypeError('requestBody is undefined'))
if (localBug.retryable) {
    fail('本地代码错误不应该重试')
}

const delays = []
let calls = 0
const flakyClient = {
    chat: {
        completions: {
            create: async () => {
                calls += 1
                if (calls < 3) {
                    const error = new Error('timeout')
                    error.status = 503
                    throw error
                }
                return { id: 'ok' }
            }
        }
    }
}

const completion = await createChatCompletion(flakyClient, { model: 'test' }, {
    sleep: async (durationMs) => {
        delays.push(durationMs)
    }
})
if (completion.id !== 'ok' || calls !== 3 || delays.join(',') !== '2000,4000') {
    fail(`短暂失败没有按间隔重试成功: calls=${calls} delays=${delays.join(',')}`)
}

let overdueCalls = 0
const overdueClient = {
    chat: {
        completions: {
            create: async () => {
                overdueCalls += 1
                const error = new Error('account has an overdue balance')
                error.status = 403
                error.code = 'AccountOverdueError'
                throw error
            }
        }
    }
}

let overdueSlept = false
try {
    await createChatCompletion(overdueClient, { model: 'test' }, {
        sleep: async () => {
            overdueSlept = true
        }
    })
    fail('欠费请求不应该返回成功')
} catch (error) {
    if (overdueCalls !== 1 || overdueSlept || !String(error.message).includes('overdue')) {
        fail(`欠费仍然重试了: calls=${overdueCalls} slept=${overdueSlept}`)
    }
}

console.log('接口重试检查通过')

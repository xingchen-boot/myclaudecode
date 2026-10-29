// 累计一次评测或一次对话里模型返回的 token

let inputTokens = 0
let outputTokens = 0

/**
 * 把一次接口返回的用量加进去
 * @param {{ prompt_tokens?: number, completion_tokens?: number }} usage
 */
export function addUsage(usage) {
    if (!usage) {
        return
    }
    inputTokens += Number(usage.prompt_tokens) || 0
    outputTokens += Number(usage.completion_tokens) || 0
}

/**
 * 每道评测题开始前清零
 */
export function resetUsage() {
    inputTokens = 0
    outputTokens = 0
}

/**
 * 当前累计用量
 * @returns {{ inputTokens: number, outputTokens: number }}
 */
export function getUsage() {
    return { inputTokens, outputTokens }
}

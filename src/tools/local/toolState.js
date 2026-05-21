/**
 * 工具调用状态追踪
 * 用于记录本次会话中哪些工具已被调用，实现工具间的前置条件检查
 */

// 记录已调用过的工具名
const calledTools = new Set()

/**
 * 标记某个工具已被调用
 * @param {string} toolName - 工具名称
 */
export function markCalled(toolName) {
    calledTools.add(toolName)
}

/**
 * 检查某个工具是否已被调用过
 * @param {string} toolName - 工具名称
 * @returns {boolean}
 */
export function hasCalled(toolName) {
    return calledTools.has(toolName)
}

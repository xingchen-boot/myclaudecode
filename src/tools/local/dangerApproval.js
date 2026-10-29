// 本轮用户是否已经通过 confirm 同意危险操作
let dangerApproved = false

/**
 * 新的一条用户消息开始时清掉确认，避免上一轮的 yes 继续生效
 */
export function clearDangerApproval() {
    dangerApproved = false
}

/**
 * 用户在 confirm 里选择 yes 后调用
 */
export function markDangerApproved() {
    dangerApproved = true
}

/**
 * 当前这条用户消息里是否已经确认过危险操作
 * @returns {boolean}
 */
export function hasDangerApproval() {
    return dangerApproved
}

/**
 * 判断命令会不会删除文件、覆盖内容或结束进程
 * @param {string} command - 模型传来的原始命令
 * @returns {boolean}
 */
export function isDangerousCommand(command) {
    if (!command || typeof command !== 'string') {
        return false
    }

    const dangerousPatterns = [
        /\brm\b/i,
        /\brmdir\b/i,
        /\brd\s+\/s\b/i,
        /\bdel\b/i,
        /\berase\b/i,
        /\bRemove-Item\b/i,
        /\bunlink\b/i,
        /\bshred\b/i,
        /\btruncate\b/i,
        /\bClear-Content\b/i,
        /\bSet-Content\b/i,
        /\bmkfs\b/i,
        /\bdiskpart\b/i,
        /\bFormat-Volume\b/i,
        /\bformat\s+[a-zA-Z]:/,
        /\bgit\s+reset\s+--hard\b/i,
        /\bgit\s+clean\b/i,
        /\bgit\s+checkout\s+--\b/i,
        /\bkill\b/i,
        /\bkillall\b/i,
        /\bpkill\b/i,
        /\btaskkill\b/i,
        /\bStop-Process\b/i,
        /\bshutdown\b/i,
        /\breboot\b/i,
        /\bRestart-Computer\b/i,
        /\bStop-Computer\b/i,
        // 单个 > 会覆盖文件；>> 和 2>&1 不算
        /(^|[^>])>(?!>|&)/
    ]

    if (dangerousPatterns.some((pattern) => pattern.test(command))) {
        return true
    }

    // Out-File 默认覆盖，带 -Append 时只追加
    if (/\bOut-File\b/i.test(command) && !/-Append\b/i.test(command)) {
        return true
    }

    return false
}

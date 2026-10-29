import { syncSession } from './sessionStore.js'

/**
 * 把当前对话追加到会话树
 * 同一次启动续写同一个文件，已有节点不覆盖，放弃的分支不删除
 * @param {Array} data - 当前这条链上的消息
 * @returns {string}
 */
export function writeHistoryToFrontFile(data) {
    return syncSession(data)
}

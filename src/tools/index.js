//把本地和mcp合并成一个最终的
import { linkMcpAndListTool } from "./mcp/index.js"
import getLocalTool from "./local/index.js"
const { localTools, localMap } = getLocalTool()

//初始只有本地的工具
const tools = [...localTools]
const toolNameMap = {
    ...localMap,
}

// mcp连接完成的promise，外部可以 await 等待
export const mcpReady = linkMcpAndListTool(tools, toolNameMap).catch(() => {})

// 执行工具
export async function excuteTool(name, args) {
    const client = toolNameMap[name]
    if (!client) {
        return `错误：工具 "${name}" 不存在，请检查可用工具列表`
    }
    const result = await client.callTool({
        name: name,
        arguments: args
    })
    //返回文本出去
    return result.content[0].text
}

export default {
    tools,
    toolNameMap,
    mcpReady
}

import { getNowMemory, limitMemoryForContext, MAX_MEMORY_LENGTH } from '../../utils/memoryUtils.js';
import { markUntrustedData } from '../../utils/untrustedText.js';

export default {
    define: {
        name: "memoryGet",
        description: "读取项目级和用户级记忆内容。当需要了解项目的结构、技术栈、开发记录、用户偏好等记忆信息时，必须使用此工具，而不是使用bash或grep读取记忆文件",
        inputSchema: {
            type: "object",
            properties: {},
            required: []
        }
    },
    handle() {
        const { projectMemory, userMemory } = getNowMemory();
        const projectText = limitMemoryForContext(projectMemory);
        const userText = limitMemoryForContext(userMemory);
        return markUntrustedData('记忆', `项目级记忆（上限 ${MAX_MEMORY_LENGTH} 字）：\n${projectText}\n\n用户级记忆（上限 ${MAX_MEMORY_LENGTH} 字）：\n${userText}`);
    }
};

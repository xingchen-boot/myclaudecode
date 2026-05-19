import { getNowMemory } from '../../utils/memoryUtils.js';

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
        return `项目级记忆为${projectMemory}，用户级记忆为${userMemory}`;
    }
};

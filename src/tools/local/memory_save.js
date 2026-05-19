import fs from 'fs';
import path from 'path';
import os from 'os';

export default {
    define: {
        name: "memorySave",
        description: "保存项目级和用户级记忆内容到对应的记忆文件中。当需要记录项目信息、用户偏好、开发记录等记忆时，必须使用此工具，而不是使用bash或grep写入记忆文件",
        inputSchema: {
            type: "object",
            properties: {
                projectContent: {
                    type: "string",
                    description: "要写入当前项目记忆文件的内容（项目结构、技术栈、开发记录等）"
                },
                userContent: {
                    type: "string",
                    description: "要写入用户级记忆文件的内容（用户偏好、技术栈、项目情况等）"
                }
            },
            required: ["projectContent", "userContent"]
        }
    },
    handle({ projectContent, userContent }) {
        const projectMemoryDir = path.resolve(process.cwd(), '.front', 'memory');
        const projectMemoryFile = path.join(projectMemoryDir, 'memory.md');

        const userMemoryDir = path.join(os.homedir(), '.front', 'memory');
        const userMemoryFile = path.join(userMemoryDir, 'memory.md');

        fs.mkdirSync(projectMemoryDir, { recursive: true });
        fs.mkdirSync(userMemoryDir, { recursive: true });

        fs.writeFileSync(projectMemoryFile, projectContent, 'utf-8');
        fs.writeFileSync(userMemoryFile, userContent, 'utf-8');

        return `记忆已保存。`;
    }
};

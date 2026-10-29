import fs from 'fs';
import path from 'path';
import os from 'os';
import { MAX_MEMORY_LENGTH } from '../../utils/memoryUtils.js';

export default {
    define: {
        name: "memorySave",
        description: "保存项目级和用户级记忆内容到对应的记忆文件中。当需要记录项目信息、用户偏好、开发记录等记忆时，必须使用此工具，而不是使用bash或grep写入记忆文件。每份内容不得超过 6000 字，超长时先压缩再写入。",
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
        const projectText = typeof projectContent === 'string' ? projectContent : '';
        const userText = typeof userContent === 'string' ? userContent : '';

        // 超长直接拒绝，让模型压缩后再写，较早的重复内容由此被丢掉
        if (projectText.length > MAX_MEMORY_LENGTH || userText.length > MAX_MEMORY_LENGTH) {
            return `错误：记忆超过 ${MAX_MEMORY_LENGTH} 字（项目级 ${projectText.length} 字，用户级 ${userText.length} 字）。请先压缩：删去重复和过时细节，保留项目特点、用户偏好和最近开发记录，然后重新调用 memorySave。`;
        }

        const projectMemoryDir = path.resolve(process.cwd(), '.front', 'memory');
        const projectMemoryFile = path.join(projectMemoryDir, 'memory.md');

        const userMemoryDir = path.join(os.homedir(), '.front', 'memory');
        const userMemoryFile = path.join(userMemoryDir, 'memory.md');

        fs.mkdirSync(projectMemoryDir, { recursive: true });
        fs.mkdirSync(userMemoryDir, { recursive: true });

        fs.writeFileSync(projectMemoryFile, projectText, 'utf-8');
        fs.writeFileSync(userMemoryFile, userText, 'utf-8');

        return `记忆已保存。`;
    }
};

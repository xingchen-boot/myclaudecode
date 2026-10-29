import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// 单份记忆写回和放进对话时的长度上限，超出后丢掉较早的内容
export const MAX_MEMORY_LENGTH = 6000

/**
 * 对话上下文里只保留记忆末尾，避免越积越长占满上下文
 * @param {string} content - 原始记忆
 * @returns {string}
 */
export function limitMemoryForContext(content) {
    if (!content || content.length <= MAX_MEMORY_LENGTH) {
        return content || ''
    }

    const omittedLength = content.length - MAX_MEMORY_LENGTH
    return `（较早记忆已省略 ${omittedLength} 字。更新记忆时请压缩到 ${MAX_MEMORY_LENGTH} 字以内，保留项目特点、用户偏好和最近开发记录）\n${content.slice(-MAX_MEMORY_LENGTH)}`
}

/**
 * 获取当前项目和用户目录下的 memory.md 内容并合并，文件不存在则创建空文件
 * @returns {{ projectMemory: string, userMemory: string }} 合并后的记忆对象
 */
export function getNowMemory() {
    const memoryPaths = {
        projectMemory: path.join(process.cwd(), '.front', 'memory', 'memory.md'),
        userMemory: path.join(os.homedir(), '.front', 'memory', 'memory.md')
    };

    const result = {};


    for (const [key, memoryPath] of Object.entries(memoryPaths)) {
        if (!fs.existsSync(memoryPath)) {
            fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
            fs.writeFileSync(memoryPath, '', 'utf-8');
            result[key] = '';
        } else {
            result[key] = fs.readFileSync(memoryPath, 'utf-8');
        }
    }

    return result;
}

/**
 * 获取当前项目的历史对话记录
 * @param {number} maxCount - 最大获取的历史记录条数，默认50
 * @returns {Array} 历史记录数组
 */
export function getHistory(maxCount = 50) {

    const userDir = os.homedir();
    const projectName = path.basename(process.cwd());
    const projectHistoryDir = path.join(userDir, '.front', 'history', projectName);
    //projectHistoryDir就是获取到history下和当前项目同名的历史记录文件夹
    // 如果历史记录目录不存在，返回空数组
    if (!fs.existsSync(projectHistoryDir)) {
        return [];
    }

    // 获取所有 json 文件，并按文件名（时间戳）降序排列，最近的在前
    const files = fs.readdirSync(projectHistoryDir)
        .filter(file => file.endsWith('.json'))
        .sort((a, b) => {
            const tsA = parseInt(path.basename(a, '.json'), 10);
            const tsB = parseInt(path.basename(b, '.json'), 10);
            return tsB - tsA;
        });

    if (files.length === 0) {
        return [];
    }

    // 每个历史文件都是当时的完整会话，只读最新一份，再取末尾最近的若干条
    for (const file of files) {
        const filePath = path.join(projectHistoryDir, file);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const records = JSON.parse(content);
            if (!Array.isArray(records)) {
                continue;
            }
            return records.slice(-maxCount);
        } catch (error) {
            console.error(`读取历史记录文件失败: ${filePath}`, error);
        }
    }

    return [];
}

/**
 * 获取当前项目和用户目录下的 .front.md 内容并合并，文件不存在则创建空文件
 * @returns {{ projectContext: string, userContext: string }} 合并后的上下文对象
 */
export function getContext() {
    const contextPaths = {
        projectContext: path.join(process.cwd(), '.front.md'),
        userContext: path.join(os.homedir(), '.front', '.front.md')
    };

    const result = {};
    for (const [key, contextPath] of Object.entries(contextPaths)) {
        if (!fs.existsSync(contextPath)) {
            fs.mkdirSync(path.dirname(contextPath), { recursive: true });
            fs.writeFileSync(contextPath, '', 'utf-8');
            result[key] = '';
        } else {
            result[key] = fs.readFileSync(contextPath, 'utf-8');
        }
    }

    return result;
}

/**
 * 读取模板并替换占位符，生成完整的记忆提示内容
 * @returns {string} 替换后的模板文本
 */
export function getMemoryContent() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const templatePath = path.join(__dirname, '..', 'docs', 'memoryTemplate.md');

    let template = fs.readFileSync(templatePath, 'utf-8');

    const { projectMemory, userMemory } = getNowMemory();
    const { projectContext, userContext } = getContext();
    const history = getHistory();

    template = template.replace(/\$\{projectMeory\}/g, limitMemoryForContext(projectMemory));
    template = template.replace(/\$\{userMeory\}/g, limitMemoryForContext(userMemory));
    template = template.replace(/\$\{projectMd\}/g, projectContext);
    template = template.replace(/\$\{userMd\}/g, userContext);
    template = template.replace(/\$\{record\}/g, JSON.stringify(history, null, 2));

    return template;
}
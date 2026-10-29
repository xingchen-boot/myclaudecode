import fs from 'fs';
import { markCalled } from './toolState.js';
import { resolveInsideWorkDir } from '../../utils/pathUtils.js';
import { hasDangerApproval } from './dangerApproval.js';

/**
 * 统计原文片段在文件中出现的次数
 * @param {string} content - 文件全文
 * @param {string} searchText - 要查找的原文
 * @returns {number}
 */
function countOccurrences(content, searchText) {
    if (!searchText) {
        return 0;
    }

    let count = 0;
    let fromIndex = 0;

    while (fromIndex <= content.length) {
        const foundIndex = content.indexOf(searchText, fromIndex);
        if (foundIndex === -1) {
            break;
        }
        count += 1;
        fromIndex = foundIndex + searchText.length;
    }

    return count;
}

/**
 * 把忽略 \r 后的下标映射回原文下标
 * 归一化匹配成功时，用它定位 CRLF 文件里的真实区间
 * @param {string} originalContent - 保留原始换行的全文
 * @param {number} normalizedIndex - 去掉 \r 之后的下标
 * @returns {number}
 */
function mapNormalizedIndex(originalContent, normalizedIndex) {
    let originalIndex = 0;
    let normalizedCursor = 0;

    while (normalizedCursor < normalizedIndex && originalIndex < originalContent.length) {
        if (originalContent[originalIndex] === '\r' && originalContent[originalIndex + 1] === '\n') {
            originalIndex += 1;
        }
        originalIndex += 1;
        normalizedCursor += 1;
    }

    return originalIndex;
}

/**
 * 匹配失败时把原文带回给模型，方便下一次用完全一致的片段重试
 * @param {string} content
 * @returns {string}
 */
function fileExcerpt(content) {
    const maxLength = 1200;
    if (content.length <= maxLength) {
        return content;
    }
    return `${content.slice(0, maxLength)}\n…（文件其余部分已省略）`;
}

/**
 * 插入文本的换行与原文件保持一致，避免一段 LF 插进 CRLF 文件
 * @param {string} fileContent - 原文件内容
 * @param {string} insertedText - 准备写入的新文本
 * @returns {string}
 */
function matchFileNewlines(fileContent, insertedText) {
    if (fileContent.includes('\r\n')) {
        return insertedText.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    }
    return insertedText.replace(/\r\n/g, '\n');
}

export default {
    define: {
        name: "edit_file",
        description: "按原文片段增量修改已有文件。old_text 必须和文件里的内容完全一致，且只出现一次，然后替换成 new_text。修改前必须先调用 confirm 并得到 yes。修改已有文件时优先使用此工具。",
        inputSchema: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "要修改的文件路径（绝对路径或相对当前工作目录的路径）"
                },
                old_text: {
                    type: "string",
                    description: "文件中要被替换的原文，必须完全一致且唯一"
                },
                new_text: {
                    type: "string",
                    description: "替换后的新文本，可以是空字符串，表示删掉这段原文"
                }
            },
            required: ["file_path", "old_text", "new_text"]
        }
    },
    handle({ file_path, old_text, new_text }) {
        if (!hasDangerApproval()) {
            return `错误：已拦截：修改 ${file_path} 之前需要用户确认。请先调用 confirm 说明要改的文件和改动，得到 yes 后再修改。`;
        }

        const pathCheck = resolveInsideWorkDir(file_path);
        if (!pathCheck.ok) {
            return pathCheck.message;
        }

        const resolvedPath = pathCheck.resolvedPath;
        const oldText = typeof old_text === 'string' ? old_text : '';
        const newText = typeof new_text === 'string' ? new_text : '';

        if (!oldText) {
            return '错误：old_text 不能为空。新增文件请使用 write_file。';
        }

        if (oldText === newText) {
            return '错误：新旧内容相同，文件未修改。';
        }

        if (!fs.existsSync(resolvedPath)) {
            return `错误：文件不存在: ${resolvedPath}。新建文件请使用 write_file。`;
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isFile()) {
            return `错误：路径不是文件: ${resolvedPath}`;
        }

        let content = '';
        try {
            content = fs.readFileSync(resolvedPath, 'utf-8');
        } catch (error) {
            return `错误：读取文件失败: ${error.message}`;
        }

        let matchCount = countOccurrences(content, oldText);
        let nextContent = content;
        let matchedIndex = content.indexOf(oldText);
        let lineSource = content;
        const insertedText = matchFileNewlines(content, newText);

        // 用切片拼接，避免 new_text 里的 $&、$$ 被 String.replace 当成替换符
        if (matchCount === 1) {
            nextContent = content.slice(0, matchedIndex) + insertedText + content.slice(matchedIndex + oldText.length);
        } else if (matchCount === 0 && content.includes('\r\n')) {
            // Windows 文件常是 CRLF，模型给出的片段常是 LF，精确匹配失败时再按换行归一化试一次
            const normalizedContent = content.replace(/\r\n/g, '\n');
            const normalizedOldText = oldText.replace(/\r\n/g, '\n');
            const normalizedCount = countOccurrences(normalizedContent, normalizedOldText);
            lineSource = normalizedContent;
            const normalizedIndex = normalizedContent.indexOf(normalizedOldText);
            matchedIndex = normalizedIndex;
            if (normalizedCount === 1) {
                matchCount = 1;
                const startIndex = mapNormalizedIndex(content, normalizedIndex);
                const endIndex = mapNormalizedIndex(content, normalizedIndex + normalizedOldText.length);
                nextContent = content.slice(0, startIndex) + insertedText + content.slice(endIndex);
            } else {
                matchCount = normalizedCount;
            }
        }

        if (matchCount === 0) {
            return `错误：old_text 在文件中没有找到。请从下面原文复制一段完全一致的内容再调用 edit_file，不要改去调用 confirm。\n${fileExcerpt(content)}`;
        }

        if (matchCount > 1) {
            return `错误：old_text 在文件中出现了 ${matchCount} 次。请从下面原文多带一些前后文，让片段唯一后再调用 edit_file。\n${fileExcerpt(content)}`;
        }

        try {
            fs.writeFileSync(resolvedPath, nextContent, 'utf-8');
        } catch (error) {
            return `错误：写入文件失败: ${error.message}`;
        }

        // 增量修改也算写过代码，调试工具可以继续
        markCalled('edit_file');
        markCalled('write_file');

        const lineNumber = lineSource.slice(0, Math.max(0, matchedIndex)).split(/\r?\n/).length;
        return `文件已增量修改: ${resolvedPath}\n修改位置约在第 ${lineNumber} 行。`;
    }
};

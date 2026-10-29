import fs from 'fs';
import path from 'path';
import { markCalled } from './toolState.js';
import { resolveInsideWorkDir } from '../../utils/pathUtils.js';
import { hasDangerApproval } from './dangerApproval.js';

export default {
    define: {
        name: "write_file",
        description: "新建文件，或必须整文件重写时使用。文件不存在则创建，已存在则覆盖。写入前必须先调用 confirm 并得到 yes。修改已有文件的局部内容时，优先使用 edit_file。",
        inputSchema: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "要写入的文件路径（绝对路径或相对路径）"
                },
                content: {
                    type: "string",
                    description: "要写入文件的内容"
                }
            },
            required: ["file_path", "content"]
        }
    },
    handle({ file_path, content }) {
        if (!hasDangerApproval()) {
            return `错误：已拦截：写入 ${file_path} 之前需要用户确认。请先调用 confirm 说明要写的文件，得到 yes 后再写入。`;
        }

        const pathCheck = resolveInsideWorkDir(file_path);
        if (!pathCheck.ok) {
            return pathCheck.message;
        }
        const resolvedPath = pathCheck.resolvedPath;

        try {
            const dir = path.dirname(resolvedPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(resolvedPath, content, 'utf-8');
            // 标记write_file已被调用，供其他工具做前置条件检查
            markCalled('write_file');
            //写入的时候额外回传了写入内容 - 为了让他AI反思
            return `文件写入成功: ${resolvedPath}\n\n写入内容:\n${content}`;
        } catch (err) {
            return `文件写入失败: ${err.message}`;
        }
    }
};

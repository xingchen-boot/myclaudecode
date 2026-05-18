import fs from 'fs';
import path from 'path';

export default {
    define: {
        name: "write_file",
        description: "将内容写入到指定文件，文件不存在则创建，已存在则覆盖。需要修改文件时，先用 read_file 读取原内容，修改后再用此工具写回。不要尝试使用不存在的 edit_file 工具。",
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
        const resolvedPath = path.resolve(file_path);

        try {
            const dir = path.dirname(resolvedPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(resolvedPath, content, 'utf-8');
            //写入的时候额外回传了写入内容 - 为了让他AI反思
            return `文件写入成功: ${resolvedPath}\n\n写入内容:\n${content}`;
        } catch (err) {
            return `文件写入失败: ${err.message}`;
        }
    }
};

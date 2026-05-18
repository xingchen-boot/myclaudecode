import fs from 'fs';
import path from 'path';

export default {
    define: {
        name: "skill",
        description: "读取指定skill文件的完整内容。仅当用户明确要求加载某个skill，或需要查看skill文件内容时使用。",
        inputSchema: {
            type: "object",
            properties: {
                skillpath: {
                    type: "string",
                    description: "要加载的skill的路径"
                }
            },
            required: ["skillpath"]
        }
    },
    handle({ skillpath }) {
        const content = fs.readFileSync(path.resolve(skillpath), 'utf-8');
        return `skill的内容为:${content}`;
    }
};

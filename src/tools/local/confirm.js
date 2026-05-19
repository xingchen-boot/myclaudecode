import readline from 'readline';

export default {
    define: {
        name: "confirm",
        description: "在终端向用户发起一个确认提问，等待用户输入 yes 或 no，返回用户的确认结果",
        inputSchema: {
            type: "object",
            properties: {
                message: {
                    type: "string",
                    description: "要显示给用户的确认提示文本"
                },
                default: {
                    type: "boolean",
                    description: "默认选项，true 表示默认选中 yes，false 表示默认选中 no",
                    default: false
                }
            },
            required: ["message"]
        }
    },
    async handle({ message, default: defaultValue = false }) {
        // 使用 readline 实现简洁的确认提示
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // 根据默认值显示提示
        const defaultHint = defaultValue ? 'Y/n' : 'y/N';
        const prompt = `${message} (${defaultHint}): `;

        return new Promise((resolve) => {
            rl.question(prompt, (answer) => {
                rl.close();
                const normalized = answer.trim().toLowerCase();
                // 空输入使用默认值
                if (normalized === '') {
                    resolve(defaultValue ? "用户已确认 (yes)" : "用户已取消 (no)");
                    return;
                }
                // 判断是否为确认
                const isConfirmed = normalized === 'y' || normalized === 'yes';
                resolve(isConfirmed ? "用户已确认 (yes)" : "用户已取消 (no)");
            });
        });
    }
};

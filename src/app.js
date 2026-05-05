//整个项目的启动入口
import readline from 'readline';
import ora from 'ora';
import { createOpenAIClient, getAIResponse } from "./request/index.js"
import logger from "./utils/logger.js"
import { welcomeLog } from "./utils/init.js";
import { writeHistoryToFrontFile } from "./utils/fsHandle.js"

// 创建终端接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// 创建 OpenAI 客户端实例
const openai = createOpenAIClient();

// 对话历史记录
const messages = [];

// 显示欢迎信息
welcomeLog()

// 处理用户输入
function promptUser() {
    rl.question('问：', async (input) => {
        const trimmedInput = input.trim();

        // 检查退出命令
        if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
            logger.log('', 'white');
            logger.log('再见！感谢使用 AI 终端助手。👋', 'yellow');
            logger.log('', 'white');
            rl.close();
            return;
        }

        // 处理空输入
        if (!trimmedInput) {
            promptUser();
            return;
        }

        messages.push({ role: 'user', content: input });

        // 显示加载提示
        const spinner = ora('AI 正在思考...').start();

        // 获取 AI 回复
        const aiResponse = await getAIResponse({
            openai,
            messages
        });

        // 添加 AI 回复到历史
        messages.push(aiResponse);

        // 停止加载提示并显示回复
        spinner.stop();
        logger.log('AI: ', "green")
        logger.logMarkdown(aiResponse.content);

        // 每轮对话结束后保存历史记录
        writeHistoryToFrontFile(messages);

        // 继续等待下一轮对话
        promptUser();
    });
}

// 启动对话
promptUser();

// 处理程序退出
rl.on('close', () => {
    writeHistoryToFrontFile(messages);
    process.exit(0);
});

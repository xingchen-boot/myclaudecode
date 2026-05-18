import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

const getPlatform = () => {
    return os.platform() === 'win32' ? 'windows' : 'others';
};




export default {
    define: {
        name: "bash",
        description: "执行系统命令。用于：运行shell命令、查看系统信息（IP地址、环境变量、进程等）、执行脚本、安装依赖、git操作、网络请求（curl）等。Windows下使用PowerShell执行，其他系统直接执行。",
        inputSchema: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "具体的要执行的Bash指令，注意区分用户的操作系统，产出合适的指令"
                }
            },
            required: ["command"]
        }
    },

    async handle({ command }) {
        // 1. 获取AI命令


        // 2. 判断系统并执行
        const platform = getPlatform();
        let finalCommand = command;

        if (platform === 'windows') {
            //cmd不能执行bash，所以window下用powershell执行
            finalCommand = `chcp 65001 >nul && powershell -Command "${command}"`;
        }

        // 3. 执行
        try {

            const { stdout, stderr } = await execAsync(finalCommand, { encoding: 'utf8' });
            return `执行成功:\n${stdout}${stderr ? '\n' + stderr : ''}`;
        } catch (error) {
            return `执行失败: ${error.message}`;
        }
    }
};
// const result = await a.handle({
//     command: "ping baidu.com"
// });
// console.log(result);
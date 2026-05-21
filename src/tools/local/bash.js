import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

const getPlatform = () => {
    return os.platform() === 'win32' ? 'windows' : 'others';
};

/**
 * 判断是否为长时间运行的命令（如开发服务器、watch 模式等）
 * 这类命令不会自行退出，需要后台执行
 * @param {string} command
 * @returns {boolean}
 */
function isLongRunningCommand(command) {
    const patterns = [
        /\bnpm\s+run\s+(dev|serve|start|watch)\b/i,
        /\byarn\s+(dev|serve|start|watch)\b/i,
        /\bnpx\s+.*serve\b/i,
        /\bvue-cli-service\s+serve\b/i,
        /\bnode\s+.*--watch\b/i,
        /\bwebpack-dev-server\b/i,
        /\bvite\b(?!.*build)/i,
        /\bhttp-server\b/i,
        /\blive-server\b/i,
    ];
    return patterns.some(pattern => pattern.test(command));
}

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
        const platform = getPlatform();
        let finalCommand = command;

        if (platform === 'windows') {
            finalCommand = `chcp 65001 >nul && powershell -Command "${command}"`;
        }

        // 长时间运行的命令：后台执行，立即返回
        if (isLongRunningCommand(command)) {
            const child = spawn(finalCommand, [], {
                shell: true,
                detached: true,
                stdio: 'ignore',
            });
            child.unref();
            return `已在后台启动进程 (PID: ${child.pid})，命令: ${command}\n注意：进程在后台运行，不会阻塞后续操作。`;
        }

        // 普通命令：执行并返回结果，超时 30 秒
        try {
            const { stdout, stderr } = await execAsync(finalCommand, {
                encoding: 'utf8',
                timeout: 30000,
            });
            return `执行成功:\n${stdout}${stderr ? '\n' + stderr : ''}`;
        } catch (error) {
            return `执行失败: ${error.message}`;
        }
    }
};
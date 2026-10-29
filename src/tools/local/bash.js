import { exec, execFile, spawn } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { hasDangerApproval, isDangerousCommand } from './dangerApproval.js';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

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
        description: "执行系统命令。用于：运行shell命令、查看系统信息、执行脚本、安装依赖、git操作、网络请求等。删除、覆盖文件或结束进程的命令必须先调用 confirm 并得到用户 yes，否则会被直接拒绝。Windows下使用PowerShell执行，其他系统直接执行。",
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
        // 危险命令在进程启动前拒绝，不依赖模型自己记得确认
        if (isDangerousCommand(command) && !hasDangerApproval()) {
            return `错误：已拦截：命令会删除、覆盖或结束进程，本轮还没有用户确认。请先调用 confirm，向用户说明完整命令「${command}」，得到 yes 后再执行。`;
        }

        const platform = getPlatform();

        // Windows 把命令作为 PowerShell 的参数，不再拼进外层引号
        if (platform === 'windows') {
            if (isLongRunningCommand(command)) {
                const child = spawn('powershell.exe', ['-NoProfile', '-Command', command], {
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: true,
                });
                child.unref();
                return `已在后台启动进程 (PID: ${child.pid})，命令: ${command}\n注意：进程在后台运行，不会阻塞后续操作。`;
            }

            try {
                const { stdout, stderr } = await execFileAsync(
                    'powershell.exe',
                    ['-NoProfile', '-NonInteractive', '-Command', command],
                    { encoding: 'utf8', timeout: 30000, windowsHide: true }
                );
                return `执行成功:\n${stdout}${stderr ? '\n' + stderr : ''}`;
            } catch (error) {
                return `执行失败: ${error.message}`;
            }
        }

        if (isLongRunningCommand(command)) {
            const child = spawn(command, [], {
                shell: true,
                detached: true,
                stdio: 'ignore',
            });
            child.unref();
            return `已在后台启动进程 (PID: ${child.pid})，命令: ${command}\n注意：进程在后台运行，不会阻塞后续操作。`;
        }

        try {
            const { stdout, stderr } = await execAsync(command, {
                encoding: 'utf8',
                timeout: 30000,
            });
            return `执行成功:\n${stdout}${stderr ? '\n' + stderr : ''}`;
        } catch (error) {
            return `执行失败: ${error.message}`;
        }
    }
};
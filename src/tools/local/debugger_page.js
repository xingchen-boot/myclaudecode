

import { launchBrowserForCapture, captureRunningBrowser } from '../../utils/debuggerUtils.js';
import { hasCalled, markCalled } from './toolState.js';

export default {
    define: {
        name: "debugger_page",
        description: "浏览器调试工具。当用户说'要'、'看看效果'、'启动试试'、'调试'时，必须调用此工具而不是bash。自动打开浏览器加载指定页面，检测控制台是否有报错，无报错则返回截图路径。禁止用bash启动开发服务器来代替此工具。",
        inputSchema: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "项目http地址"
                }
            },
            required: ['url']
        }
    },
    async handle({ url }) {
        // 前置检查：必须先写入代码才能调试
        if (!hasCalled('write_file')) {
            return '错误：还没有通过write_file写入任何代码，不能进行调试。请先写入代码再调用此工具。';
        }
        await launchBrowserForCapture(url);
        const result = await captureRunningBrowser()
        // 标记debugger_page已被调用，供diff_pic做前置条件检查
        markCalled('debugger_page');
        return `测试结果如下：${JSON.stringify(result)}`
    }
};

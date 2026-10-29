

import { launchBrowserForCapture, captureRunningBrowser } from '../../utils/debuggerUtils.js';
import { hasCalled, markCalled } from './toolState.js';

export default {
    define: {
        name: "debugger_page",
        description: "打开浏览器检查页面控制台和截图。复杂需求里用户要求看效果时用它，不要用 bash 启动服务器。简单需求不要调用。",
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
        if (!hasCalled('write_file') && !hasCalled('edit_file')) {
            return '错误：还没有通过 write_file 或 edit_file 写入任何代码，不能进行调试。请先写入代码再调用此工具。';
        }
        await launchBrowserForCapture(url);
        const result = await captureRunningBrowser()
        // 只有没有控制台错误时，才算完成调试，避免带着报错去对比设计图
        if (result.success) {
            markCalled('debugger_page');
        }
        return `测试结果如下：${JSON.stringify(result)}`
    }
};

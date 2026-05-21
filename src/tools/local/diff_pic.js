
import { createOpenAIClient, getAIResponse, loadConfig } from '../../request/index.js';
import { imageToBase64 } from '../../utils/fileHandle.js';
import { hasCalled } from './toolState.js';
import fs from "fs"
export default {
    define: {
        name: "diff_pic",
        description: "设计图与截图对比工具。使用前提：1.页面代码已开发完成 2.已通过debugger_page工具获取到截图。在以上两步完成之前禁止调用此工具。传入设计图路径和截图路径，返回UI差异描述。",
        inputSchema: {
            type: "object",
            properties: {
                design: {
                    type: "string",
                    description: "设计图所在的绝对路径"
                },
                screenshot: {
                    type: "string",
                    description: "截图所在的绝对路径",
                    default: false
                }
            },
            required: ["design", "screenshot"]
        }
    },
    async handle({ design, screenshot }) {
        // 前置检查：必须先通过debugger_page获取截图
        if (!hasCalled('debugger_page')) {
            return '错误：还没有通过debugger_page获取截图，请先调用debugger_page获取页面截图后再进行对比。';
        }
        const openai = createOpenAIClient();
        const designBase64 = await imageToBase64(design);
        const screenshotBase64 = await imageToBase64(screenshot);
        const message = [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "以下是设计图和测试截图，请比对测试截图和设计图有什么区别。忽略文本内容，列表长度内容这些差异。重点看ui布局，配色是否有差异，具体差多少px"
                    }
                ]
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "这是设计图"
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: designBase64
                        }
                    }
                ]
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "这是效果截图"
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: screenshotBase64
                        }
                    }
                ]
            }

        ]
        const config = loadConfig()
        let response = await openai.chat.completions.create({
            model: config.visionModel || config.model,
            messages: message,
        });
        const result = response.choices[0].message
        fs.writeFileSync("./record.json", JSON.stringify(result))
        return `图片对比结果如下：${result.content}`
    }
};

import { formatUserContext, buildTurnContext } from '../utils/contextRead.js'

function fail(message) {
    console.error(message)
    process.exit(1)
}

if (formatUserContext({})) {
    fail('没有用户要求和记忆时不应该生成上下文')
}

const onlyMemory = formatUserContext({ projectMemory: '用编辑器改文件', userContent: '' })
if (onlyMemory) {
    fail('记忆不应该写进每轮上下文')
}

const requirement = formatUserContext({ userContent: '用两个空格缩进' })
if (!requirement.includes('用两个空格缩进')) {
    fail('用户要求应该保留')
}

const context = buildTurnContext({
    systemContent: '系统',
    skillContent: 'skill 摘要',
    ragContent: '   '
})
if (context[0].content !== '系统' || !context.some((message) => message.content === 'skill 摘要')) {
    fail(`固定上下文缺了系统提示或 skill: ${JSON.stringify(context)}`)
}
if (context.some((message) => !String(message.content).trim())) {
    fail('空内容不应该占一条消息')
}

const withRag = buildTurnContext({
    systemContent: '系统',
    skillContent: 'skill 摘要',
    ragContent: '相关文档'
})
if (!withRag.some((message) => message.content === '相关文档') || withRag.length !== context.length + 1) {
    fail('有检索结果时应该多一条消息')
}

console.log('上下文组装检查通过')

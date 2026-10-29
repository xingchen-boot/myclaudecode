import { resetWorkflowForTurn, getWorkflowToolNeeds } from '../tools/local/workflowState.js'
import { selectTurnTools, wantsChoice } from '../tools/selectTurnTools.js'
import { getSkillHeaders } from '../utils/contextRead.js'
import skillTool from '../tools/local/skill.js'

function fail(message) {
    console.error(message)
    process.exit(1)
}

const tools = [
    { name: 'read_file' },
    { name: 'select' },
    { name: 'debugger_page' },
    { name: 'diff_pic' },
    { name: 'docs__search' }
]

resetWorkflowForTurn('把按钮改成保存', false)
const plainNeeds = getWorkflowToolNeeds()
const plainTools = selectTurnTools(tools, { ...plainNeeds, wantsChoice: false }).map((tool) => tool.name)
if (plainTools.includes('debugger_page') || plainTools.includes('diff_pic') || plainTools.includes('select')) {
    fail(`普通改动仍带上了用不到的工具: ${plainTools.join(',')}`)
}
if (!plainTools.includes('read_file') || !plainTools.includes('docs__search')) {
    fail('基础工具或 MCP 工具被去掉了')
}

resetWorkflowForTurn('改完看看效果', false)
const previewTools = selectTurnTools(tools, { ...getWorkflowToolNeeds(), wantsChoice: false }).map((tool) => tool.name)
if (!previewTools.includes('debugger_page') || previewTools.includes('diff_pic')) {
    fail(`看效果时的工具不对: ${previewTools.join(',')}`)
}

resetWorkflowForTurn('按设计图改标题，然后看看效果', true)
const designTools = selectTurnTools(tools, { ...getWorkflowToolNeeds(), wantsChoice: false }).map((tool) => tool.name)
if (!designTools.includes('debugger_page') || !designTools.includes('diff_pic')) {
    fail(`设计图任务缺少调试或对比: ${designTools.join(',')}`)
}

if (!wantsChoice([{ role: 'user', content: '从这几个方案里挑一个' }])) {
    fail('明确要求挑选时应该带上 select')
}
if (wantsChoice([{ role: 'user', content: '把按钮改成保存' }])) {
    fail('普通改动不应该带上 select')
}

const headers = getSkillHeaders()
if (/[A-Za-z]:\\/.test(headers) || !headers.includes('dev-simple/SKILL.md')) {
    fail(`skill 摘要仍带绝对路径或缺少短路径: ${headers}`)
}

const skillText = skillTool.handle({ skillpath: 'dev-simple/SKILL.md' })
if (!skillText.includes('简单需求') || skillText.startsWith('错误')) {
    fail(`短路径没有读到 skill: ${skillText.slice(0, 80)}`)
}

console.log('按需上下文检查通过')

import {
    resetWorkflowForTurn,
    noteWorkflowResult,
    inspectWorkflowCall
} from '../tools/local/workflowState.js'
import { hasCalled, markCalled } from '../tools/local/toolState.js'

function fail(message) {
    console.error(message)
    process.exit(1)
}

function loadSkill(skillPath) {
    noteWorkflowResult('skill', 'skill的内容为:流程', false, { skillpath: skillPath })
}

resetWorkflowForTurn('把按钮改成保存', false)
noteWorkflowResult('read_file', '文件内容', false, {})
noteWorkflowResult('confirm', '用户已确认 (yes)', false, {})
loadSkill('D:/skills/dev-simple/SKILL.md')
const writeAllowed = inspectWorkflowCall('edit_file')
if (!writeAllowed.allowed || writeAllowed.step !== 'write') {
    fail(`已确认的进度没有保留: ${JSON.stringify(writeAllowed)}`)
}

resetWorkflowForTurn('把按钮改成保存', false)
noteWorkflowResult('grep', '找到 index.html', false, {})
loadSkill('D:/skills/dev-simple/SKILL.md')
const confirmAllowed = inspectWorkflowCall('confirm')
const editBlocked = inspectWorkflowCall('edit_file')
if (!confirmAllowed.allowed || confirmAllowed.step !== 'locate') {
    fail(`只定位过时应该允许确认: ${JSON.stringify(confirmAllowed)}`)
}
if (editBlocked.allowed) {
    fail('还没确认就允许写入了')
}

resetWorkflowForTurn('把按钮改成保存', false)
loadSkill('D:/skills/dev-complex/SKILL.md')
const freshEdit = inspectWorkflowCall('edit_file')
const freshConfirm = inspectWorkflowCall('confirm')
if (freshEdit.allowed || freshConfirm.allowed || freshEdit.step !== 'locate') {
    fail(`没有定位时不应该跳步: ${JSON.stringify(freshEdit)}`)
}

resetWorkflowForTurn('再改一处', false)
noteWorkflowResult('read_file', '文件内容', false, {})
noteWorkflowResult('confirm', '用户已确认 (yes)', false, {})
loadSkill('D:/skills/dev-simple/SKILL.md')
noteWorkflowResult('edit_file', '文件已增量修改: index.html', false, {})
loadSkill('D:/skills/dev-complex/SKILL.md')
const keptStep = inspectWorkflowCall('read_file')
if (keptStep.step !== 'verify') {
    fail(`再次加载 skill 把步骤退回去了: ${keptStep.step}`)
}

resetWorkflowForTurn('另一句话', false)
const nextTurn = inspectWorkflowCall('edit_file')
if (nextTurn.allowed || nextTurn.mode !== 'none') {
    fail('新的一轮没有重新开始')
}

markCalled('write_file')
markCalled('debugger_page')
resetWorkflowForTurn('看看效果', true)
if (hasCalled('write_file') || hasCalled('debugger_page')) {
    fail('新的一轮还留着上一轮的写入和调试记录')
}

/**
 * 把复杂需求走到检查完成
 * @param {string} userText
 * @param {boolean} hasDesign
 */
function reachReview(userText, hasDesign) {
    resetWorkflowForTurn(userText, hasDesign)
    loadSkill('D:/skills/dev-complex/SKILL.md')
    noteWorkflowResult('read_file', '文件内容', false, {})
    noteWorkflowResult('confirm', '用户已确认 (yes)', false, {})
    noteWorkflowResult('edit_file', '文件已增量修改: index.html', false, {})
    noteWorkflowResult('read_file', '读回后的内容', false, {})
}

reachReview('把样式改一下', false)
if (inspectWorkflowCall('debugger_page').allowed) {
    fail('用户没要求看效果，却允许调试')
}
if (inspectWorkflowCall('diff_pic').allowed) {
    fail('没有设计图，却允许对比')
}

reachReview('看看效果', false)
const previewCall = inspectWorkflowCall('debugger_page')
if (!previewCall.allowed || previewCall.step !== 'review') {
    fail(`要求看效果时应该允许调试: ${JSON.stringify(previewCall)}`)
}
noteWorkflowResult('debugger_page', '测试结果如下：{"success":false}', false, {})
if (inspectWorkflowCall('diff_pic').allowed || inspectWorkflowCall('edit_file').step !== 'write') {
    fail('调试失败后没有回到写入，或仍允许对比设计图')
}

reachReview('看看效果', true)
noteWorkflowResult('debugger_page', '测试结果如下：{"success":true}', false, {})
const diffCall = inspectWorkflowCall('diff_pic')
if (!diffCall.allowed || diffCall.step !== 'diff') {
    fail(`调试成功且有设计图时应该允许对比: ${JSON.stringify(diffCall)}`)
}

resetWorkflowForTurn('看看效果', false)
loadSkill('D:/skills/dev-simple/SKILL.md')
noteWorkflowResult('read_file', '文件内容', false, {})
noteWorkflowResult('confirm', '用户已确认 (yes)', false, {})
noteWorkflowResult('edit_file', '文件已增量修改: index.html', false, {})
noteWorkflowResult('read_file', '读回后的内容', false, {})
if (inspectWorkflowCall('debugger_page').allowed) {
    fail('简单需求不允许调试')
}

console.log('流程进度检查通过')

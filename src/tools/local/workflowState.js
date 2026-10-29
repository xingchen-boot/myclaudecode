import { resetCalledTools } from './toolState.js'

// 本轮开发流程状态。执行工具前用它判断，不允许的调用不会真正执行

const STEP_LABELS = {
    idle: '未加载工作流',
    locate: '定位代码',
    write: '写入代码',
    verify: '读回改动',
    review: '检查完成',
    diff: '对比设计图',
    done: '流程结束'
}

const LOCATE_TOOLS = ['read_file', 'grep', 'glob']
const WRITE_TOOLS = ['edit_file', 'write_file']

let workflow = createIdleWorkflow('', false)

/**
 * 生成一条空流程
 * @param {string} userText
 * @param {boolean} hasDesign
 * @returns {object}
 */
function createIdleWorkflow(userText, hasDesign) {
    return {
        mode: '',
        step: 'idle',
        located: false,
        confirmed: false,
        hasDesign: Boolean(hasDesign),
        wantsPreview: wantsPreview(userText)
    }
}

/**
 * 用户这句话是否要求看运行效果
 * @param {string} userText
 * @returns {boolean}
 */
function wantsPreview(userText) {
    const text = String(userText || '')
    return /看看效果|看效果|调试|运行一下|打开页面|启动试试|还原|https?:\/\//.test(text)
}

/**
 * 新的一条用户消息开始时重置流程
 * 上一轮读过、确认过、写过，都不能带到这一轮
 * @param {string} userText
 * @param {boolean} hasDesign
 */
export function resetWorkflowForTurn(userText, hasDesign) {
    const text = String(userText || '')
    const designInText = /设计图|#.+\.(png|jpe?g|gif|webp|bmp)/i.test(text)
    workflow = createIdleWorkflow(text, Boolean(hasDesign) || designInText)
    // 上一轮写过或调试过，不能让这一轮直接过 debugger_page、diff_pic 的内部检查
    resetCalledTools()
}

/**
 * 本轮是否需要调试或对比设计图。工具列表按这个裁剪
 * @returns {{ wantsPreview: boolean, hasDesign: boolean }}
 */
export function getWorkflowToolNeeds() {
    return {
        wantsPreview: Boolean(workflow.wantsPreview),
        hasDesign: Boolean(workflow.hasDesign)
    }
}

/**
 * 当前流程快照，写入 trace
 * @returns {{mode: string, step: string}}
 */
export function getWorkflowSnapshot() {
    return {
        mode: workflow.mode || 'none',
        step: workflow.step
    }
}

/**
 * 这一步允许哪些工具
 * @returns {Set<string>}
 */
function allowedTools() {
    if (workflow.step === 'locate') {
        const tools = new Set(LOCATE_TOOLS)
        if (workflow.located) {
            tools.add('confirm')
        }
        return tools
    }
    if (workflow.step === 'write') {
        return new Set(WRITE_TOOLS)
    }
    if (workflow.step === 'verify') {
        return new Set(['read_file'])
    }
    if (workflow.step === 'review') {
        const tools = new Set(['read_file', ...WRITE_TOOLS])
        if (workflow.mode === 'complex' && workflow.wantsPreview) {
            tools.add('debugger_page')
        }
        return tools
    }
    if (workflow.step === 'diff') {
        const tools = new Set(['read_file'])
        if (workflow.hasDesign) {
            tools.add('diff_pic')
        }
        return tools
    }
    return new Set(['read_file'])
}

/**
 * 拼出拒绝原因，告诉模型现在停在哪一步、可以调用什么
 * @param {string} toolName
 * @returns {string}
 */
function rejectionMessage(toolName) {
    const stepLabel = STEP_LABELS[workflow.step] || workflow.step
    const modeLabel = workflow.mode === 'simple' ? '简单需求' : workflow.mode === 'complex' ? '复杂需求' : '未加载工作流'
    if (!workflow.mode) {
        return `错误：已拦截：调用 ${toolName} 之前必须先用 skill 读取 dev-simple 或 dev-complex。当前步骤：${stepLabel}。`
    }
    const allowed = [...allowedTools()].join('、')
    let extra = ''
    if (toolName === 'debugger_page' && workflow.mode === 'simple') {
        extra = '简单需求不允许调试。'
    } else if (toolName === 'debugger_page' && !workflow.wantsPreview) {
        extra = '本轮用户没有要求看效果。'
    } else if (toolName === 'diff_pic' && !workflow.hasDesign) {
        extra = '本轮没有设计图。'
    }
    return `错误：已拦截：当前是${modeLabel}的${stepLabel}，只允许 ${allowed}。${extra}`
}

/**
 * 执行前检查。非开发工具直接放行
 * @param {string} toolName
 * @returns {{allowed: boolean, reason: string, mode: string, step: string}}
 */
export function inspectWorkflowCall(toolName) {
    const snapshot = getWorkflowSnapshot()
    const gatedTools = new Set([
        ...LOCATE_TOOLS,
        'confirm',
        ...WRITE_TOOLS,
        'debugger_page',
        'diff_pic'
    ])

    if (toolName === 'skill' || !gatedTools.has(toolName)) {
        return { allowed: true, reason: '', ...snapshot }
    }

    // 还没进入流程时，解释代码仍可以读文件；写入和调试不行
    if (!workflow.mode) {
        if (WRITE_TOOLS.includes(toolName) || toolName === 'debugger_page' || toolName === 'diff_pic') {
            return { allowed: false, reason: rejectionMessage(toolName), ...snapshot }
        }
        return { allowed: true, reason: '', ...snapshot }
    }

    if (!allowedTools().has(toolName)) {
        return { allowed: false, reason: rejectionMessage(toolName).trim(), ...snapshot }
    }

    return { allowed: true, reason: '', ...snapshot }
}

/**
 * 工具结果返回后推进步骤。失败一般停在原步骤
 * @param {string} toolName
 * @param {string} text
 * @param {boolean} isError
 * @param {object} args
 */
export function noteWorkflowResult(toolName, text, isError, args = {}) {
    const resultText = typeof text === 'string' ? text : ''
    const failed = Boolean(isError) || resultText.trim().startsWith('错误')

    if (toolName === 'skill') {
        if (failed) {
            return
        }
        const skillPath = String(args.skillpath || '').replace(/\\/g, '/').toLowerCase()
        if (skillPath.includes('/dev-simple/skill.md')) {
            workflow.mode = 'simple'
        } else if (skillPath.includes('/dev-complex/skill.md')) {
            workflow.mode = 'complex'
        } else {
            return
        }
        // 同一轮里已经读过、确认过的进度保留，不退回起点
        if (workflow.step === 'idle' || workflow.step === 'locate') {
            workflow.step = workflow.confirmed ? 'write' : 'locate'
        }
        return
    }

    if (!workflow.mode) {
        if (failed) {
            return
        }
        if (LOCATE_TOOLS.includes(toolName)) {
            workflow.located = true
            return
        }
        if (toolName === 'confirm' && workflow.located && resultText.includes('用户已确认')) {
            workflow.confirmed = true
        }
        return
    }

    if (failed) {
        if (toolName === 'debugger_page') {
            workflow.step = 'write'
        }
        return
    }

    if (workflow.step === 'locate' && LOCATE_TOOLS.includes(toolName)) {
        workflow.located = true
        return
    }

    if (toolName === 'confirm' && resultText.includes('用户已确认')) {
        workflow.confirmed = true
        workflow.step = 'write'
        return
    }

    if (WRITE_TOOLS.includes(toolName) && (workflow.step === 'write' || workflow.step === 'review')) {
        workflow.step = 'verify'
        return
    }

    if (workflow.step === 'verify' && toolName === 'read_file') {
        workflow.step = workflow.mode === 'simple' ? 'done' : 'review'
        return
    }

    if (toolName === 'debugger_page') {
        const pageFailed = resultText.includes('"success":false')
        if (pageFailed) {
            workflow.step = 'write'
            return
        }
        workflow.step = workflow.hasDesign ? 'diff' : 'done'
        return
    }

    if (toolName === 'diff_pic') {
        workflow.step = 'done'
    }
}

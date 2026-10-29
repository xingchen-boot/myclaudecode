import fs from 'fs'
import path from 'path'
import { createOpenAIClient, getAIResponse } from '../request/index.js'
import { readSystem, getSkillHeaders, buildTurnContext } from '../utils/contextRead.js'
import { resetUsage, getUsage } from '../utils/usageCounter.js'
import { resetWorkflowForTurn } from '../tools/local/workflowState.js'
import { clearDangerApproval } from '../tools/local/dangerApproval.js'
import { resetCalledTools } from '../tools/local/toolState.js'
import toolResult from '../tools/index.js'
import { gradeTask } from './grade.js'

/**
 * 复制题目初始目录
 * @param {string} source
 * @param {string} target
 */
function copyDirectory(source, target) {
    fs.mkdirSync(target, { recursive: true })
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        const sourcePath = path.join(source, entry.name)
        const targetPath = path.join(target, entry.name)
        if (entry.isDirectory()) {
            copyDirectory(sourcePath, targetPath)
        } else {
            fs.copyFileSync(sourcePath, targetPath)
        }
    }
}

/**
 * 在干净副本里跑一道题
 * @param {{ taskDir: string, runDir: string }} options
 * @returns {Promise<object>}
 */
export async function runTask(options) {
    const taskDir = options.taskDir
    const taskText = fs.readFileSync(path.join(taskDir, 'task.md'), 'utf8').trim()
    const expectConfig = JSON.parse(fs.readFileSync(path.join(taskDir, 'expect.json'), 'utf8'))
    const originalDir = path.join(taskDir, 'workspace')
    const workspaceDir = path.join(options.runDir, 'workspace')
    copyDirectory(originalDir, workspaceDir)

    const previousDirectory = process.cwd()
    process.env.FRONT_EVAL = '1'
    process.chdir(workspaceDir)
    resetUsage()
    resetCalledTools()
    clearDangerApproval()
    resetWorkflowForTurn(taskText, Boolean(expectConfig.hasDesign))

    try {
        const openai = createOpenAIClient()
        const messages = [{ role: 'user', content: taskText }]
        await getAIResponse({
            openai,
            toolResult,
            contextMessageList: buildTurnContext({
                systemContent: readSystem(),
                skillContent: getSkillHeaders(),
                ragContent: ''
            }),
            messages,
            spinner: null,
            maxToolRounds: 12
        })

        const usage = getUsage()
        const grade = gradeTask({
            workspaceDir,
            originalDir,
            expectConfig,
            messages
        })
        return {
            id: path.basename(taskDir),
            type: expectConfig.type || '',
            skill: expectConfig.skill || '',
            passed: grade.passed,
            failures: grade.failures,
            skillLoaded: grade.skillLoaded,
            toolCalls: grade.toolCalls,
            blockedCalls: grade.blockedCalls,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            workspaceDir
        }
    } finally {
        process.chdir(previousDirectory)
        delete process.env.FRONT_EVAL
    }
}

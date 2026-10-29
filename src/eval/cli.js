import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const tasksRoot = path.join(projectRoot, 'eval', 'tasks')

/**
 * 找出含 task.md 和 expect.json 的题目目录
 * @returns {string[]}
 */
function listTaskDirectories() {
    if (!fs.existsSync(tasksRoot)) {
        return []
    }
    return fs.readdirSync(tasksRoot)
        .map((name) => path.join(tasksRoot, name))
        .filter((taskDir) => {
            return fs.existsSync(path.join(taskDir, 'task.md'))
                && fs.existsSync(path.join(taskDir, 'expect.json'))
        })
        .sort()
}

/**
 * 把一次评测写成 JSON 和一份简短 Markdown
 * @param {object[]} results
 * @param {string} reportDir
 */
function writeReport(results, reportDir) {
    fs.mkdirSync(reportDir, { recursive: true })
    const passedCount = results.filter((result) => result.passed).length
    const summary = {
        total: results.length,
        passed: passedCount,
        passRate: results.length === 0 ? 0 : Math.round((passedCount / results.length) * 100),
        inputTokens: results.reduce((sum, result) => sum + result.inputTokens, 0),
        outputTokens: results.reduce((sum, result) => sum + result.outputTokens, 0),
        results
    }
    fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(summary, null, 2), 'utf8')

    const lines = [
        `# 评测报告`,
        '',
        `通过 ${summary.passed}/${summary.total}，通过率 ${summary.passRate}%。`,
        `输入 token ${summary.inputTokens}，输出 token ${summary.outputTokens}。`,
        '',
        '| 题目 | 类型 | 通过 | Skill | 工具次数 | 拦截 | 输入 token | 输出 token |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |'
    ]
    for (const result of results) {
        lines.push(`| ${result.id} | ${result.type} | ${result.passed ? '是' : '否'} | ${result.skillLoaded ? '已加载' : '未加载'} | ${result.toolCalls} | ${result.blockedCalls} | ${result.inputTokens} | ${result.outputTokens} |`)
        for (const failure of result.failures) {
            lines.push(`|  |  |  | 失败：${failure.message} |  |  |  |  |`)
        }
    }
    fs.writeFileSync(path.join(reportDir, 'report.md'), lines.join('\n'), 'utf8')
}

const argumentsList = process.argv.slice(2)
const taskFlagIndex = argumentsList.indexOf('--task')
const selectedTask = taskFlagIndex >= 0 ? argumentsList[taskFlagIndex + 1] : ''

// 评测输出走管道时默认会攒缓冲，改成写完就出现
if (process.stdout._handle && typeof process.stdout._handle.setBlocking === 'function') {
    process.stdout._handle.setBlocking(true)
}

const taskDirectories = listTaskDirectories().filter((taskDir) => {
    if (!selectedTask) {
        return true
    }
    return path.basename(taskDir) === selectedTask
})

if (argumentsList.includes('--list')) {
    for (const taskDir of listTaskDirectories()) {
        console.log(path.basename(taskDir))
    }
    process.exit(0)
}

const { runTask } = await import('./runTask.js')

if (taskDirectories.length === 0) {
    console.error(selectedTask ? `没有这道题: ${selectedTask}` : '没有找到评测题')
    process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const reportDir = path.join(projectRoot, 'eval', 'reports', stamp)
const results = []

/**
 * 立刻把进度写到终端。管道里的 console.log 可能攒在缓冲区里
 * @param {string} text
 */
function logNow(text) {
    fs.writeSync(1, `${text}\n`)
}

for (const taskDir of taskDirectories) {
    const taskId = path.basename(taskDir)
    logNow(`\n开始评测 ${taskId}`)
    try {
        const result = await runTask({
            taskDir,
            runDir: path.join(projectRoot, 'eval', 'runs', stamp, taskId)
        })
        results.push(result)
        logNow(result.passed ? '通过' : `失败：${result.failures.map((failure) => failure.message).join('；')}`)
    } catch (error) {
        results.push({
            id: taskId,
            type: '',
            skill: '',
            passed: false,
            failures: [{ check: 'run', message: error.message }],
            skillLoaded: false,
            toolCalls: 0,
            blockedCalls: 0,
            inputTokens: 0,
            outputTokens: 0,
            workspaceDir: ''
        })
        logNow(`运行失败：${error.message}`)
        const accountBlocked = /AccountOverdue|overdue balance|insufficient/i.test(String(error.message))
        if (accountBlocked) {
            logNow('模型账户无法计费，停止后续题目。')
            break
        }
    }
}

writeReport(results, reportDir)
const passedCount = results.filter((result) => result.passed).length
logNow(`\n完成 ${passedCount}/${results.length}。报告：${reportDir}`)

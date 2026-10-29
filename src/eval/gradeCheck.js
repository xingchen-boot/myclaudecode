import fs from 'fs'
import os from 'os'
import path from 'path'
import { gradeTask } from './grade.js'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frontcode-grade-'))
const originalDir = path.join(root, 'original')
const workspaceDir = path.join(root, 'workspace')
fs.mkdirSync(originalDir, { recursive: true })
fs.mkdirSync(workspaceDir, { recursive: true })
fs.writeFileSync(path.join(originalDir, 'style.css'), 'button { color: blue; }\n', 'utf8')
fs.writeFileSync(path.join(workspaceDir, 'style.css'), 'button { color: blue; }\n', 'utf8')
fs.writeFileSync(path.join(workspaceDir, 'index.html'), '<button>保存</button>\n', 'utf8')

const passed = gradeTask({
    workspaceDir,
    originalDir,
    expectConfig: {
        skill: 'dev-simple',
        checks: [
            { type: 'fileContains', path: 'index.html', text: '保存' },
            { type: 'fileUnchanged', path: 'style.css' },
            { type: 'skillLoaded', skill: 'dev-simple' }
        ]
    },
    messages: [
        {
            role: 'assistant',
            tool_calls: [{ id: 'call-1', function: { name: 'skill', arguments: '{"skillpath":"dev-simple/SKILL.md"}' } }]
        },
        { role: 'tool', tool_call_id: 'call-1', content: 'skill的内容为:简单需求' }
    ]
})

if (!passed.passed || !passed.skillLoaded || passed.toolCalls !== 1) {
    console.error('通过样例验收失败', passed)
    process.exit(1)
}

const previewPassed = gradeTask({
    workspaceDir,
    originalDir,
    expectConfig: {
        skill: 'dev-complex',
        checks: [
            { type: 'debuggerClean' },
            { type: 'toolCalled', tool: 'diff_pic' }
        ]
    },
    messages: [
        {
            role: 'assistant',
            tool_calls: [
                { id: 'call-debug', function: { name: 'debugger_page', arguments: '{"url":"http://127.0.0.1"}' } },
                { id: 'call-diff', function: { name: 'diff_pic', arguments: '{"design":"design.png","screenshot":"shot.png"}' } }
            ]
        },
        { role: 'tool', tool_call_id: 'call-debug', content: '测试结果如下：{"success":true}' },
        { role: 'tool', tool_call_id: 'call-diff', content: '布局一致' }
    ]
})

if (!previewPassed.passed) {
    console.error('调试和对比验收失败', previewPassed)
    process.exit(1)
}

const failed = gradeTask({
    workspaceDir,
    originalDir,
    expectConfig: {
        skill: 'dev-simple',
        checks: [{ type: 'fileContains', path: 'index.html', text: '不存在的文字' }]
    },
    messages: []
})

if (failed.passed || failed.failures.length !== 1) {
    console.error('失败样例没有被标出', failed)
    process.exit(1)
}

fs.rmSync(root, { recursive: true, force: true })
console.log('grade checks passed')

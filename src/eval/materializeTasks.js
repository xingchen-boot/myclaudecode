import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const tasksRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../eval/tasks')

const tasks = [
    {
        id: 'simple-01-button-text',
        skill: 'dev-simple',
        task: '把按钮文字从「提交」改成「保存」。只改这一处。',
        files: { 'index.html': '<button>提交</button>\n' },
        checks: [
            { type: 'fileContains', path: 'index.html', text: '保存' },
            { type: 'fileNotContains', path: 'index.html', text: '提交' }
        ]
    },
    {
        id: 'simple-02-title',
        skill: 'dev-simple',
        task: '把页面标题从「旧标题」改成「会员中心」。',
        files: { 'index.html': '<title>旧标题</title>\n' },
        checks: [
            { type: 'fileContains', path: 'index.html', text: '会员中心' },
            { type: 'fileNotContains', path: 'index.html', text: '旧标题' }
        ]
    },
    {
        id: 'simple-03-color',
        skill: 'dev-simple',
        task: '把标题颜色从 red 改成 green。',
        files: { 'index.html': '<h1 style="color: red">标题</h1>\n' },
        checks: [{ type: 'fileContains', path: 'index.html', text: 'green' }, { type: 'fileNotContains', path: 'index.html', text: 'red' }]
    },
    {
        id: 'simple-04-placeholder',
        skill: 'dev-simple',
        task: '把输入框提示从「请输入」改成「请输入邮箱」。',
        files: { 'index.html': '<input placeholder="请输入">\n' },
        checks: [{ type: 'fileContains', path: 'index.html', text: '请输入邮箱' }]
    },
    {
        id: 'simple-05-list-item',
        skill: 'dev-simple',
        task: '在列表里追加一项「香蕉」，不要删掉已有项。',
        files: { 'index.html': '<ul>\n<li>苹果</li>\n</ul>\n' },
        checks: [
            { type: 'fileContains', path: 'index.html', text: '香蕉' },
            { type: 'fileContains', path: 'index.html', text: '苹果' }
        ]
    },
    {
        id: 'simple-06-image-alt',
        skill: 'dev-simple',
        task: '给图片补上 alt，文字是「头像」。',
        files: { 'index.html': '<img src="avatar.png">\n' },
        checks: [{ type: 'fileContains', path: 'index.html', text: 'alt="头像"' }]
    },
    {
        id: 'simple-07-greeting',
        skill: 'dev-simple',
        task: '把脚本里的提示文字从「你好」改成「欢迎」。',
        files: { 'main.js': 'const message = "你好"\n' },
        checks: [
            { type: 'fileContains', path: 'main.js', text: '欢迎' },
            { type: 'fileNotContains', path: 'main.js', text: '你好' }
        ]
    },
    {
        id: 'simple-08-card-class',
        skill: 'dev-simple',
        task: '给这个 div 加上 class="card"。',
        files: { 'index.html': '<div>内容</div>\n' },
        checks: [{ type: 'fileContains', path: 'index.html', text: 'class="card"' }]
    },
    {
        id: 'simple-09-link-text',
        skill: 'dev-simple',
        task: '把链接文字从「首页」改成「主页」，地址不要变。',
        files: { 'index.html': '<a href="/home">首页</a>\n' },
        checks: [
            { type: 'fileContains', path: 'index.html', text: '主页' },
            { type: 'fileContains', path: 'index.html', text: 'href="/home"' },
            { type: 'fileNotContains', path: 'index.html', text: '首页' }
        ]
    },
    {
        id: 'simple-10-keep-style',
        skill: 'dev-simple',
        task: '把按钮文字改成「确定」。style.css 不要改。',
        files: {
            'index.html': '<button>取消</button>\n',
            'style.css': 'button { color: blue; }\n'
        },
        checks: [
            { type: 'fileContains', path: 'index.html', text: '确定' },
            { type: 'fileUnchanged', path: 'style.css' }
        ]
    },
    {
        id: 'complex-01-about-section',
        skill: 'dev-complex',
        task: '增加一个 id 为 about 的区块，标题是「关于我们」。并在 style.css 里给 #about 设置 margin: 16px。',
        files: {
            'index.html': '<main>\n</main>\n',
            'style.css': 'body { margin: 0; }\n'
        },
        checks: [
            { type: 'fileContains', path: 'index.html', text: 'id="about"' },
            { type: 'fileContains', path: 'index.html', text: '关于我们' },
            { type: 'fileContains', path: 'style.css', text: '#about' },
            { type: 'fileContains', path: 'style.css', text: '16px' }
        ]
    },
    {
        id: 'complex-02-render-function',
        skill: 'dev-complex',
        task: '让页面引用 main.js。main.js 里要有函数 render，并把「列表」写进 id 为 app 的节点。',
        files: {
            'index.html': '<div id="app"></div>\n',
            'main.js': '\n'
        },
        checks: [
            { type: 'fileContains', path: 'index.html', text: 'main.js' },
            { type: 'fileContains', path: 'main.js', text: 'function render' },
            { type: 'fileContains', path: 'main.js', text: '列表' }
        ]
    },
    {
        id: 'complex-03-login-form',
        skill: 'dev-complex',
        task: '做一个登录表单，包含邮箱输入框和密码输入框，提交按钮文字是「登录」。style.css 给 form 加 padding: 12px。',
        files: {
            'index.html': '<body>\n</body>\n',
            'style.css': '\n'
        },
        checks: [
            { type: 'fileContains', path: 'index.html', text: 'type="email"' },
            { type: 'fileContains', path: 'index.html', text: 'type="password"' },
            { type: 'fileContains', path: 'index.html', text: '登录' },
            { type: 'fileContains', path: 'style.css', text: 'padding: 12px' }
        ]
    },
    {
        id: 'complex-04-counter',
        skill: 'dev-complex',
        task: '页面放一个 id 为 count 的按钮，文字是「次数」。main.js 里用 let count = 0，并在点击时把次数加一。',
        files: {
            'index.html': '<body>\n</body>\n',
            'main.js': '\n'
        },
        checks: [
            { type: 'fileContains', path: 'index.html', text: 'id="count"' },
            { type: 'fileContains', path: 'index.html', text: '次数' },
            { type: 'fileContains', path: 'main.js', text: 'let count = 0' },
            { type: 'fileContains', path: 'main.js', text: 'count' }
        ]
    },
    {
        id: 'complex-05-about-page',
        skill: 'dev-complex',
        task: '新建 about.html，里面有标题「关于」。index.html 增加指向 about.html 的链接，文字是「关于」。',
        files: { 'index.html': '<nav>\n</nav>\n' },
        checks: [
            { type: 'fileContains', path: 'about.html', text: '关于' },
            { type: 'fileContains', path: 'index.html', text: 'about.html' },
            { type: 'fileContains', path: 'index.html', text: '关于' }
        ]
    }
]

const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

tasks.push(
    {
        id: 'complex-06-preview-title',
        skill: 'dev-complex',
        task: '把标题从「你好」改成「欢迎」，然后看看效果。',
        files: { 'index.html': '<h1>你好</h1>\n' },
        checks: [
            { type: 'fileContains', path: 'index.html', text: '欢迎' },
            { type: 'fileNotContains', path: 'index.html', text: '你好' },
            { type: 'debuggerClean' }
        ]
    },
    {
        id: 'complex-07-design-title',
        skill: 'dev-complex',
        hasDesign: true,
        task: '按设计图把标题从「你好」改成「欢迎」，然后看看效果。设计图是 design.png。',
        files: { 'index.html': '<h1>你好</h1>\n' },
        binaryFiles: { 'design.png': tinyPng },
        checks: [
            { type: 'fileContains', path: 'index.html', text: '欢迎' },
            { type: 'fileNotContains', path: 'index.html', text: '你好' },
            { type: 'debuggerClean' },
            { type: 'toolCalled', tool: 'diff_pic' }
        ]
    }
)

for (const task of tasks) {
    const taskDir = path.join(tasksRoot, task.id)
    const workspaceDir = path.join(taskDir, 'workspace')
    fs.mkdirSync(workspaceDir, { recursive: true })
    fs.writeFileSync(path.join(taskDir, 'task.md'), `${task.task}\n`, 'utf8')
    fs.writeFileSync(path.join(taskDir, 'rubric.md'), '自动验收看 expect.json。界面是否好看不计入这版分数。\n', 'utf8')
    fs.writeFileSync(path.join(taskDir, 'expect.json'), JSON.stringify({
        type: task.skill === 'dev-simple' ? 'simple' : 'complex',
        skill: task.skill,
        hasDesign: Boolean(task.hasDesign),
        checks: [{ type: 'skillLoaded', skill: task.skill }, ...task.checks]
    }, null, 2), 'utf8')
    for (const [fileName, content] of Object.entries(task.files)) {
        fs.writeFileSync(path.join(workspaceDir, fileName), content, 'utf8')
    }
    for (const [fileName, base64Content] of Object.entries(task.binaryFiles || {})) {
        fs.writeFileSync(path.join(workspaceDir, fileName), Buffer.from(base64Content, 'base64'))
    }
}

console.log(`已写入 ${tasks.length} 道题`)

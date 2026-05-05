# 技术选型文档

## 一、技术选型分析

### 1.1 现有技术栈
- Node.js + ESModule
- readline（终端交互）
- openai（AI 接口）
- chalk（终端颜色）
- ora（加载提示）
- marked + marked-terminal（Markdown 渲染）

### 1.2 新增需求的技术选型

**终端 UI 展示**：
- 使用 **chalk** 绘制彩色边框和高亮
- 使用 **readline** 的 `cursorTo` 和 `clearLine` 控制光标位置
- 不引入新的 UI 库，保持轻量

**键盘事件监听**：
- 使用 Node.js 原生的 `process.stdin` 监听键盘事件
- 使用 `readline` 的 `emitKeypressEvents` 获取按键信息

**文件系统操作**：
- 使用 Node.js 原生的 `fs` 模块读取目录和文件内容
- 使用 `path` 模块处理路径

**实时筛选**：
- 使用 JavaScript 原生的字符串匹配方法
- 不引入额外的模糊搜索库

## 二、代码逻辑设计

### 2.1 模块划分

```
src/
├── app.js                    # 主入口，修改以支持新功能
├── utils/
│   ├── init.js              # 欢迎界面
│   ├── logger.js            # 日志输出
│   ├── fsHandle.js          # 文件操作
│   ├── pathUtils.js         # 路径工具
│   ├── selector.js          # 新增：选择器组件（指令/文件列表）
│   └── commandParser.js     # 新增：指令解析器
├── commands/
│   └── index.js             # 新增：指令定义和执行
├── request/
│   └── index.js             # AI 请求
└── docs/
    └── system-prompt.md     # 系统提示词
```

### 2.2 核心模块设计

#### 2.2.1 selector.js - 选择器组件

**功能**：
- 显示选择列表（指令或文件）
- 处理键盘事件（上下箭头、Tab、Esc、输入筛选）
- 返回选中项

**主要函数**：
```javascript
// 显示选择列表并处理交互
async function showSelector({
  title,           // 列表标题
  items,           // 列表项数组 [{name, description}]
  onSelect,        // 选中回调
  onCancel         // 取消回调
})

// 渲染列表 UI
function renderList(items, selectedIndex, filterText)

// 处理键盘输入
function handleKeyPress(key, items, selectedIndex, filterText)
```

#### 2.2.2 commandParser.js - 指令解析器

**功能**：
- 解析用户输入中的指令
- 提取文件引用
- 执行指令并返回结果

**主要函数**：
```javascript
// 解析用户输入
function parseInput(input)

// 提取文件引用
function extractFileReferences(input)

// 执行指令
async function executeCommand(command, args)
```

#### 2.2.3 commands/index.js - 指令定义

**功能**：
- 定义所有可用指令
- 实现指令执行逻辑

**指令列表**：
```javascript
const commands = {
  '/help': { description: '显示帮助信息', handler: showHelp },
  '/clear': { description: '清空对话历史', handler: clearHistory },
  '/history': { description: '查看对话历史', handler: showHistory },
  '/exit': { description: '退出程序', handler: exitProgram },
  '/quit': { description: '退出程序', handler: exitProgram },
  '/model': { description: '切换模型', handler: switchModel },
  '/config': { description: '查看配置信息', handler: showConfig }
}
```

### 2.3 交互流程设计

#### 2.3.1 指令选择流程

```
用户输入 /
    ↓
检测到 / 前缀且无空格
    ↓
调用 showSelector 显示指令列表
    ↓
用户选择指令（Tab/Enter）
    ↓
列表消失，指令填入输入框
    ↓
用户确认发送（Enter）
    ↓
parseInput 解析指令
    ↓
executeCommand 执行指令
```

#### 2.3.2 文件引用流程

```
用户输入 @
    ↓
检测到 @ 前缀且无空格
    ↓
读取项目文件列表
    ↓
调用 showSelector 显示文件列表
    ↓
用户选择文件（Tab/Enter）
    ↓
列表消失，文件路径填入输入框
    ↓
用户确认发送（Enter）
    ↓
extractFileReferences 提取文件路径
    ↓
读取文件内容作为上下文
    ↓
发送给 AI（包含文件内容）
```

### 2.4 关键技术实现

#### 2.4.1 终端 UI 渲染

```javascript
// 使用 chalk 绘制边框
function drawBorder(width) {
  return chalk.blue('┌' + '─'.repeat(width) + '┐')
}

// 渲染列表项
function renderItem(item, isSelected) {
  const prefix = isSelected ? chalk.green('>') : ' '
  const text = isSelected ? chalk.white(item.name) : chalk.gray(item.name)
  return `${prefix} ${text}`
}
```

#### 2.4.2 键盘事件处理

```javascript
// 启用键盘事件监听
process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.setEncoding('utf8')

// 监听按键
process.stdin.on('data', (key) => {
  // 处理特殊按键（上下箭头、Tab、Esc）
  if (key === '[A') { /* 上箭头 */ }
  if (key === '[B') { /* 下箭头 */ }
  if (key === '\t') { /* Tab */ }
  if (key === '') { /* Esc */ }
  // 处理普通字符输入
  if (key.length === 1) { /* 筛选输入 */ }
})
```

#### 2.4.3 文件列表读取

```javascript
import fs from 'fs'
import path from 'path'

// 递归读取目录文件
function getFileList(dir, basePath = '') {
  const files = []
  const items = fs.readdirSync(dir)
  
  for (const item of items) {
    const fullPath = path.join(dir, item)
    const relativePath = path.join(basePath, item)
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory()) {
      // 递归读取子目录
      files.push(...getFileList(fullPath, relativePath))
    } else {
      files.push({ name: relativePath, path: fullPath })
    }
  }
  
  return files
}
```

#### 2.4.4 实时筛选

```javascript
// 根据输入筛选列表
function filterItems(items, filterText) {
  if (!filterText) return items
  
  return items.filter(item => 
    item.name.toLowerCase().includes(filterText.toLowerCase())
  )
}
```

## 三、依赖分析

### 3.1 现有依赖（无需新增）
- **chalk**: 终端颜色输出
- **fs**: 文件系统操作
- **path**: 路径处理
- **readline**: 终端交互

### 3.2 无需新增的依赖
- 不需要引入 inquirer（太重）
- 不需要引入 blessed（太重）
- 不需要引入 fuzzy-search（简单字符串匹配即可）

### 3.3 可能需要的优化
- 可以考虑使用 `fast-glob` 优化文件扫描（但当前需求下原生 fs 够用）

## 四、与现有代码的集成

### 4.1 修改 app.js

**主要修改点**：
1. 引入新的模块（selector.js, commandParser.js）
2. 修改 `promptUser` 函数，支持指令和文件引用
3. 添加指令解析逻辑
4. 添加文件内容读取逻辑

**修改后的流程**：
```javascript
async function promptUser() {
  // 获取用户输入（支持选择器）
  const input = await getUserInput()
  
  // 解析指令
  const parsed = parseInput(input)
  
  if (parsed.isCommand) {
    // 执行指令
    await executeCommand(parsed.command, parsed.args)
  } else {
    // 处理文件引用
    const processedInput = await processFileReferences(parsed.input)
    
    // 发送给 AI
    const aiResponse = await getAIResponse({ openai, messages: [...messages, processedInput] })
    
    // 显示回复
    // ...
  }
  
  // 继续下一轮
  promptUser()
}
```

### 4.2 保持兼容性

- 保留原有的 `exit` 和 `quit` 命令处理
- 保留原有的对话历史保存逻辑
- 保留原有的 Markdown 渲染功能

## 五、实现优先级

### 5.1 第一阶段：基础框架
1. 创建 `selector.js` 选择器组件
2. 创建 `commandParser.js` 指令解析器
3. 创建 `commands/index.js` 指令定义

### 5.2 第二阶段：指令功能
1. 实现指令选择 UI
2. 实现指令解析和执行
3. 集成到 app.js

### 5.3 第三阶段：文件引用功能
1. 实现文件列表读取
2. 实现文件选择 UI
3. 实现文件内容读取和上下文注入

### 5.4 第四阶段：优化和完善
1. 优化 UI 渲染
2. 添加错误处理
3. 完善边界情况处理

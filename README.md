# FrontCode - AI 前端开发助手

一个运行在终端中的 AI 前端开发助手，类似于 Claude Code。帮助开发者在终端中与 AI 对话，完成前端代码编写、调试、截图对比等开发任务。

## 功能特性

### 核心能力
- **智能对话** - 基于 OpenAI 接口，理解开发需求并生成代码
- **代码写入** - 通过 `write_file` 工具直接将代码写入项目文件
- **浏览器调试** - 自动打开浏览器加载页面，检测控制台错误并截图
- **截图对比** - 将页面截图与设计图进行 UI 差异对比
- **RAG 检索** - 向量化项目文档，支持语义搜索
- **记忆系统** - 记录项目特点和用户偏好，提供个性化辅助

### 内置工具

| 工具 | 说明 |
|------|------|
| `bash` | 执行 shell 命令（支持后台运行长时间任务） |
| `read_file` | 读取文件内容 |
| `write_file` | 写入代码到文件 |
| `glob` | 按模式匹配查找文件 |
| `grep` | 搜索文件内容 |
| `debugger_page` | 打开浏览器调试页面并截图 |
| `diff_pic` | 对比设计图和截图差异 |
| `memory_save` | 保存记忆内容 |
| `memory_get` | 读取记忆内容 |
| `confirm` | 向用户确认操作 |
| `select` | 提供选项列表 |

### 指令系统

| 指令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清空对话历史 |
| `/history` | 查看对话历史 |
| `/model` | 查看当前模型 |
| `/config` | 查看配置信息 |
| `/vector` | 向量化文档存入数据库 |
| `/memory` | 生成记忆 |
| `/exit` | 退出程序 |

支持自定义指令：在 `.front/commands/` 目录下创建 md 文件即可。

## 快速开始

### 环境要求

- Node.js >= 18
- npm 或 yarn

### 安装

```bash
# 克隆项目
git clone https://github.com/xingchen-boot/myclaudecode.git
cd myclaudecode

# 安装依赖
npm install
```

### 配置

在项目根目录创建 `.env` 文件：

```env
# OpenAI API 配置
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
```

或在用户目录 `~/.front/settings.json` 中配置：

```json
{
  "apiKey": "your_api_key",
  "baseURL": "https://api.openai.com/v1",
  "model": "gpt-4o"
}
```

### 启动

```bash
node src/app.js
```

或通过 npm scripts（如已配置）：

```bash
npm start
```

## 使用示例

### 基本对话

```
> 帮我写一个 React 的 TodoList 组件
```

AI 会分析需求，生成代码并通过 `write_file` 写入项目。

### 引用文件

输入 `@` 后按 Tab 可选择项目中的文件：

```
> @src/App.tsx 帮我添加一个路由配置
```

### 引用图片

输入 `#` 后按 Tab 可选择设计图，或复制图片后自动检测插入：

```
> #design.png 帮我还原这个页面
```

### 调试流程

```
> 帮我开发一个登录页面
```

AI 会按以下流程执行：
1. 扫描相关代码
2. 使用 `write_file` 写入代码
3. 使用 `confirm` 确认
4. 使用 `debugger_page` 打开浏览器调试
5. 使用 `diff_pic` 对比设计图（如有）

## 项目结构

```
frontcode/
├── src/
│   ├── app.js              # 应用入口
│   ├── commands/           # 指令系统
│   │   └── index.js
│   ├── docs/               # 文档模板
│   │   └── systemDoc.md    # 系统提示词
│   ├── request/            # AI 接口封装
│   │   └── index.js
│   ├── tools/              # 工具系统
│   │   ├── index.js
│   │   └── local/          # 本地工具实现
│   │       ├── bash.js
│   │       ├── read_file.js
│   │       ├── write_file.js
│   │       ├── debugger_page.js
│   │       ├── diff_pic.js
│   │       └── ...
│   └── utils/              # 工具函数
│       ├── clipboardUtils.js
│       ├── commandParser.js
│       ├── debuggerUtils.js
│       ├── inputHandler.js
│       ├── ragHandle.js
│       └── ...
├── package.json
└── README.md
```

## 自定义指令

在项目或用户目录下创建自定义指令：

```
.front/commands/
├── comms/
│   ├── component.md      # 指令 /comms:component
│   └── api/
│       └── fetch.md      # 指令 /comms:api:fetch
```

md 文件内容会作为指令发送给 AI 处理。

## 许可证

ISC

## 作者

星辰靴

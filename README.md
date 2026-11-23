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

## 几个关键取舍（附代码位置）

写这类 Agent 的难点不在「调通一次」，而在「长期跑不崩」。下面四处都是踩过坑之后的改法，代码可以直接点进去看：

| 取舍 | 为什么 | 代码 |
| --- | --- | --- |
| **工具按轮选，不是全量注入** | 11 个工具的函数定义本身就吃掉大量 prompt；每轮只送当前任务真需要的那几个 | `src/tools/selectTurnTools.js` |
| **上下文压缩可回退** | 压缩时保留会话锚点（`anchorId` / `firstKeptEntryId`），原始消息不丢，需要时能回看；超阈值才摘要 + 留最近窗口 | `src/utils/sessionStore.js`（`planCompaction` / `compactMessages`） |
| **危险操作分级审批** | 只读工具并发跑，写工具串行 + 人工确认；评测报告里会统计每次运行被拦了几次 | `src/tools/local/dangerApproval.js`、`confirm.js` |
| **不可信文本隔离** | 文件、网页、工具输出一律当「数据」不当「指令」，避免内容里的伪指令被执行 | `src/utils/untrustedText.js` |

## 评测

评测分成两层，一层管「这个 Agent 跑得好不好」，一层管「这类 Agent 到底算不算成功」。

### 1. 端到端题库评测（JS，跑在本项目上）

每个任务在独立 workspace 里跑完整 Agent 流程，再用 `expect.json` 对**产物文件**做断言，而不是让模型自己说做完了。

- 题库 17 题：10 个简单改写 + 7 个复杂任务（其中 2 个是「给一张设计图，还原页面」）
- 断言 6 类：`skillLoaded` / `fileContains` / `fileNotContains` / `fileUnchanged` / `toolCalled` / `debuggerClean`
- 指标：通过率、单题工具调用次数、**危险操作拦截次数**、输入/输出 token

最近一次运行（2026-10-26，取 15 题）：

| 指标 | 数值 |
| --- | --- |
| 通过率 | **14 / 15（93%）** |
| 输入 token | 861,065 |
| 输出 token | 30,540 |
| 单题工具调用 | 5 ~ 13 次 |
| 单题危险操作拦截 | 0 ~ 4 次 |

唯一失败例是 `simple-06-image-alt`：要求给图片补 `alt="头像"`，Agent 改了别的地方、调了 13 次工具，就是没写这个属性。这条失败例故意留着 —— 报告不是 100% 通过才可信，断言能抓住真实失败才可信。

完整明细、断言口径、复跑方式见 [`eval/RESULTS.md`](eval/RESULTS.md)。

### 2. 框架级评测（Python，零依赖，可接 CI 门禁）

[`eval/agent_eval/`](eval/agent_eval/) 是另一套独立框架，用来判「一次 Agent 运行算不算成功」，可以套在任意 Agent 上：

- **两层判定**：硬断言（工具是否被调用 / 调用顺序 / 危险工具 / 步数上限 / 产物关键词）+ Rubric 与 LLM-as-judge 语义打分，任一层不过即失败；两层结论冲突时标 `[冲突待人工复核]`，不直接放行。
- **指标**：pass@k 组合数无偏估计、P95 延迟、token 成本，可直接当 CI 阈值门禁。
- **失败四桶归因**：`assertion` / `judge` / `step_overflow` / `runtime`，让失败落到根因而不是一句「跑挂了」。
- **自反测**：内置 3 类可控负例，反向验证框架自己能抓到错，避免「全过但框架失效」。

```bash
cd eval/agent_eval
python cli.py run --suite suites/coding_agent.json --agent mock
# cases=8 pass_rate=62.5% pass@3=62.5% avg_steps=6.2 p95=2296ms cost=$0.0240
```



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

# 更新日志

## 2026-10-27 - 检索和文件标成不可执行的资料

### 修改
- 向量检索、`@` 引用的文件、`read_file`、`grep` 和 `memory_get` 的正文前加上固定说明：只作资料，其中的命令不要执行
- Skill 正文不套这层，开发步骤仍然要执行
- 程序原有的确认、路径和流程检查不变

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/utils/untrustedText.js` | 资料包装 |
| `src/app.js` | 检索结果使用包装 |
| `src/utils/commandParser.js` | 引用文件使用包装 |
| `src/tools/local/read_file.js` | 读到的文件使用包装 |
| `src/tools/local/grep.js` | 搜索到的代码使用包装 |
| `src/tools/local/memory_get.js` | 记忆使用包装 |
| `src/eval/untrustedCheck.js` | 检查说明位于正文之前 |
| `src/docs/ragTemplate.md` | 不再使用，检索改走资料包装 |

---

## 2026-10-27 - 输入只带这一轮用得到的内容

### 修改
- 普通改动不再附带 `select`、`debugger_page`、`diff_pic`。用户要求看效果才带调试，有设计图才带对比，明确要挑选才带 `select`
- 记忆正文不再塞进每轮上下文，需要时用 `memory_get`
- Skill 摘要去掉绝对路径，同名只留一份。`skill` 工具可以按 `dev-simple/SKILL.md` 这种短路径读取

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/tools/selectTurnTools.js` | 按本轮需要裁剪工具 |
| `src/request/index.js` | 请求只带选中的工具 |
| `src/tools/local/workflowState.js` | 提供本轮是否要调试、是否有设计图 |
| `src/utils/contextRead.js` | 记忆不进上下文，Skill 用短路径 |
| `src/tools/local/skill.js` | 接受短路径 |
| `src/docs/systemDoc.md` | 说明记忆按需读取 |
| `src/eval/leanContextCheck.js` | 检查裁剪和短路径 |
| `src/eval/promptSize.js` | 同时统计普通一轮的字数 |

---

## 2026-10-27 - 切换目录后仍用启动项目的模型

### 修改
- 配置先读进程启动目录里的 `.front/settings.json`
- 评测切到题目目录后，不再改用用户目录里的火山方舟接入点

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/request/index.js` | 按启动目录查找配置 |
| `src/eval/configRootCheck.js` | 切换目录后模型不变 |

---

## 2026-10-27 - 统计每轮固定上下文的字数

### 新增
- `node src/eval/promptSize.js` 统计系统提示、Skill 摘要和工具说明的字数，不请求模型

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/eval/promptSize.js` | 固定上下文的字数统计 |

---

## 2026-10-26 - 空上下文不再发给模型

### 修改
- 没有用户要求、项目要求和记忆时，不再发一条空白说明
- 检索没有结果时，不再发一条空消息
- 用户要求和记忆在每次提问前重新读取，不再停在启动时的那一份

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/utils/contextRead.js` | 只拼接有内容的段落 |
| `src/app.js` | 每轮组装上下文 |
| `src/eval/runTask.js` | 评测同样跳过空检索 |
| `src/eval/contextCheck.js` | 空内容不占消息 |
| `src/docs/userContext.md` | 删除不再使用的固定模板 |

---

## 2026-10-26 - 缩短每轮都带上的系统提示

### 修改
- 系统提示只保留角色、拒绝范围、如何选择 skill、记忆的短规则和环境
- 逐步执行、调试和对比设计图的细节仍在 dev-simple、dev-complex 正文里，用到才加载
- 搜索和调试工具的说明去掉重复段落

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/docs/systemDoc.md` | 缩短常驻提示 |
| `src/tools/local/grep.js` | 缩短工具说明 |
| `src/tools/local/debugger_page.js` | 缩短工具说明 |
| `src/eval/promptCheck.js` | 检查提示长度和必要句子 |

---

## 2026-10-26 - 长对话压缩成摘要节点

### 修改
- 发给模型的对话超过大约 4.8 万字时，更早的内容压成一条摘要
- 摘要是追加的压缩记录，旧消息不删除。最近一段原文仍然带上
- 摘要请求失败时继续用原文。欠费不会为了压缩反复请求

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/utils/sessionStore.js` | 压缩记录和发给模型的视图 |
| `src/request/index.js` | 请求前尝试压缩 |
| `src/eval/compactCheck.js` | 摘要替换原文、文件仍保留旧消息 |

---

## 2026-10-26 - 接口短暂失败会重试

### 修改
- 限流、超时、连接中断和 5xx 会按 2 秒、4 秒、8 秒重试，最多 3 次
- 欠费、密钥无效、模型不存在这类错误立刻失败，不再重复请求
- 本地代码抛出的异常也不重试

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/request/apiRetry.js` | 错误分类和重试间隔 |
| `src/request/index.js` | 对话请求走重试 |
| `src/eval/apiRetryCheck.js` | 欠费不重试、5xx 会重试 |

---

## 2026-10-26 - 向量库能加载，并补上调试题

### 修改
- 重新安装 `@lancedb/lancedb-win32-x64-msvc`，补上缺失的原生文件，LanceDB 可以加载
- 增加两道复杂题：`complex-06-preview-title` 要求看看效果，`complex-07-design-title` 带设计图并要求对比
- 验收可以检查 `diff_pic` 是否成功调用。这两道题还没有跑模型

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `package.json` | 声明 Windows 版 LanceDB 原生包 |
| `src/eval/materializeTasks.js` | 两道调试题和设计图 |
| `src/eval/grade.js` | `toolCalled` 验收 |
| `src/eval/gradeCheck.js` | 调试和对比的样例 |
| `eval/tasks/complex-06-preview-title` | 看看效果 |
| `eval/tasks/complex-07-design-title` | 设计图对比 |

---

## 2026-10-26 - 调试记录只在本轮有效

### 修改
- 每一轮新的用户消息都会清空「写过文件」「调试过页面」的记录
- 上一轮写过代码，这一轮不能直接调用 `debugger_page` 或 `diff_pic`
- 简单需求即使用户说看效果，也不会放行调试
- 复杂需求只有用户要求看效果、并且本轮写完再读回之后，才允许调试；调试报错回到写入，不能去对比设计图

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/tools/local/workflowState.js` | 新一轮清空写入和调试记录 |
| `src/tools/local/toolState.js` | 记录只在本轮有效 |
| `src/docs/systemDoc.md` | 简单需求不调试 |
| `src/eval/workflowCheck.js` | 调试和设计图对比的步骤检查 |

---

## 2026-10-26 - 加载 Skill 时保留本轮进度

### 修改
- 同一轮里，加载 `dev-simple` 或 `dev-complex` 之前已经读过文件的，加载后仍然算定位完成
- 已经 `confirm` 得到 yes 的，加载后直接进入写入，不必再定位和确认一次
- 只定位、还没确认的，加载后停在定位，`confirm` 可以直接调用
- 已经进入写入或更后步骤时，再次加载 skill 不把步骤退回去

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/tools/local/workflowState.js` | 加载 skill 时保留定位和确认 |
| `src/docs/systemDoc.md` | 说明进度不会退回起点 |
| `src/docs/skills/dev-simple/SKILL.md` | 已确认则从写入开始 |
| `src/docs/skills/dev-complex/SKILL.md` | 已确认则从写入开始 |
| `src/eval/workflowCheck.js` | 进度保留检查 |

---

## 2026-10-26 - 会话按节点追加，回退只移动指针

### 修改
- 会话改成 jsonl，每条消息是一个节点，带 `id` 和 `parentId`
- 当前上下文是从根走到叶指针的一条链。`/undo` 把叶指针移到上一条用户消息之前，旧节点不删除
- `/redo` 在还没写新消息时，把指针移回刚才放弃的那一支
- 旧的整份 json 快照仍能读，下一次保存时写成新的 jsonl

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/utils/sessionStore.js` | 会话树、叶指针、undo/redo |
| `src/utils/fsHandle.js` | 保存改为追加节点 |
| `src/commands/index.js` | `/undo`、`/redo` |
| `src/app.js` | 启动提示 |
| `src/eval/sessionCheck.js` | 回退、分支保留和重载检查 |

---

## 2026-10-26 - 修改失败时带回原文

### 修改
- `edit_file` 匹配失败时返回文件原文，方便下一次按完全一致的片段重试
- 写入步骤里修改失败时，提示继续调用 `edit_file` 或 `write_file`，不要改去调用 `confirm`
- 以「错误」开头的工具结果在 trace 里记为失败，并保留原因

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/tools/local/edit_file.js` | 匹配失败时附上原文 |
| `src/request/index.js` | 写入步骤的失败提示 |
| `src/tools/index.js` | 失败结果写入 trace |

---

## 2026-10-26 - 流程拦截不计入连续失败

### 修改
- 工具返回「已拦截」时不再累计失败次数，也不会因此停止本轮
- 拦截结果会提示模型改调用当前允许的工具

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/request/index.js` | 区分流程拦截和工具故障 |

---

## 2026-10-26 - 固定题目评测

### 新增
- **评测运行器**：`npm run eval` 在每道题的干净副本里跑一轮对话，`confirm` 自动同意
- **验收**：按 `expect.json` 检查文件内容、不该改的文件、有没有加载对应 Skill、调试是否无报错
- **用量**：模型返回的输入和输出 token 会累计进报告
- **题目**：10 道简单改动、5 道多文件改动，放在 `eval/tasks`
- 进度立刻输出。模型账户无法计费时停止后续题目，不再继续请求

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/eval/cli.js` | 跑题并写出 JSON 和 Markdown 报告 |
| `src/eval/runTask.js` | 复制工作区并调用现有 Agent |
| `src/eval/grade.js` | 验收规则 |
| `src/utils/usageCounter.js` | 累计 token |
| `src/request/index.js` | 记录用量，并限制单题工具轮数 |
| `src/tools/local/confirm.js` | 评测时自动确认 |

---

## 2026-10-26 - 工作流步骤拦截，并写入 trace

### 修改
- 开发工具按 Skill 步骤执行：先加载 `dev-simple` 或 `dev-complex`，再定位、确认、写入、读回
- 简单需求在读回后结束，调试和设计图对比会被拒绝
- 复杂需求只有本轮要求看效果才允许调试；调试报错会回到写入步骤；有设计图才允许对比
- 每条工具记录增加流程模式、执行前步骤、是否放行、执行后步骤
- 每条新的用户消息重置流程，上一轮的进度不能沿用

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/tools/local/workflowState.js` | 步骤状态和放行判断 |
| `src/tools/index.js` | 执行前拦截，执行后推进步骤 |
| `src/utils/toolTrace.js` | 记录步骤变化 |
| `src/app.js` | 每轮用户消息重置流程 |
| `src/tools/local/debugger_page.js` | 有控制台错误时不算调试完成 |
| `src/docs/systemDoc.md` | 系统提示与实际拦截顺序一致 |

---

## 2026-10-25 - Skill 路径限制、向量重建、MCP 启动等待

### 修改
- **skill 工具**：开发需求会按摘要加载 `dev-simple` 或 `dev-complex`；只能读取 skill 目录中的 `SKILL.md`
- **向量库**：全量 `/vector` 先删表再写入。密钥改为配置项 `embeddingApiKey`，不再写在源码里
- **MCP**：启动时等待连接，失败的服务会在终端打出名字
- **写文件**：`write_file` 和 `edit_file` 必须先有本轮 `confirm` 的 yes
- **Windows 命令**：PowerShell 以参数方式执行，命令不再拼进外层引号
- **会话文件**：一次启动只覆盖同一个历史文件

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/tools/local/skill.js` | 收紧说明和可读路径 |
| `src/utils/ragHandle.js` | 重建向量表，密钥改读配置 |
| `src/tools/mcp/index.js`、`src/app.js` | 汇报 MCP 连接失败 |
| `src/tools/local/write_file.js`、`edit_file.js` | 未确认则拒绝写入 |
| `src/tools/local/bash.js` | Windows 下改用参数执行 |
| `src/utils/fsHandle.js`、`sessionStore.js` | 同一次会话覆盖写入 |

---

## 2026-10-23 - 危险命令拦截、工具统计、MCP 熔断

### 新增功能
- **危险命令确认**：`bash` 遇到删除、覆盖或结束进程的命令时，本轮没有 `confirm` 的 yes 就拒绝执行，进程不会启动
- **工具调用记录**：每次工具调用追加到用户目录的 trace 文件，`/stats` 查看次数、成功率、失败和拦截
- **MCP 防护**：返回必须是文本，超过 8000 字截断；同一 MCP 工具连续失败 2 次后，60 秒内不再调用

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/tools/local/dangerApproval.js` | 危险命令判断和本轮确认状态 |
| `src/tools/local/bash.js` | 执行前拦截危险命令 |
| `src/tools/local/confirm.js` | 用户选择 yes 后记下确认 |
| `src/utils/toolTrace.js` | 调用记录、统计、MCP 文本校验和熔断 |
| `src/tools/index.js` | 执行工具时记日志并检查熔断 |
| `src/commands/index.js` | 新增 `/stats` |
| `src/app.js` | 每条新的用户消息清掉上一轮确认 |
| `src/docs/systemDoc.md` | 说明危险 bash 会被程序拒绝 |

---

## 2026-10-23 - 简单需求与复杂需求两个工作流 Skill

### 新增功能
- **dev-simple**：一两处明确修改的流程。先读，确认后再增量修改，不调试
- **dev-complex**：新页面、多文件、设计图或要求看效果时的流程。先确认改动清单，再写代码，按条件调试和对比设计图
- **自带 Skill 目录**：`src/docs/skills` 在任意工作目录启动时都会进入 skill 摘要

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/docs/skills/dev-simple/SKILL.md` | 简单需求工作流 |
| `src/docs/skills/dev-complex/SKILL.md` | 复杂需求工作流 |
| `src/utils/contextRead.js` | 启动时读取程序自带的 skills |
| `src/docs/systemDoc.md` | 开发需求先加载对应 skill 再执行 |

---

## 2026-10-23 - 增量修改、会话恢复、失败重试、分块与记忆上限

### 新增功能
- **增量修改文件**：新增 `edit_file`，按唯一原文片段替换，修改已有文件时不再整文件覆盖
- **会话恢复**：启动时自动载入最近一次对话；新增 `/resume`，不完整的工具调用不会被恢复
- **工具失败重试**：同一工具连续失败时先把错误交回模型反思，第 2 次仍失败则停止自动重试
- **MCP 超时与路径限制**：MCP 工具调用超过 30 秒即返回错误；`read_file`、`write_file`、`edit_file`、`glob`、`grep`、`diff_pic` 只能访问当前工作目录
- **RAG 分块**：文档切块从 40 字调整为 800 字、重叠 120 字，检索结果带上来源路径
- **记忆上限**：单份记忆超过 6000 字时，上下文只保留末尾，`memorySave` 拒绝超长内容并要求压缩
- **增量替换修正**：`edit_file` 不再把 `$` 当成替换符，CRLF 文件只改命中片段，不改整篇换行
- **记忆读历史**：生成记忆时只取最近一份完整会话的末尾记录，不再把每次快照拼在一起

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/tools/local/edit_file.js` | 新增增量修改工具 |
| `src/utils/sessionStore.js` | 读取并清理最近会话 |
| `src/utils/pathUtils.js` | 增加工作目录路径检查 |
| `src/request/index.js` | 工具连续失败后停止重试 |
| `src/tools/index.js` | MCP 调用 30 秒超时 |
| `src/utils/ragHandle.js` | 调整分块大小，检索结果带来源 |
| `src/utils/memoryUtils.js` | 记忆长度上限 |
| `src/app.js`、`src/commands/index.js` | 启动恢复会话，增加 `/resume` |
| `src/docs/systemDoc.md` | 改为优先使用 `edit_file`，补充记忆长度要求 |

---

## 2026-05-20 - 增强输入编辑功能

### 新增功能
- 支持左箭头/右箭头键移动光标
- 支持 Ctrl+A 光标移到开头
- 支持 Ctrl+E 光标移到末尾
- 支持 Ctrl+K 删除光标后的内容
- 支持 Ctrl+U 删除光标前的内容

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/utils/inputHandler.js` | 添加箭头键和快捷键支持 |

---

## 2026-05-20 - 自动切换视觉模型

### 新增功能
- 当消息包含图片时，自动切换到 `visionModel` 配置的模型
- 平常使用 `mimo-v2.5-pro`，有图片时自动使用 `mimo-v2.5`
- Spinner 提示会显示当前是否使用视觉模型

### 配置说明
在 `.front/settings.json` 中添加了 `visionModel` 字段：
```json
{
  "model": "mimo-v2.5-pro",
  "visionModel": "mimo-v2.5"
}
```

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `.front/settings.json` | 添加 visionModel 配置 |
| `src/request/index.js` | 检测图片内容，自动切换模型 |

---

## 2026-05-20 - 图片选择功能

### 新增功能
1. **# 图片选择器**
   - 用户输入 `#` 后按 Tab 可以选择 `.front/design/` 目录下的图片
   - 支持的图片格式：PNG、JPG、JPEG、GIF、WEBP、BMP
   - 选择行为与 `@` 文件选择器一致（Tab/Enter 都只是填充到输入框）

2. **Ctrl+V 粘贴图片**
   - 用户可以使用 Ctrl+V 从剪贴板粘贴图片
   - 粘贴的图片会自动保存到 `.front/design/` 目录
   - 自动生成唯一文件名（clipboard_时间戳.png）

3. **多模态消息支持**
   - 发送包含图片的消息时，自动使用 OpenAI Vision API 格式
   - 图片以 base64 编码格式发送给大模型

### 修改的文件
| 文件 | 修改内容 |
|------|----------|
| `src/utils/inputHandler.js` | 添加 # 触发逻辑和 Ctrl+V 粘贴功能 |
| `src/utils/selector.js` | 添加图片选择器，支持 type 参数区分不同选择器行为 |
| `src/utils/commandParser.js` | 添加图片引用解析和处理函数 |
| `src/utils/clipboardUtils.js` | 新建剪贴板工具，支持从 Windows 剪贴板获取图片 |
| `src/app.js` | 修改消息构建逻辑，支持多模态消息格式 |

### 新增目录
- `.front/design/` - 用于存放设计图片

### 使用方式
1. 将图片放入 `.front/design/` 目录
2. 输入 `#` 后按 Tab 选择图片
3. 或者使用 Ctrl+V 粘贴剪贴板中的图片
4. 在图片引用后添加需求描述，发送给大模型

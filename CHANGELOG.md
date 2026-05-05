# 更新日志

## 2026-05-05 - 实现自定义指令功能

### 新增功能
- **自定义指令支持**：从用户目录和项目目录加载自定义指令
  - 用户目录：`~/.front/commands/`
  - 项目目录：`.front/commands/`
  - 项目目录优先级高于用户目录
- **指令命名规则**：每个子文件夹是一个指令分组，文件夹内的md文件是指令内容
  - 例如：`.front/commands/comms/a/c.md` → 指令 `/a:c`
- **自动加载**：启动时自动扫描并加载所有自定义指令
- **非阻断式执行**：所有自定义指令都是非阻断式的，执行时读取md文件内容并返回

### 修改文件
- `src/commands/index.js` - 添加自定义指令加载函数，支持递归扫描md文件
- `src/app.js` - 启动时调用加载自定义指令函数

### 使用示例
1. 创建指令目录：`mkdir -p .front/commands/comms/a`
2. 创建指令文件：`echo "这是自定义指令内容" > .front/commands/comms/a/c.md`
3. 使用指令：在终端输入 `/a:c`，指令内容会发送给大模型

---

## 2026-05-05 - 实现指令分类功能

### 新增功能
- **指令分类机制**：将指令分为阻断类（blocking）和非阻断类（non-blocking）
  - 阻断类指令：执行后不给大模型发送请求，直接返回（如 /help, /clear, /exit 等）
  - 非阻断类指令：执行后返回字符串，和用户输入一起发送给大模型
- **指令类型定义**：每个指令新增`type`属性，标识指令类型
- **智能消息处理**：根据指令类型决定是否将指令结果发送给大模型

### 修改文件
- `src/commands/index.js` - 为指令添加`type`属性，修改`executeCommand`函数返回指令执行结果
- `src/app.js` - 修改指令处理逻辑，支持非阻断类指令的结果发送给大模型

### 使用示例
- 阻断类指令：`/help`、`/clear`、`/exit`、`/history`、`/model`、`/config`
- 非阻断类指令：自定义指令可设置`type: 'non-blocking'`，执行结果会和用户输入一起发送给大模型

---

## 2026-05-05 - 修复选择器后输入异常问题

### Bug修复
- **修复选择器后输入只能逐字输入的问题**：Tab填充指令或文件后，输入内容只能一个字一个字输入，不能一次性输入多个字
- **根本原因**：选择器完成后会关闭`stdin`的原始模式（setRawMode），但重新监听键盘事件时没有重新启用
- **修复方案**：在`triggerCommandSelector`和`triggerFileSelector`方法中，重新监听键盘事件之前，重新启用原始模式并设置正确的编码

### 修改文件
- `src/utils/inputHandler.js` - 修复选择器完成后重新监听键盘事件时未启用原始模式的问题

---

## 2026-05-05 - 修复输入法中文输入问题

### Bug修复
- **修复输入法输入中文时只能逐字输入的问题**：使用输入法输入中文时，只能一个字一个字输入，不能一次性输入多个字
- **根本原因**：`handleKeyPress`方法中的条件`key.length === 1`导致只能处理单个字符，输入法会一次性发送多个字符
- **修复方案**：修改条件为`key.length >= 1`，同时修改`handleCharInput`方法支持多字符输入

### 修改文件
- `src/utils/inputHandler.js` - 修改字符输入处理逻辑，支持输入法一次性输入多个字符

---

## 2026-05-05 - 实现实时交互功能

### 功能优化
- **实时选择器触发**：按下 `/` 或 `@` 立即显示选择列表，无需等待回车
- **重构输入处理**：创建 InputHandler 类，支持实时键盘监听
- **TTY 环境适配**：支持原始模式（TTY）和 readline 模式（非 TTY）

### 新增文件
- `src/utils/inputHandler.js` - 输入处理器，实现实时键盘监听和选择器触发

### 修改文件
- `src/app.js` - 使用新的输入处理器替代原有 readline 方式
- `src/utils/inputHandler.js` - 添加 TTY 环境检查，优化资源清理

### 技术实现
- 使用 process.stdin.setRawMode 实现实时键盘监听
- 检测 TTY 环境，非 TTY 时回退到 readline 方式
- 优化光标控制和输入显示

---

## 2026-05-05 - 新增指令选择和文件引用功能

### 新增功能
- **指令选择功能**：输入 `/` 触发指令选择列表，支持上下箭头选择、Tab 确认、实时筛选
- **文件引用功能**：输入 `@` 触发文件选择列表，选择文件后将内容作为上下文发送给 AI
- **指令解析和执行**：支持 /help、/clear、/history、/exit、/quit、/model、/config 等指令

### 新增文件
- `src/utils/selector.js` - 选择器组件，用于显示指令列表和文件列表
- `src/utils/commandParser.js` - 指令解析器，解析用户输入中的指令和文件引用
- `src/commands/index.js` - 指令定义模块，定义所有可用指令及其处理函数

### 修改文件
- `src/app.js` - 集成新功能，支持指令选择和文件引用

### 技术实现
- 使用 chalk 绘制终端 UI
- 使用 process.stdin 监听键盘事件
- 使用 fs 模块读取项目文件列表
- 支持实时筛选和键盘导航

---

## 2026-05-05
- 对比 app.js 和 logger.js 与参考代码，确认代码一致，无需修改
- 修复 init.js 中 centerText 函数的 RangeError：chalk ANSI 转义码和 emoji 被计入 text.length 导致负数，改用 getVisibleLength 函数计算可见长度
- fsHandle.js 用参考代码重写 writeHistoryToFrontFile 方法：写入 ~/.front/history/<项目名>/ 目录，时间戳命名，移除 writeJsonToProjectHistory
- app.js 将 writeHistoryToFrontFile 调用从 rl.on('close') 移到每轮对话结束后，确保历史记录及时保存
- request/index.js 配置路径从 front/ 改为 .front/，与 history 目录统一
- 将旧的 ~/front/settings.json 迁移到 ~/.front/settings.json

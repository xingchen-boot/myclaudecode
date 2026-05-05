# 更新日志

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

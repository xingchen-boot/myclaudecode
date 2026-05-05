# 更新日志

## 2026-05-05
- 对比 app.js 和 logger.js 与参考代码，确认代码一致，无需修改
- 修复 init.js 中 centerText 函数的 RangeError：chalk ANSI 转义码和 emoji 被计入 text.length 导致负数，改用 getVisibleLength 函数计算可见长度
- fsHandle.js 用参考代码重写 writeHistoryToFrontFile 方法：写入 ~/.front/history/<项目名>/ 目录，时间戳命名，移除 writeJsonToProjectHistory
- app.js 将 writeHistoryToFrontFile 调用从 rl.on('close') 移到每轮对话结束后，确保历史记录及时保存
- request/index.js 配置路径从 front/ 改为 .front/，与 history 目录统一
- 将旧的 ~/front/settings.json 迁移到 ~/.front/settings.json

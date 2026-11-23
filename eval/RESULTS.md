# 评测结果与复跑方式

## 结论（2026-10-26 单次运行）

| 指标 | 数值 |
| --- | --- |
| 题库 | 17 个前端任务（10 simple + 7 complex，complex 含 2 个设计稿还原） |
| 本轮执行 | 15 个（complex-01~05、simple-01~10） |
| 通过 | **14 / 15，通过率 93%** |
| 输入 token | 861,065 |
| 输出 token | 30,540 |
| 单题工具调用 | 5 ~ 13 次 |
| 单题危险操作拦截 | 0 ~ 4 次 |

单题明细：

| 题目 | 类型 | 通过 | 工具次数 | 拦截 | 输入 token | 输出 token |
| --- | --- | --- | --- | --- | --- | --- |
| complex-01-about-section | complex | 是 | 12 | 1 | 78,877 | 2,163 |
| complex-02-render-function | complex | 是 | 13 | 1 | 80,052 | 3,037 |
| complex-03-login-form | complex | 是 | 8 | 1 | 52,570 | 1,891 |
| complex-04-counter | complex | 是 | 13 | 2 | 79,901 | 2,905 |
| complex-05-about-page | complex | 是 | 9 | 1 | 55,331 | 1,963 |
| simple-01-button-text | simple | 是 | 5 | 0 | 30,413 | 5,022 |
| simple-02-title | simple | 是 | 9 | 2 | 52,525 | 1,506 |
| simple-03-color | simple | 是 | 10 | 3 | 61,471 | 1,832 |
| simple-04-placeholder | simple | 是 | 9 | 2 | 51,423 | 1,342 |
| simple-05-list-item | simple | 是 | 11 | 3 | 67,576 | 1,890 |
| **simple-06-image-alt** | simple | **否** | 13 | 4 | 68,809 | 1,840 |
| simple-07-greeting | simple | 是 | 10 | 3 | 57,307 | 1,413 |
| simple-08-card-class | simple | 是 | 6 | 0 | 36,601 | 1,213 |
| simple-09-link-text | simple | 是 | 9 | 2 | 52,643 | 1,531 |
| simple-10-keep-style | simple | 是 | 6 | 0 | 35,566 | 992 |

## 唯一的失败例，以及它为什么值得留着

```
simple-06-image-alt
失败原因：index.html 里没有「alt="头像"」
```

题目要求把一张已有图片补上 `alt="头像"`。Agent 打开文件、改了别的地方、也调用了 13 次工具，但**始终没把目标属性写进去**。这不是随机波动，而是一类典型故障：模型把「让页面看起来对」当成了目标，而不是把「满足一个精确的文本断言」当成目标。

留着这条失败例的原因是：一份 100% 通过的评测报告基本等于没测。这条失败例证明断言是真的在检查产物、而不是在检查模型的自我评价。

## 断言怎么写的

每个任务目录下有 `expect.json`，当前用到的断言类型：

| 断言 | 作用 |
| --- | --- |
| `skillLoaded` | 该任务指定的 Skill 是否真的被加载（防止模型绕过流程直接写） |
| `fileContains` | 产物文件是否包含指定文本（最多的一类，共 32 处） |
| `fileNotContains` | 是否**没有**出现不该出现的文本（防止过度改写） |
| `fileUnchanged` | 不该动的文件是否保持原样 |
| `toolCalled` | 是否按预期调用了某个工具 |
| `debuggerClean` | 浏览器调试后控制台是否无报错 |

`rubric.md` 存人读的评分口径，和 `expect.json` 的机器断言互补：机器断言负责「有没有」，rubric 负责「好不好」。

## 怎么复跑

```bash
# 1. 配好模型（.env 里 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL）
# 2. 跑题库
npm run eval
# 3. 跑单题（调试用）
node src/eval/cli.js --task simple-06-image-alt
# 4. 列出全部题目
node src/eval/cli.js --list
# 5. 跑评测框架自身的自检（10 个检查脚本，不消耗 token）
npm test
```

报告输出到 `eval/reports/<时间戳>/`（`report.md` 人读、`report.json` 机读），单题产物落在 `eval/runs/<时间戳>/` 便于回查为什么失败。

## 这份结果能说什么、不能说什么

能说：

- 在 17 题里抽 15 题、单模型单次运行，端到端跑通了「读任务 → 调工具改代码 → 断言校验产物」的闭环，通过率 93%。
- 危险操作确实被拦截了（单题 0~4 次），说明审批机制在真实执行路径里生效，不是摆设。

不能说：

- 这不是 benchmark。15 题、单次运行、没有多种子复跑，不能拿来和别的 Agent 比通过率。
- 复杂任务里只有 2 题带设计稿，视觉还原能力只覆盖了很小的样本。
- 报告里没有记录具体模型与温度，复跑结果不保证一致。

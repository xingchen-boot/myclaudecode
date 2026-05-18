# 更新日志

## 2026-05-05 - 删除数组排序工具模块

### 删除操作
- **删除数组排序工具文件**：根据用户要求，删除了数组排序工具模块
  - 删除文件：`src/utils/arraySort.js`
  - 执行命令：`Remove-Item -Path "src\utils\arraySort.js" -Force`
- **操作结果**：数组排序工具文件已成功删除

### 原因说明
- 用户要求删除数组排序工具文件
- 已通过confirm工具确认删除操作

---

## 2026-05-05 - 新增数组排序工具模块

### 新增功能
- **数组排序算法实现**：创建数组排序工具模块，提供多种经典排序算法
  - `bubbleSort(array, ascending)` - 冒泡排序算法，通过相邻元素比较和交换排序
  - `selectionSort(array, ascending)` - 选择排序算法，每次选择极值元素放到正确位置
  - `insertionSort(array, ascending)` - 插入排序算法，将未排序元素插入已排序部分
  - `quickSort(array, ascending)` - 快速排序算法，使用分治法进行高效排序
  - `builtInSort(array, ascending, compareFunction)` - JavaScript内置排序方法的封装
- **排序工具类**：提供`ArraySorter`类，支持链式调用和统一接口
- **排序方向控制**：所有排序算法都支持升序（默认）和降序排序
- **数组安全性**：所有排序方法都返回新数组，不修改原数组
- **类型支持**：支持数字和字符串数组排序，自动处理类型转换

### 新增文件
- `src/utils/arraySort.js` - 数组排序工具模块，包含所有排序算法实现

### 使用示例
```javascript
import { bubbleSort, selectionSort, insertionSort, quickSort, builtInSort, ArraySorter } from './utils/arraySort.js';

// 示例数组
const numbers = [64, 34, 25, 12, 22, 11, 90];
const strings = ['banana', 'apple', 'cherry', 'date'];

// 使用冒泡排序（升序）
const bubbleSorted = bubbleSort(numbers); // [11, 12, 22, 25, 34, 64, 90]

// 使用选择排序（降序）
const selectionSorted = selectionSort(numbers, false); // [90, 64, 34, 25, 22, 12, 11]

// 使用插入排序
const insertionSorted = insertionSort(strings); // ['apple', 'banana', 'cherry', 'date']

// 使用快速排序
const quickSorted = quickSort(numbers); // [11, 12, 22, 25, 34, 64, 90]

// 使用内置排序
const builtinSorted = builtInSort(numbers); // [11, 12, 22, 25, 34, 64, 90]

// 使用ArraySorter类
const sorter = new ArraySorter(numbers);
const sorted = sorter.sort('quick', true); // 使用快速排序，升序
const bubbleSorted2 = sorter.bubbleSort(); // 使用冒泡排序
```

### 技术实现
- 遵循ESModule规范，使用`export`导出函数和类
- 包含完整的JSDoc注释，便于IDE提示和文档生成
- 所有排序算法都创建数组副本，确保原数组不被修改
- 支持数字和字符串的排序，自动处理类型转换
- 提供统一的`ArraySorter`类，简化排序操作

---

## 2026-05-05 - 新增数学工具函数模块

### 新增功能
- **数学计算方法**：创建数学工具函数模块，提供常用的数学计算方法
  - `sum(num1, num2)` - 计算两数之和
  - `sumArray(numbers)` - 计算多个数字的累加和
  - `subtract(num1, num2)` - 计算两数之差
  - `multiply(num1, num2)` - 计算两数之积
  - `divide(num1, num2)` - 计算两数之商
  - `power(base, exponent)` - 计算数字的幂
- **类型检查**：所有方法都包含参数类型检查，确保输入为数字类型
- **错误处理**：对非法输入抛出明确的TypeError异常
- **空值处理**：正确处理NaN值，除数为0时抛出错误

### 新增文件
- `src/utils/mathUtils.js` - 数学工具函数模块，包含所有数学计算方法

### 使用示例
```javascript
import { sum, sumArray, subtract, multiply, divide, power } from './utils/mathUtils.js';

// 两数之和
sum(5, 3); // 返回 8

// 数组累加和
sumArray([1, 2, 3, 4, 5]); // 返回 15

// 两数之差
subtract(10, 4); // 返回 6

// 两数之积
multiply(3, 4); // 返回 12

// 两数之商
divide(10, 2); // 返回 5

// 幂运算
power(2, 3); // 返回 8
```

### 技术实现
- 遵循ESModule规范，使用`export`导出函数
- 包含完整的JSDoc注释，便于IDE提示和文档生成
- 使用`typeof`进行数字类型检查
- 使用`isNaN`检查NaN值
- 使用`Math.pow`进行幂运算

---

## 2026-05-05 - 删除数组工具函数模块

### 删除操作
- **删除数组工具函数文件**：根据用户要求，删除了数组工具函数模块
  - 删除文件：`src/utils/arrayUtils.js`
  - 执行命令：`del "src\utils\arrayUtils.js"`
- **操作结果**：数组工具函数文件已成功删除

### 原因说明
- 用户要求删除数组工具函数文件
- 已通过confirm工具确认删除操作

---

## 2026-05-05 - 新增数组工具函数模块

### 新增功能
- **数组累加方法**：创建数组工具函数模块，提供常用的数组操作方法
  - `sum(numbers)` - 计算数组元素的累加和
  - `sumWithInitial(numbers, initialValue)` - 计算数组元素的累加和（支持初始值）
  - `product(numbers)` - 计算数组元素的累加积（乘法累加）
  - `average(numbers)` - 计算数组元素的平均值
- **类型检查**：所有方法都包含参数类型检查，确保输入为数字数组
- **错误处理**：对非法输入抛出明确的TypeError异常
- **空数组处理**：正确处理空数组的情况，sum返回0，product返回1，average返回NaN

### 新增文件
- `src/utils/arrayUtils.js` - 数组工具函数模块，包含所有数组操作方法

### 使用示例
```javascript
import { sum, sumWithInitial, product, average } from './utils/arrayUtils.js';

// 基本累加
sum([1, 2, 3, 4, 5]); // 返回 15

// 带初始值的累加
sumWithInitial([1, 2, 3, 4], 10); // 返回 20

// 累乘
product([1, 2, 3, 4, 5]); // 返回 120

// 平均值
average([1, 2, 3, 4, 5]); // 返回 3
```

### 技术实现
- 使用ES6的`reduce`方法进行累加和累乘操作
- 遵循ESModule规范，使用`export`导出函数
- 包含完整的JSDoc注释，便于IDE提示和文档生成
- 使用`Array.isArray`进行数组类型检查
- 使用`typeof`进行数字类型检查

---

## 2026-05-05 - 删除spec目录下的所有文件

### 修改操作
- **删除spec目录下的所有文件**：根据用户要求，删除了spec目录下的所有文件
  - 删除文件：`spec\design.md`、`spec\technology.md`
  - 执行命令：`Remove-Item -Path spec\* -Force`
- **操作结果**：spec目录现在为空

### 原因说明
- 用户要求清理spec目录下的文件
- 已通过confirm工具确认删除操作

---

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

## 2026-05-05 - 删除数学工具函数模块

### 删除操作
- **删除数学工具函数文件**：根据用户要求，删除了数学工具函数模块
  - 删除文件：`src/utils/mathUtils.js`
  - 执行命令：`Remove-Item -Path "D:\自己练习\frontcode\src\utils\mathUtils.js" -Force`
- **操作结果**：数学工具函数文件已成功删除

### 原因说明
- 用户要求删除数学工具函数文件
- 已通过confirm工具确认删除操作

---
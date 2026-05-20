# 更新日志

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

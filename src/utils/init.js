import chalk from 'chalk'

// 获取文本的可见长度（去除 ANSI 转义码和 emoji 宽度）
function getVisibleLength(text) {
  // 去除 ANSI 转义码
  const stripped = text.replace(/\x1B\[[0-9;]*m/g, '')
  // 计算可见长度，emoji 算 2 个字符宽度
  let length = 0
  for (const char of stripped) {
    const code = char.codePointAt(0)
    // emoji 和全角字符占 2 个宽度
    if (code > 0xFFFF || (code >= 0x1100 && code <= 0x115F) || (code >= 0x2E80 && code <= 0xA4CF && code !== 0x303F)) {
      length += 2
    } else {
      length += 1
    }
  }
  return length
}

// 居中文字并填充空格
function centerText(text, width) {
  const visibleLen = getVisibleLength(text)
  const padding = Math.max(0, Math.floor((width - visibleLen) / 2))
  const rightPadding = Math.max(0, width - padding - visibleLen)
  return ' '.repeat(padding) + text + ' '.repeat(rightPadding)
}

// 输出一行内容（蓝色边框）
function contentLine(text, width) {
  const visibleLen = getVisibleLength(text)
  const padded = text + ' '.repeat(Math.max(0, width - visibleLen))
  return chalk.blue('║') + padded + chalk.blue('║')
}

// 构建边框线（蓝色）
function borderLine(left, mid, right, width) {
  return chalk.blue(left) + chalk.blue(mid.repeat(width)) + chalk.blue(right)
}

export function welcomeLog() {
  const innerWidth = 40

  console.log('')
  console.log(borderLine('╔', '═', '╗', innerWidth))
  console.log(contentLine('', innerWidth))
  console.log(contentLine(centerText('😊  欢迎使用!', innerWidth), innerWidth))
  console.log(contentLine('', innerWidth))
  console.log(contentLine(centerText(chalk.green.bold('FrontCode AI Terminal') + chalk.yellow('  v1.0.0'), innerWidth), innerWidth))
  console.log(contentLine(centerText(chalk.yellow('AI 驱动的终端开发助手'), innerWidth), innerWidth))
  console.log(contentLine('', innerWidth))
  console.log(contentLine(centerText(chalk.green('直接输入') + chalk.yellow('  向 AI 提问或下达指令'), innerWidth), innerWidth))
  console.log(contentLine(centerText(chalk.green('exit/quit') + chalk.yellow('  退出程序'), innerWidth), innerWidth))
  console.log(contentLine('', innerWidth))
  console.log(borderLine('╚', '═', '╝', innerWidth))
  console.log('')
}

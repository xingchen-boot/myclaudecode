import os from 'os'
import path from 'path'

// 获取用户 home 目录
export function getUserHomeDir() {
  return os.homedir()
}

// 获取当前终端工作目录
export function getCurrentWorkDir() {
  return process.cwd()
}

/**
 * 把传入路径解析到当前工作目录内
 * 工具读写文件时用它拦住工作目录以外的路径
 * @param {string} inputPath - 绝对路径或相对路径
 * @returns {{ ok: boolean, resolvedPath: string, message: string }}
 */
export function resolveInsideWorkDir(inputPath) {
  const workDir = path.resolve(getCurrentWorkDir())
  const resolvedPath = path.resolve(workDir, inputPath || '.')
  const relativePath = path.relative(workDir, resolvedPath)
  // 不同盘符时 relative 会得到绝对路径，同样视为越界
  const leavesWorkDir = relativePath.startsWith('..') || path.isAbsolute(relativePath)

  if (leavesWorkDir) {
    return {
      ok: false,
      resolvedPath,
      message: `错误：路径超出当前工作目录，禁止访问 ${resolvedPath}`
    }
  }

  return {
    ok: true,
    resolvedPath,
    message: ''
  }
}

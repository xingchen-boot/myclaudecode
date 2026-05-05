import os from 'os'

// 获取用户 home 目录
export function getUserHomeDir() {
  return os.homedir()
}

// 获取当前终端工作目录
export function getCurrentWorkDir() {
  return process.cwd()
}

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * 读取系统提示文档并替换变量
 * @returns {string} 替换变量后的系统提示内容
 */
export function readSystem() {
    // 读取 systemDoc.md 文件
    const docPath = join(__dirname, '../docs/systemDoc.md')
    let content = readFileSync(docPath, 'utf-8')

    // 获取操作系统信息：平台、架构、版本
    const systemInfo = `${os.platform()} ${os.arch()} ${os.release()}`

    // 获取当前工作目录（项目根目录）
    const workPath = process.cwd()

    // 替换变量
    content = content.replace('${systemInfo}', systemInfo)
    content = content.replace('${workPath}', workPath)

    return content
}

/**
 * 读取用户上下文配置
 * @returns {string} 替换变量后的用户上下文内容
 */
export function getUserContext() {
    // 读取 userContext.md 模板
    const templatePath = join(__dirname, '../docs/userContext.md')
    let content = readFileSync(templatePath, 'utf-8')

    // 用户 home 目录下的 .front/.front.md
    const userFrontPath = join(os.homedir(), '.front', '.front.md')
    // 当前工作目录下的 .front.md
    const projectFrontPath = join(process.cwd(), '.front.md')

    // 读取用户级配置，不存在则为空字符串
    let userContent = ''
    try {
        userContent = readFileSync(userFrontPath, 'utf-8')
    } catch {
        // 文件不存在，保持空字符串
    }

    // 读取项目级配置，不存在则为空字符串
    let projectContent = ''
    try {
        projectContent = readFileSync(projectFrontPath, 'utf-8')
    } catch {
        // 文件不存在，保持空字符串
    }

    // 替换模板变量
    content = content.replace('${userPath}', userFrontPath)
    content = content.replace('${userContent}', userContent)
    content = content.replace('${projectPath}', projectFrontPath)
    content = content.replace('${projectContent}', projectContent)

    return content
}

console.log(getUserContext())
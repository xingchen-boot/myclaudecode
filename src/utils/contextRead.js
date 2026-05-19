import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import os from 'os'
import picomatch from 'picomatch'
import { getNowMemory } from './memoryUtils.js'

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

    // 获取记忆内容
    const { projectMemory, userMemory } = getNowMemory()

    // 替换模板变量
    content = content.replace('${userPath}', userFrontPath)
    content = content.replace('${userContent}', userContent)
    content = content.replace('${projectPath}', projectFrontPath)
    content = content.replace('${projectContent}', projectContent)
    content = content.replace(/\${userMemory}/g, userMemory)
    content = content.replace(/\${projectMemory}/g, projectMemory)

    return content
}

/**
 * 解析文件内容中的 frontmatter，提取 paths 规则
 * @param {string} content 文件内容
 * @returns {string[]} 匹配规则数组
 */
function parseFrontmatterPaths(content) {
    // 匹配 --- 之间的 frontmatter 内容
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) {
        return []
    }

    const frontmatter = frontmatterMatch[1]

    // 提取所有以 - 开头的规则（兼容各种缩进）
    const paths = []
    const lines = frontmatter.split('\n')
    let inPathsSection = false

    for (const line of lines) {
        const trimmed = line.trim()

        // 检测 paths: 开头
        if (trimmed.startsWith('paths:')) {
            inPathsSection = true
            continue
        }

        // 在 paths 部分中，提取以 - 开头的行
        if (inPathsSection && trimmed.startsWith('-')) {
            // 移除开头的 - 和引号
            const path = trimmed.slice(1).trim().replace(/^["']|["']$/g, '')
            paths.push(path)
        } else if (inPathsSection && trimmed && !trimmed.startsWith('-')) {
            // 遇到非 - 开头的非空行，说明 paths 部分结束
            inPathsSection = false
        }
    }

    return paths
}

/**
 * 读取用户级和项目级的 rules 文件夹中的所有规则文件
 * @returns {Map<string, {content: string, rules: string[]}>} 规则文件名到内容和匹配规则的映射，项目级规则优先
 */
export function readRules() {
    const rulesMap = new Map()

    // 用户 home 目录下的 .front/rules/
    const userRulesDir = join(os.homedir(), '.front', 'rules')
    // 当前工作目录下的 .front/rules/
    const projectRulesDir = join(process.cwd(), '.front', 'rules')

    // 读取用户级规则
    if (existsSync(userRulesDir)) {
        const userFiles = readdirSync(userRulesDir)
        for (const file of userFiles) {
            const filePath = join(userRulesDir, file)
            const content = readFileSync(filePath, 'utf-8')
            const rules = parseFrontmatterPaths(content)
            rulesMap.set(file, { content, rules })
        }
    }

    // 读取项目级规则（会覆盖同名的用户级规则）
    if (existsSync(projectRulesDir)) {
        const projectFiles = readdirSync(projectRulesDir)
        for (const file of projectFiles) {
            const filePath = join(projectRulesDir, file)
            const content = readFileSync(filePath, 'utf-8')
            const rules = parseFrontmatterPaths(content)
            rulesMap.set(file, { content, rules })
        }
    }

    return rulesMap
}

/**
 * 匹配文件路径与规则
 * @param {string[]} filePaths 文件路径列表（完整路径）
 * @param {Map<string, {content: string, rules: string[]}>} rulesMap 规则映射
 * @returns {string} 匹配到的规则内容合并
 */
export function matchRules(filePaths, rulesMap) {
    if (!filePaths || filePaths.length === 0 || !rulesMap || rulesMap.size === 0) {
        return ''
    }

    const matchedContents = []
    const workDir = process.cwd()

    // 遍历所有规则
    for (const [fileName, { content, rules }] of rulesMap) {
        if (!rules || rules.length === 0) {
            continue
        }

        // 检查是否有文件匹配该规则的任意一个模式
        const isMatch = filePaths.some(filePath => {
            // 获取相对于工作目录的路径，并将反斜杠替换为正斜杠（glob 标准）
            const relativePath = relative(workDir, filePath).replace(/\\/g, '/')
            return picomatch.isMatch(relativePath, rules)
        })

        if (isMatch && !matchedContents.includes(content)) {
            matchedContents.push(content)
        }
    }

    return matchedContents.join('\n\n')
}

/**
 * 提取 SKILL.md 文件中的 frontmatter 头部
 * @param {string} content 文件内容
 * @returns {string} 提取的头部内容
 */
function extractSkillHeader(content) {
    // 匹配 --- 之间的 frontmatter 内容
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
    return match ? match[1].trim() : ''
}

/**
 * 遍历 skills 目录，收集所有 SKILL.md 的头部信息和文件路径
 * @param {string} skillsDir skills 目录路径
 * @returns {{header: string, filePath: string}[]} 包含头部内容和文件路径的数组
 */
function collectSkillHeaders(skillsDir) {
    const results = []

    if (!existsSync(skillsDir)) {
        return results
    }

    // 遍历 skills 目录下的所有子文件夹
    const items = readdirSync(skillsDir, { withFileTypes: true })
    for (const item of items) {
        if (!item.isDirectory()) {
            continue
        }

        // 检查子文件夹中是否有 SKILL.md
        const skillFile = join(skillsDir, item.name, 'SKILL.md')
        if (!existsSync(skillFile)) {
            continue
        }

        // 读取 SKILL.md 并提取头部
        const content = readFileSync(skillFile, 'utf-8')
        const header = extractSkillHeader(content)
        if (header) {
            results.push({ header, filePath: skillFile })
        }
    }

    return results
}

/**
 * 从 header 中提取 skill 名称
 * @param {string} header 头部内容
 * @returns {string} skill 名称
 */
function extractSkillName(header) {
    const nameMatch = header.match(/^name:\s*(.+)$/m)
    return nameMatch ? nameMatch[1].trim() : 'unknown'
}

/**
 * 获取所有 skill 的头部信息并填充模板
 * @returns {string} 替换模板变量后的内容
 */
export function getSkillHeaders() {
    // 用户 home 目录下的 .front/skills/
    const userSkillsDir = join(os.homedir(), '.front', 'skills')
    // 当前工作目录下的 .front/skills/
    const projectSkillsDir = join(process.cwd(), '.front', 'skills')

    // 收集所有 skill 头部和文件路径
    const allSkills = [
        ...collectSkillHeaders(userSkillsDir),
        ...collectSkillHeaders(projectSkillsDir)
    ]

    // 拼接所有头部内容，附带 skill 名称和文件地址
    const skillContent = allSkills.map(({ header, filePath }) => {
        const skillName = extractSkillName(header)
        return `${header}\n${skillName}的skill文件地址: ${filePath}`
    }).join('\n\n')

    // 读取模板文件并替换变量
    const templatePath = join(__dirname, '../docs/skillTemplate.md')
    let template = readFileSync(templatePath, 'utf-8')
    template = template.replace('${skillcontent}', skillContent)

    return template
}

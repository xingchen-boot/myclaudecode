import fs from 'fs';
import path from 'path';
import { getSkillDirectories } from '../../utils/contextRead.js';

/**
 * 只允许读取 skill 目录里的 SKILL.md，避免借这个工具打开任意文件
 * @param {string} skillPath
 * @returns {boolean}
 */
function isAllowedSkillFile(skillPath) {
    const resolvedPath = path.resolve(skillPath || '');
    if (path.basename(resolvedPath) !== 'SKILL.md') {
        return false;
    }

    return getSkillDirectories().some((skillDirectory) => {
        const resolvedDirectory = path.resolve(skillDirectory);
        const relativePath = path.relative(resolvedDirectory, resolvedPath);
        return relativePath !== ''
            && !relativePath.startsWith('..')
            && !path.isAbsolute(relativePath);
    });
}

function resolveSkillFile(skillPath) {
    const rawPath = String(skillPath || '').trim()
    if (!rawPath) {
        return ''
    }

    if (path.isAbsolute(rawPath) && isAllowedSkillFile(rawPath) && fs.existsSync(path.resolve(rawPath))) {
        return path.resolve(rawPath)
    }

    const normalized = rawPath.replace(/\\/g, '/')
    const relativeSkill = normalized.toLowerCase().endsWith('/skill.md') || normalized.toLowerCase() === 'skill.md'
        ? normalized
        : `${normalized.replace(/\/$/, '')}/SKILL.md`

    for (const skillDirectory of getSkillDirectories()) {
        const candidate = path.resolve(skillDirectory, relativeSkill)
        if (isAllowedSkillFile(candidate) && fs.existsSync(candidate)) {
            return candidate
        }
    }

    return ''
}

export default {
    define: {
        name: "skill",
        description: "读取 skill 的完整正文。用户提出开发需求时，先根据摘要在 dev-simple 和 dev-complex 中选择一个并读取；用户点名某个 skill 时也要读取。问候、概念问题和解释代码不要调用本工具。",
        inputSchema: {
            type: "object",
            properties: {
                skillpath: {
                    type: "string",
                    description: "例如 dev-simple/SKILL.md"
                }
            },
            required: ["skillpath"]
        }
    },
    handle({ skillpath }) {
        const resolvedPath = resolveSkillFile(skillpath)
        if (!resolvedPath) {
            return '错误：已拦截：只能读取 skill 目录中的 SKILL.md，不能用 skill 工具打开其他文件。'
        }

        const content = fs.readFileSync(resolvedPath, 'utf-8');
        return `skill的内容为:${content}`;
    }
};

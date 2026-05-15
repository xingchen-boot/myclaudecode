import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';

const excludeDirs = ['node_modules', '.git', '.front', '.claude', 'dist', 'build'];
const excludeFiles = ['.DS_Store', 'Thumbs.db'];

/**
 * 递归扫描目录获取所有文件
 */
export function scanFiles(dir = process.cwd(), baseDir = null) {
  if (!baseDir) baseDir = dir;
  const results = [];

  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      if (excludeDirs.includes(item.name)) continue;
      if (excludeFiles.includes(item.name)) continue;

      const fullPath = path.join(dir, item.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (item.isDirectory()) {
        results.push(...scanFiles(fullPath, baseDir));
      } else {
        results.push(relativePath.replace(/\\/g, '/'));
      }
    }
  } catch (e) {
    // 忽略无法访问的目录
  }

  return results;
}

/**
 * 筛选文件
 */
export function filterFiles(files, query) {
  if (!query) return files;
  const lowerQuery = query.toLowerCase();
  return files.filter(file =>
    file.toLowerCase().includes(lowerQuery)
  );
}

/**
 * 读取文件内容
 */
export function readFileContent(filepath) {
  try {
    const fullPath = path.resolve(process.cwd(), filepath);
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (e) {
    return `[无法读取文件: ${filepath}]`;
  }
}

/**
 * 解析输入中的 @[filename] 标记
 */
export function parseFileTags(input) {
  const tagRegex = /@\[([^\]]+)\]/g;
  const files = [];
  let match;

  while ((match = tagRegex.exec(input)) !== null) {
    files.push(match[1]);
  }

  return files;
}

/**
 * 将文件内容附加到消息中
 */
export function attachFilesToMessage(input) {
  const files = parseFileTags(input);
  if (files.length === 0) return input;

  let result = input;
  result += '\n\n--- 附加文件内容 ---';

  for (const file of files) {
    const content = readFileContent(file);
    result += `\n\n## ${file}\n\`\`\`\n${content}\n\`\`\``;
  }

  return result;
}

/**
 * 根据选中的文件匹配 rulesMap，返回匹配到的规则内容
 */
export function matchRulesForFiles(files, rulesMap) {
  const matchedContents = [];
  const usedPaths = new Set();

  for (const file of files) {
    for (const [rulePath, ruleData] of rulesMap) {
      if (usedPaths.has(rulePath)) continue;

      for (const pattern of ruleData.rules) {
        if (minimatch(file, pattern)) {
          matchedContents.push(ruleData.content);
          usedPaths.add(rulePath);
          break;
        }
      }
    }
  }

  return matchedContents.join('\n\n');
}

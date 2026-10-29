import '../request/index.js'
import { readSystem, getSkillHeaders, getUserContext } from '../utils/contextRead.js'
import getLocalTool from '../tools/local/index.js'
import { transformToOpenAi } from '../tools/util.js'
import { selectTurnTools } from '../tools/selectTurnTools.js'

/**
 * 统计一段文本的字数
 * @param {string} text
 * @returns {number}
 */
function textLength(text) {
    return String(text || '').length
}

const systemPrompt = readSystem()
const skillHeaders = getSkillHeaders()
const userContext = getUserContext()
const { localTools } = getLocalTool()
const openAiTools = transformToOpenAi(localTools)
const toolSchemaText = JSON.stringify(openAiTools)
const plainToolText = JSON.stringify(transformToOpenAi(selectTurnTools(localTools, {
    wantsPreview: false,
    hasDesign: false,
    wantsChoice: false
})))
const previewToolText = JSON.stringify(transformToOpenAi(selectTurnTools(localTools, {
    wantsPreview: true,
    hasDesign: true,
    wantsChoice: false
})))

const toolRows = openAiTools.map((tool) => {
    const schemaText = JSON.stringify(tool)
    return {
        name: tool.function.name,
        descriptionLength: textLength(tool.function.description),
        schemaLength: schemaText.length
    }
}).sort((left, right) => right.schemaLength - left.schemaLength)

console.log('每一轮固定带上的内容（字数，不是 token）：')
console.log(`系统提示    ${textLength(systemPrompt)}`)
console.log(`Skill 摘要  ${textLength(skillHeaders)}`)
console.log(`工具说明    ${toolSchemaText.length}（全部）`)
console.log(`普通一轮    ${plainToolText.length}`)
console.log(`要看效果    ${previewToolText.length}`)
console.log(`普通合计    ${textLength(systemPrompt) + textLength(skillHeaders) + plainToolText.length}`)
console.log(`用户上下文  ${textLength(userContext)}（只含用户要求或项目要求，不含记忆）`)
console.log('')
console.log('工具说明从长到短：')
for (const row of toolRows) {
    console.log(`${row.name.padEnd(16)} 说明 ${String(row.descriptionLength).padStart(4)}  整段 ${String(row.schemaLength).padStart(5)}`)
}

process.exit(0)

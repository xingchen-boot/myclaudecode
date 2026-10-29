import fs from 'fs'
import os from 'os'
import path from 'path'
import { loadConfig } from '../request/index.js'

function fail(message) {
    console.error(message)
    process.exit(1)
}

const originalDirectory = process.cwd()
const projectSettings = JSON.parse(fs.readFileSync(path.join(originalDirectory, '.front', 'settings.json'), 'utf8'))
const started = loadConfig()
if (started.model !== projectSettings.model || started.baseURL !== projectSettings.baseURL) {
    fail(`没有使用启动目录的配置: ${started.model} ${started.baseURL}`)
}

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontcode-config-'))
process.chdir(tempDirectory)
try {
    const afterMove = loadConfig()
    if (afterMove.model !== started.model || afterMove.baseURL !== started.baseURL) {
        fail(`切换目录后配置变了: ${afterMove.model} ${afterMove.baseURL}`)
    }
} finally {
    process.chdir(originalDirectory)
}

console.log('配置目录检查通过')

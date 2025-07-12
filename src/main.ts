import { transform } from 'lightningcss'
import fs from 'node:fs/promises'
import path from 'node:path'
import fastglob from 'fast-glob'

async function parseCssFileSelectors(cssPath: string) {
  const fileData = await fs.readFile(cssPath)

  const { exports } = transform({
    filename: cssPath,
    code: fileData,
    cssModules: true,
    sourceMap: true,
  })

  return exports ? Object.keys(exports) : []
}

async function parseProject(projectPath: string) {
  const entries = await fastglob(projectPath + '/**/*.{jsx, tsx}')

  for (const entry of entries) {
    console.log({ entry })
  }
}

async function main() {
  const projectPath = path.join(import.meta.dirname, '../test')

  parseProject(projectPath)
}

main()

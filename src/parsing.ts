import { transform } from 'lightningcss'
import fsPromises from 'node:fs/promises'
import fs from 'node:fs'
import path from 'node:path'
import fastglob from 'fast-glob'
import { parseAndWalk } from 'oxc-walker'
import util from 'node:util'

import type { Identifier } from 'oxc-walker'
import type { Node as AstNode, MemberExpression } from 'oxc-parser'
import type { Config } from './types.ts'

type TransformError<T> = {
  message: string
  loc?: {
    line: number
    column: number
  }
  source?: string
  data: T
}

/**
 * Parses all selectors from css file
 * @returns string[] - array of selectors
 */
function parseCssFileSelectors(cssPath: string) {
  // todo: add handling for css files imported from node_modules
  if (!fs.existsSync(cssPath)) return []

  const fileData = fs.readFileSync(cssPath)

  try {
    const { exports } = transform({
      filename: cssPath,
      code: fileData,
      cssModules: true,
      sourceMap: true,
      visitor: {
        // Skip keyframe names, container names, etc.
        CustomIdent() {
          return ''
        },
      },
    })

    // since we skip keyframes/containers etc. some selectors will be empty string
    const selectorNames = exports ? Object.keys(exports).filter(Boolean) : []

    return selectorNames
  } catch (error: unknown) {
    const err = error as TransformError<unknown>

    const filename = util.styleText('cyan', cssPath)
    const label = util.styleText(['bold', 'red'], 'CSS Parse Error')
    const reason = util.styleText('yellow', err.message ?? 'Unknown error')
    const loc = err.loc
      ? util.styleText('dim', ` (line ${err.loc.line}, col ${err.loc.column})`)
      : ''

    console.error(`${label} in ${filename}${loc}:  ${reason}`)
    return []
  }
}

export type CssFileStats = {
  selectors: Record<string, number>
  usedBy: string[]
}

export type JsxFileStats = {
  stats: {
    // Identifier for styles, e.g. 'css' in this import: "import css from './styles.css'"
    [stylesIdentifier: string]: {
      selectors?: Record<string, number>
      cssFilePath: string
    }
  }
}

export type ParseResult = {
  selectorsUsage: Record<string, CssFileStats>
  undefinedSelectors: Record<string, { cssFilePath: string; selectors: string[] }>
}

function buildProjectPath(projectPath: string, exts: string[]) {
  const componentFileExtensions = exts.length > 1 ? exts.join(',') : exts[0]
  const projectPathGlob =
    projectPath +
    (exts.length > 1 ? `/**/*.{${componentFileExtensions}}` : `/**/*.${componentFileExtensions}`)

  return projectPathGlob
}

function buildCssFileStatsSelectors(cssFilePath: string): CssFileStats['selectors'] {
  const cssFileSelectors = parseCssFileSelectors(cssFilePath)
  const selectorsCounter: CssFileStats['selectors'] = {}

  cssFileSelectors.forEach(selector => {
    selectorsCounter[selector] = 0
  })

  return selectorsCounter
}

export async function parseProject(projectPath: string, options: Config): Promise<ParseResult> {
  const projectPathGlob = buildProjectPath(projectPath, options.exts)

  const fileEntries = await fastglob(projectPathGlob, { ignore: options.ignore })

  const cssFilesUsedByComponents: ParseResult['selectorsUsage'] = {}

  const selectorsInJsx: Record<string, JsxFileStats> = {}

  for (const fileEntry of fileEntries) {
    const fileData = await fsPromises.readFile(fileEntry, { encoding: 'utf-8' })

    parseAndWalk(fileData, fileEntry, node => {
      // parse CSS imports
      if (node.type === 'ImportDeclaration') {
        const importPath = node.source.value
        const isCssFile = options.styleGlobs.some(glob => importPath.endsWith(glob))

        if (isCssFile) {
          const fullPathToCssFile = path.join(path.dirname(fileEntry), node.source.value)

          // Skip CSS files from ignore array
          if (options.ignore?.some(ignoreOpt => fullPathToCssFile.endsWith(ignoreOpt))) {
            return
          }

          if (cssFilesUsedByComponents[fullPathToCssFile]) {
            cssFilesUsedByComponents[fullPathToCssFile].usedBy.push(fileEntry)
          } else {
            const emptySelectorsCounter = buildCssFileStatsSelectors(fullPathToCssFile)

            cssFilesUsedByComponents[fullPathToCssFile] = {
              selectors: emptySelectorsCounter,
              usedBy: [fileEntry],
            }
          }

          if (!selectorsInJsx[fileEntry]) {
            selectorsInJsx[fileEntry] = { stats: {} }
          }

          const stylesImportIdentifier = node.specifiers.at(0)?.local.name

          // there is no import identifier for side effect imports, e.g. "import './path/cssFile.css'"
          if (!stylesImportIdentifier) {
            return
          }

          if (!selectorsInJsx[fileEntry].stats[stylesImportIdentifier]) {
            selectorsInJsx[fileEntry].stats[stylesImportIdentifier] = {
              selectors: {},
              cssFilePath: fullPathToCssFile,
            }
          }
        }
      }

      // Count selectors used in JSX
      if (isNodeReferencingStyles(node, selectorsInJsx[fileEntry])) {
        const stylesIdentifier = node.object.name
        const cssSelector = node.property.name

        const statsForIdentifier = selectorsInJsx[fileEntry]?.stats[stylesIdentifier]

        if (statsForIdentifier) {
          if (!statsForIdentifier.selectors) {
            statsForIdentifier.selectors = {}
          }

          statsForIdentifier.selectors[cssSelector] =
            (statsForIdentifier.selectors[cssSelector] || 0) + 1
        }
      }
    })
  }

  const undefinedSelectors: ParseResult['undefinedSelectors'] = {}

  // Count usages
  for (const [jsxFilePath, jsxStats] of Object.entries(selectorsInJsx)) {
    for (const stats of Object.values(jsxStats.stats)) {
      const cssFileStats = cssFilesUsedByComponents[stats.cssFilePath]

      if (stats.cssFilePath && stats.selectors && cssFileStats) {
        for (const [selectorName, count] of Object.entries(stats.selectors)) {
          const currentSelectorCount = cssFileStats.selectors[selectorName]

          if (currentSelectorCount !== undefined) {
            cssFileStats.selectors[selectorName] = currentSelectorCount + count
          }

          if (options.reverse) {
            const isUndefinedSelector =
              cssFilesUsedByComponents[stats.cssFilePath]?.selectors[selectorName] === undefined

            if (isUndefinedSelector) {
              if (!undefinedSelectors[jsxFilePath]) {
                undefinedSelectors[jsxFilePath] = { cssFilePath: stats.cssFilePath, selectors: [] }
              }

              undefinedSelectors[jsxFilePath].selectors.push(selectorName)
            }
          }
        }
      }
    }
  }

  return {
    selectorsUsage: cssFilesUsedByComponents,
    undefinedSelectors,
  }
}

type MemberExpressionWithIdentifierProperty = MemberExpression & {
  property: Identifier
  object: Identifier
}

function isNodeReferencingStyles(
  node: AstNode,
  jsxFileStat: JsxFileStats | undefined,
): node is MemberExpressionWithIdentifierProperty {
  return (
    node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    node.property.type === 'Identifier' &&
    jsxFileStat?.stats[node.object.name] !== undefined
  )
}

import fsPromises from 'node:fs/promises'
import path from 'node:path'
import fastglob from 'fast-glob'
import { parseAndWalk } from 'oxc-walker'

import type { Identifier } from 'oxc-walker'
import type { Node as AstNode, MemberExpression, StringLiteral } from 'oxc-parser'
import type { Config } from '../types.ts'
import { parseCssFileSelectors } from './css.ts'

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

      const isNeededNode = isNodeReferencingStyles(node, selectorsInJsx[fileEntry])

      // Count selectors used in JSX
      if (isNeededNode) {
        const stylesIdentifier = node.object.name
        const cssSelector = getSelectorFromStylesProperty(node.property)

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

type StylesProperty = Identifier | StringLiteral

type StylesMemberExpression = MemberExpression & {
  object: Identifier
  property: StylesProperty
}

function isNodeReferencingStyles(
  node: AstNode,
  jsxFileStat: JsxFileStats | undefined,
): node is StylesMemberExpression {
  return (
    node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    (node.property.type === 'Identifier' || node.property.type === 'Literal') &&
    jsxFileStat?.stats[node.object.name] !== undefined
  )
}

function getSelectorFromStylesProperty(property: StylesProperty): string {
  return property.type === 'Identifier' ? property.name : property.value
}

import { transform } from 'lightningcss'
import fsPromises from 'node:fs/promises'
import fs from 'node:fs'
import path from 'node:path'
import fastglob from 'fast-glob'
import { parseAndWalk } from 'oxc-walker'

import type { Identifier } from 'oxc-walker'
import type { Node as AstNode, MemberExpression } from 'oxc-parser'
import type { Config } from './types.ts'

function parseCssFileSelectors(cssPath: string) {
  // todo: add handling for css files imported from node_modules
  if (!fs.existsSync(cssPath)) return []

  const fileData = fs.readFileSync(cssPath)

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
}

export type CssFileStats = {
  selectors: Record<string, number>
  usedBy: string[]
}

export type JsxFileStats = {
  selectors?: Record<string, number>
  cssFilePath?: string
  stylesIdentifier?: string // Identifier for styles, e.g. 'css' in this import: "import css from './styles.css'"
}

export type ParseResult = {
  selectorsUsage: Record<string, CssFileStats>
  undefinedSelectors: Record<string, { cssFilePath: string; selectors: string[] }>
}

export async function parseProject(projectPath: string, options: Config): Promise<ParseResult> {
  const componentFileExtensions = options.exts.length > 1 ? options.exts.join(',') : options.exts[0]
  const projectPathGlob =
    projectPath +
    (options.exts.length > 1
      ? `/**/*.{${componentFileExtensions}}`
      : `/**/*.${componentFileExtensions}`)

  const fileEntries = await fastglob(projectPathGlob, { ignore: options.ignore })

  const cssFilesUsedByComponents: ParseResult['selectorsUsage'] = {}

  const selectorsInJsx: Record<string, JsxFileStats> = {}

  for (const fileEntry of fileEntries) {
    const fileData = await fsPromises.readFile(fileEntry, { encoding: 'utf-8' })

    parseAndWalk(fileData, fileEntry, node => {
      // parse CSS imports
      if (node.type === 'ImportDeclaration') {
        const importPath = node.source.value
        const isRequiredCssFile = options.styleGlobs.some(glob => importPath.endsWith(glob))

        if (isRequiredCssFile) {
          const fullPathToCssFile = path.join(path.dirname(fileEntry), node.source.value)

          // Skip CSS files from ignore array
          if (options.ignore?.some(ignoreOpt => fullPathToCssFile.endsWith(ignoreOpt))) {
            return
          }

          const stylesImportIdentifier = node.specifiers.at(0)?.local.name

          if (cssFilesUsedByComponents[fullPathToCssFile]) {
            cssFilesUsedByComponents[fullPathToCssFile].usedBy.push(fileEntry)
          } else {
            const cssFileSelectors = parseCssFileSelectors(fullPathToCssFile)
            const selectorsCounter: Record<string, number> = {}

            cssFileSelectors.forEach(selector => {
              selectorsCounter[selector] = 0
            })

            cssFilesUsedByComponents[fullPathToCssFile] = {
              selectors: selectorsCounter,
              usedBy: [fileEntry],
            }
          }

          if (!selectorsInJsx[fileEntry]) {
            selectorsInJsx[fileEntry] = {}
          }

          if (!selectorsInJsx[fileEntry].cssFilePath) {
            selectorsInJsx[fileEntry].cssFilePath = fullPathToCssFile
            selectorsInJsx[fileEntry].stylesIdentifier = stylesImportIdentifier
          }
        }
      }

      // Count selectors used in JSX
      if (isNodeReferencingStyles(node, selectorsInJsx[fileEntry])) {
        const cssSelector = node.property.name

        if (!selectorsInJsx[fileEntry]) {
          selectorsInJsx[fileEntry] = {}
        }

        if (!selectorsInJsx[fileEntry].selectors) {
          selectorsInJsx[fileEntry].selectors = {}
        }

        if (!selectorsInJsx[fileEntry].selectors[cssSelector]) {
          selectorsInJsx[fileEntry].selectors[cssSelector] = 0
        }

        selectorsInJsx[fileEntry].selectors[cssSelector] += 1
      }
    })
  }

  const undefinedSelectors: ParseResult['undefinedSelectors'] = {}

  // Count usages
  for (const [jsxFilePath, stats] of Object.entries(selectorsInJsx)) {
    if (stats.cssFilePath && stats.selectors && cssFilesUsedByComponents[stats.cssFilePath]) {
      for (const [selectorName, count] of Object.entries(stats.selectors)) {
        cssFilesUsedByComponents[stats.cssFilePath].selectors[selectorName] += count

        if (options.reverse) {
          const isUndefinedSelector =
            !cssFilesUsedByComponents[stats.cssFilePath].selectors[selectorName]

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

  return {
    selectorsUsage: cssFilesUsedByComponents,
    undefinedSelectors,
  }
}

type MemberExpressionWithIdentifierProperty = MemberExpression & {
  property: Identifier
}

function isNodeReferencingStyles(
  node: AstNode,
  jsxFileStat: JsxFileStats | undefined,
): node is MemberExpressionWithIdentifierProperty {
  return (
    node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    node.property.type === 'Identifier' &&
    node.object.name === jsxFileStat?.stylesIdentifier
  )
}

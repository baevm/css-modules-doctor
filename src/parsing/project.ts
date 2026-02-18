import fsPromises from 'node:fs/promises'
import path from 'node:path'
import fastglob from 'fast-glob'
import { parseAndWalk } from 'oxc-walker'

import type { Identifier } from 'oxc-walker'
import type {
  Node as AstNode,
  ImportDeclaration,
  MemberExpression,
  StringLiteral,
} from 'oxc-parser'
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

type StylesProperty = Identifier | StringLiteral

type StylesMemberExpression = MemberExpression & {
  object: Identifier
  property: StylesProperty
}

export class ProjectParser {
  private readonly projectPath: string
  private readonly options: Config

  constructor(projectPath: string, options: Config) {
    this.projectPath = projectPath
    this.options = options
  }

  async parse(): Promise<ParseResult> {
    const componentsGlob = this.buildComponentsGlob()
    const fileEntries = await fastglob(componentsGlob, { ignore: this.options.ignore })

    const cssFilesUsedByComponents: ParseResult['selectorsUsage'] = {}
    const selectorsInJsx: Record<string, JsxFileStats> = {}

    for (const fileEntry of fileEntries) {
      const fileData = await fsPromises.readFile(fileEntry, { encoding: 'utf-8' })

      parseAndWalk(fileData, fileEntry, node => {
        if (node.type === 'ImportDeclaration') {
          this.handleCssImportDeclaration(node, fileEntry, cssFilesUsedByComponents, selectorsInJsx)
        }

        this.countSelectorUsage(node, fileEntry, selectorsInJsx)
      })
    }

    const undefinedSelectors = this.countSelectorsUsage(selectorsInJsx, cssFilesUsedByComponents)

    return {
      selectorsUsage: cssFilesUsedByComponents,
      undefinedSelectors,
    }
  }

  private buildComponentsGlob() {
    const componentFileExtensions =
      this.options.exts.length > 1 ? this.options.exts.join(',') : this.options.exts[0]

    return (
      this.projectPath +
      (this.options.exts.length > 1
        ? `/**/*.{${componentFileExtensions}}`
        : `/**/*.${componentFileExtensions}`)
    )
  }

  private buildCssFileStatsSelectors(cssFilePath: string): CssFileStats['selectors'] {
    const cssFileSelectors = parseCssFileSelectors(cssFilePath)
    const selectorsCounter: CssFileStats['selectors'] = {}

    cssFileSelectors.forEach(selector => {
      selectorsCounter[selector] = 0
    })

    return selectorsCounter
  }

  private handleCssImportDeclaration(
    node: ImportDeclaration,
    fileEntry: string,
    cssFilesUsedByComponents: ParseResult['selectorsUsage'],
    selectorsInJsx: Record<string, JsxFileStats>,
  ) {
    const importPath = node.source.value
    const isCssFile = this.isCssPath(importPath)

    if (!isCssFile) {
      return
    }

    const fullPathToCssFile = path.join(path.dirname(fileEntry), node.source.value)

    if (this.isCssFileIgnored(fullPathToCssFile)) {
      return
    }

    if (cssFilesUsedByComponents[fullPathToCssFile]) {
      cssFilesUsedByComponents[fullPathToCssFile].usedBy.push(fileEntry)
    } else {
      const emptySelectorsCounter = this.buildCssFileStatsSelectors(fullPathToCssFile)

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

  // Skip CSS files from ignore array
  private isCssFileIgnored(cssFullPath: string) {
    return this.options.ignore?.some(ignoreOpt => cssFullPath.endsWith(ignoreOpt))
  }

  private isCssPath(importPath: string) {
    return this.options.styleGlobs.some(glob => importPath.endsWith(glob))
  }

  private countSelectorUsage(
    node: AstNode,
    fileEntry: string,
    selectorsInJsx: Record<string, JsxFileStats>,
  ) {
    const isNeededNode = this.isNodeReferencingStyles(node, selectorsInJsx[fileEntry])

    if (!isNeededNode) {
      return
    }

    const stylesIdentifier = node.object.name
    const cssSelector = this.getSelectorFromStylesProperty(node.property)
    const statsForIdentifier = selectorsInJsx[fileEntry]?.stats[stylesIdentifier]

    if (!statsForIdentifier) {
      return
    }

    if (!statsForIdentifier.selectors) {
      statsForIdentifier.selectors = {}
    }

    statsForIdentifier.selectors[cssSelector] = (statsForIdentifier.selectors[cssSelector] || 0) + 1
  }

  private countSelectorsUsage(
    selectorsInJsx: Record<string, JsxFileStats>,
    cssFilesUsedByComponents: ParseResult['selectorsUsage'],
  ): ParseResult['undefinedSelectors'] {
    const undefinedSelectors: ParseResult['undefinedSelectors'] = {}

    for (const [jsxFilePath, jsxStats] of Object.entries(selectorsInJsx)) {
      for (const stats of Object.values(jsxStats.stats)) {
        const cssFileStats = cssFilesUsedByComponents[stats.cssFilePath]

        if (!stats.cssFilePath || !stats.selectors || !cssFileStats) {
          continue
        }

        for (const [selectorName, count] of Object.entries(stats.selectors)) {
          const currentSelectorCount = cssFileStats.selectors[selectorName]

          if (currentSelectorCount !== undefined) {
            cssFileStats.selectors[selectorName] = currentSelectorCount + count
          }

          if (this.options.reverse) {
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

    return undefinedSelectors
  }

  private isNodeReferencingStyles(
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

  private getSelectorFromStylesProperty(property: StylesProperty): string {
    return property.type === 'Identifier' ? property.name : property.value
  }
}

export async function parseProject(projectPath: string, options: Config): Promise<ParseResult> {
  const parser = new ProjectParser(projectPath, options)
  return parser.parse()
}

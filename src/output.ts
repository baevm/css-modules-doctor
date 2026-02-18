import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { formatUndefinedSelectors, formatUnusedSelectors, getAllUnusedSelectors } from './format.ts'
import type { ParseResult } from './parsing/project.ts'
import type { Config, OutputFormat } from './types.ts'

type OutputOptions = Pick<Config, 'output' | 'outputFormat' | 'reverse'>

type JsonReport = {
  unusedSelectors: { cssFilePath: string; selectors: string[] }[]
  undefinedSelectors?: { jsxFilePath: string; cssFilePath: string; selectors: string[] }[]
  stats: {
    totalUnusedSelectors: number
    totalUndefinedSelectors?: number
  }
}

const SUPPORTED_FORMATS: OutputFormat[] = ['cli', 'json', 'md']

export function resolveOutputFormat(options: OutputOptions): OutputFormat {
  if (options.outputFormat) {
    const normalized = options.outputFormat.toLowerCase() as OutputFormat

    if (SUPPORTED_FORMATS.includes(normalized)) {
      return normalized
    }

    throw new Error(`Unsupported output format: ${options.outputFormat}`)
  }

  if (options.output) {
    const ext = path.extname(options.output).toLowerCase()

    if (ext === '.json') {
      return 'json'
    }

    if (ext === '.md') {
      return 'md'
    }
  }

  return 'cli'
}

export function buildReportOutput(parseResult: ParseResult, options: OutputOptions): string {
  const unusedSelectors = getAllUnusedSelectors(parseResult.selectorsUsage)
  const { table: unusedTable, stats: unusedStats } = formatUnusedSelectors(unusedSelectors)

  const format = resolveOutputFormat(options)

  if (format === 'cli') {
    const outputLines = [unusedTable.toString()]

    if (options.reverse) {
      const { table: undefinedTable, stats: undefinedStats } = formatUndefinedSelectors(
        parseResult.undefinedSelectors,
      )
      outputLines.push(undefinedTable.toString())
      outputLines.push(
        `Total undefined selectors: ${String(undefinedStats.totalUndefinedSelectors)}`,
      )
    }

    outputLines.push(`Total unused selectors: ${String(unusedStats.totalUnusedSelectors)}`)
    return outputLines.join('\n')
  }

  if (format === 'json') {
    const jsonReport = buildJsonReport(parseResult, options.reverse ?? false)
    return JSON.stringify(jsonReport, null, 2)
  }

  return buildMarkdownReport(parseResult, options.reverse ?? false)
}

export async function writeReportOutput(output: string, outputPath?: string): Promise<void> {
  if (!outputPath) {
    console.log(output)
    return
  }

  const outputDirPath = path.dirname(outputPath)
  await fsPromises.mkdir(outputDirPath, { recursive: true })
  await fsPromises.writeFile(outputPath, output, { encoding: 'utf-8' })
}

function buildJsonReport(parseResult: ParseResult, includeUndefinedSelectors: boolean): JsonReport {
  const unusedSelectors = getAllUnusedSelectors(parseResult.selectorsUsage)
  const { stats: unusedStats } = formatUnusedSelectors(unusedSelectors)
  const { stats: undefinedStats } = formatUndefinedSelectors(parseResult.undefinedSelectors)

  const jsonReport: JsonReport = {
    unusedSelectors: [...unusedSelectors.entries()].map(([cssFilePath, selectors]) => ({
      cssFilePath,
      selectors,
    })),
    stats: {
      totalUnusedSelectors: unusedStats.totalUnusedSelectors,
    },
  }

  if (includeUndefinedSelectors) {
    jsonReport.undefinedSelectors = Object.entries(parseResult.undefinedSelectors).map(
      ([jsxFilePath, value]) => ({
        jsxFilePath,
        cssFilePath: value.cssFilePath,
        selectors: value.selectors,
      }),
    )
    jsonReport.stats.totalUndefinedSelectors = undefinedStats.totalUndefinedSelectors
  }

  return jsonReport
}

function buildMarkdownReport(parseResult: ParseResult, includeUndefinedSelectors: boolean): string {
  const unusedSelectors = getAllUnusedSelectors(parseResult.selectorsUsage)
  const { stats: unusedStats } = formatUnusedSelectors(unusedSelectors)
  const { stats: undefinedStats } = formatUndefinedSelectors(parseResult.undefinedSelectors)

  const lines = [
    '# CSS Modules Doctor Report',
    '',
    '## Unused selectors',
    '',
    '| CSS file path | Unused selectors |',
    '| --- | --- |',
  ]

  if (unusedSelectors.size === 0) {
    lines.push('| _None_ | - |')
  } else {
    for (const [cssFilePath, selectors] of unusedSelectors.entries()) {
      lines.push(
        `| ${escapeMarkdownCell(cssFilePath)} | ${escapeMarkdownCell(selectors.join('<br />'))} |`,
      )
    }
  }

  if (includeUndefinedSelectors) {
    lines.push(
      '',
      '## Undefined selectors',
      '',
      '| JSX file path | CSS file path | Undefined selectors |',
      '| --- | --- | --- |',
    )

    const undefinedSelectorEntries = Object.entries(parseResult.undefinedSelectors)

    if (undefinedSelectorEntries.length === 0) {
      lines.push('| _None_ | _None_ | - |')
    } else {
      for (const [jsxFilePath, value] of undefinedSelectorEntries) {
        lines.push(
          `| ${escapeMarkdownCell(jsxFilePath)} | ${escapeMarkdownCell(value.cssFilePath)} | ${escapeMarkdownCell(value.selectors.join('<br />'))} |`,
        )
      }
    }
  }

  lines.push(
    '',
    '## Stats',
    '',
    `- Total unused selectors: ${String(unusedStats.totalUnusedSelectors)}`,
  )

  if (includeUndefinedSelectors) {
    lines.push(`- Total undefined selectors: ${String(undefinedStats.totalUndefinedSelectors)}`)
  }

  return lines.join('\n')
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll('|', '\\|')
}

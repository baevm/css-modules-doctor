import type { CssFileStats, ParseResult } from './parsing.ts'
import Table from 'cli-table3'

type UnusedSelectors = Map<string, string[]>

export function getAllUnusedSelectors(fileStats: Record<string, CssFileStats>) {
  const unusedSelectors: UnusedSelectors = new Map()

  for (const [cssFilePath, stats] of Object.entries(fileStats)) {
    for (const [selectorName, count] of Object.entries(stats.selectors)) {
      if (count === 0) {
        if (!unusedSelectors.has(cssFilePath)) {
          unusedSelectors.set(cssFilePath, [])
        }

        unusedSelectors.get(cssFilePath)?.push(selectorName)
      }
    }
  }

  return unusedSelectors
}

type UnusedStats = {
  totalUnusedSelectors: number
}

export function formatUnusedSelectors(unusedSelectors: UnusedSelectors): {
  table: Table.Table
  stats: UnusedStats
} {
  const table = new Table({
    head: ['CSS file path', 'Unused selectors'],
  })

  const sortedDesc = [...unusedSelectors.entries()].sort((a, b) => b[1].length - a[1].length)

  const stats: UnusedStats = {
    totalUnusedSelectors: 0,
  }

  for (const [cssFilePath, selectors] of sortedDesc) {
    table.push([cssFilePath, selectors.join('\n')])
    stats.totalUnusedSelectors += selectors.length
  }

  return { table, stats }
}

type UndefinedStats = {
  totalUndefinedSelectors: number
}

export function formatUndefinedSelectors(undefinedSelectors: ParseResult['undefinedSelectors']): {
  table: Table.Table
  stats: UndefinedStats
} {
  const table = new Table({
    head: ['JSX file path', 'CSS file path', 'Undefined selectors'],
  })

  const sortedDesc = Object.entries(undefinedSelectors).sort(
    (a, b) => b[1].selectors.length - a[1].selectors.length,
  )

  const stats: UndefinedStats = {
    totalUndefinedSelectors: 0,
  }

  for (const [jsxFilePath, { cssFilePath, selectors }] of sortedDesc) {
    table.push([jsxFilePath, cssFilePath, selectors.join('\n')])
    stats.totalUndefinedSelectors += selectors.length
  }

  return { table, stats }
}

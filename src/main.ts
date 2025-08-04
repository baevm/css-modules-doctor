#! /usr/bin/env node

import { parseProject } from './parsing.ts'
import { Command } from 'commander'
import type { Config } from './types.ts'
import { formatUndefinedSelectors, formatUnusedSelectors, getAllUnusedSelectors } from './format.ts'

const program = new Command()

program
  .name('cssmdoc')
  .description('Finds unused CSS modules selectors')
  .argument('<dir>', 'path to project')
  .option(
    '-i, --ignore <paths...>',
    'Comma-separated paths to ignore. Can be directories or specific CSS files.',
  )
  .option('--styleGlobs <globs...>', 'Glob patterns for CSS module files. Uses .css by default', [
    '.css',
  ])
  .option('--exts <exts...>', 'Component file extensions. Uses [jsx|tsx] by default', [
    'jsx',
    'tsx',
  ])
  .option(
    '-r, --reverse',
    'Reverse mode - find selectors used in components but not existing in CSS file. Default: false',
  )
  .action(async (dir: string, options: Config) => {
    await run(dir, options)
  })

program.parse()

async function run(pathToProject: string, options: Config) {
  const { selectorsUsage, undefinedSelectors } = await parseProject(pathToProject, options)

  const unusedSelectors = getAllUnusedSelectors(selectorsUsage)

  const { table, stats } = formatUnusedSelectors(unusedSelectors)

  console.log(table.toString())

  if (options.reverse) {
    const { table, stats } = formatUndefinedSelectors(undefinedSelectors)
    console.log(table.toString())
    console.log(`Total undefined selectors: ${stats.totalUndefinedSelectors}`)
  }

  console.log(`Total unused selectors: ${stats.totalUnusedSelectors}`)
}

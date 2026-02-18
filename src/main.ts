#! /usr/bin/env node

import { parseProject } from './parsing/project.ts'
import { Command } from 'commander'
import type { Config } from './types.ts'
import { buildReportOutput, writeReportOutput } from './output.ts'

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
  .option('-o, --output <path>', 'Output file path. Prints to console when omitted')
  .option(
    '--outputFormat <format>',
    'Output format: cli | json | md. Defaults to cli or inferred from output extension (.json/.md)',
  )
  .action(async (dir: string, options: Config) => {
    await run(dir, options)
  })

program.parse()

async function run(pathToProject: string, options: Config) {
  const parseResult = await parseProject(pathToProject, options)
  const reportOutput = buildReportOutput(parseResult, options)
  await writeReportOutput(reportOutput, options.output)
}

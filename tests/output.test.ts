import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseProject } from '../src/parsing/project.ts'
import { buildReportOutput, resolveOutputFormat, writeReportOutput } from '../src/output.ts'
import type { Config } from '../src/types.ts'

describe('output', () => {
  const projectPath = path.join(import.meta.dirname, 'mockProject')

  const parseOptions: Config = {
    exts: ['jsx'],
    styleGlobs: ['.css', '.module.css', '.scss'],
    reverse: true,
  }

  it('should default to cli output format', () => {
    expect(resolveOutputFormat({})).toBe('cli')
  })

  it('should infer json and md output format from file extension', () => {
    expect(resolveOutputFormat({ output: 'result.json' })).toBe('json')
    expect(resolveOutputFormat({ output: 'result.md' })).toBe('md')
  })

  it('should use explicitly provided output format', () => {
    expect(resolveOutputFormat({ output: 'result.json', outputFormat: 'md' })).toBe('md')
  })

  it('should throw on unsupported output format', () => {
    expect(() => resolveOutputFormat({ outputFormat: 'xml' as Config['outputFormat'] })).toThrow(
      'Unsupported output format: xml',
    )
  })

  it('should build cli output with tables and stats', async () => {
    const parseResult = await parseProject(projectPath, parseOptions)
    const output = buildReportOutput(parseResult, { reverse: true, outputFormat: 'cli' })

    expect(output).toContain('CSS file path')
    expect(output).toContain('Unused selectors')
    expect(output).toContain('Undefined selectors')
    expect(output).toContain('Total undefined selectors:')
    expect(output).toContain('Total unused selectors:')
  })

  it('should build json output with selectors and stats', async () => {
    const parseResult = await parseProject(projectPath, parseOptions)
    const output = buildReportOutput(parseResult, { reverse: true, outputFormat: 'json' })
    const parsed = JSON.parse(output) as {
      unusedSelectors: { cssFilePath: string; selectors: string[] }[]
      undefinedSelectors?: { jsxFilePath: string; cssFilePath: string; selectors: string[] }[]
      stats: { totalUnusedSelectors: number; totalUndefinedSelectors?: number }
    }

    expect(parsed.unusedSelectors.length).toBeGreaterThan(0)
    expect(parsed.stats.totalUnusedSelectors).toBeGreaterThan(0)
    expect(parsed.undefinedSelectors?.length).toBeGreaterThan(0)
    expect(parsed.stats.totalUndefinedSelectors).toBeGreaterThan(0)
  })

  it('should build markdown output with report sections', async () => {
    const parseResult = await parseProject(projectPath, parseOptions)
    const output = buildReportOutput(parseResult, { reverse: true, outputFormat: 'md' })

    expect(output).toContain('# CSS Modules Doctor Report')
    expect(output).toContain('## Unused selectors')
    expect(output).toContain('## Undefined selectors')
    expect(output).toContain('## Stats')
    expect(output).toContain('| CSS file path | Unused selectors |')
  })

  it('should write output to file when output path is provided', async () => {
    const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'cssmdoc-output-test-'))
    const outputPath = path.join(tempDir, 'report.json')
    const expectedOutput = '{"ok":true}'

    await writeReportOutput(expectedOutput, outputPath)

    const writtenContent = await fsPromises.readFile(outputPath, { encoding: 'utf-8' })
    expect(writtenContent).toBe(expectedOutput)
  })
})

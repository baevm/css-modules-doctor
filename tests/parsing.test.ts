import { describe, it, expect, vi } from 'vitest'
import path from 'node:path'
import { parseProject } from '../src/parsing.ts'
import type { Config } from '../src/types.ts'

describe('parseProject', () => {
  const projectPath = path.join(import.meta.dirname, 'mockProject')

  const options: Config = {
    exts: ['jsx'],
    styleGlobs: ['.css', '.module.css', '.scss'],
  }

  it('should correctly count selector usages', async () => {
    const { selectorsUsage } = await parseProject(projectPath, options)
    const cssFilePath = path.join(projectPath, 'styles.module.css')
    const { selectors } = selectorsUsage[cssFilePath]!

    expect(selectors.selectorForKey).toBe(1)
    expect(selectors.randomSelector).toBe(1)
    expect(selectors.buttonSelector).toBe(2)
    expect(selectors.selectorForComponent).toBe(2)
    expect(selectors.element).toBe(1)
  })

  it('should find all unused selectors', async () => {
    const { selectorsUsage } = await parseProject(projectPath, options)
    const cssFilePath = path.join(projectPath, 'styles.module.css')

    const { selectors } = selectorsUsage[cssFilePath]!

    const unusedSelectors = Object.keys(selectors).filter(key => selectors[key] === 0)

    expect(unusedSelectors).toEqual(
      expect.arrayContaining([
        'unusedSelectorRandom',
        'doubleUnused',
        'selectorAndButton',
        'nestedSelectorAndButton',
        'card',
        'cardTitle',
      ]),
    )
    expect(unusedSelectors.length).toBe(6)
  })

  it('should find undefined selectors in reverse mode', async () => {
    const { undefinedSelectors } = await parseProject(projectPath, {
      ...options,
      reverse: true,
    })

    const componentPath = path.join(projectPath, 'notExistingSelectors', 'importantComponent.jsx')

    const selectors = undefinedSelectors[componentPath]!.selectors

    expect(selectors).toContain('notExisting')
    expect(selectors).toContain('someText')
  })

  it('should handle different style file extensions like .scss', async () => {
    const { selectorsUsage } = await parseProject(projectPath, options)
    const scssFilePath = path.join(projectPath, 'scssComponent', 'styles.module.scss')
    expect(selectorsUsage[scssFilePath]!.selectors.usedBigAssSelector).toBe(1)
  })

  it('should handle components with different css import identifiers', async () => {
    const { selectorsUsage } = await parseProject(projectPath, options)
    const cssFilePath = path.join(projectPath, 'componentWithDifferentCssName', 'styles.css')
    expect(selectorsUsage[cssFilePath]!.selectors.testContainer).toBe(1)
  })

  it('should correctly parse string template selectors', async () => {
    const { selectorsUsage } = await parseProject(projectPath, options)
    const cssFilePath = path.join(projectPath, 'stringTemplateSelector', 'styles.css')

    const selectors = selectorsUsage[cssFilePath]!.selectors

    expect(selectors.firstClassName).toBe(1)
    expect(selectors.superUniqueUsedClassname).toBe(1)
  })

  it('should correctly work with multiple css files in single JSX file', async () => {
    const { selectorsUsage } = await parseProject(projectPath, options)
    const cssFilePath1 = path.join(projectPath, 'multipleStylesInOneFile', 'container.css')
    const cssFilePath2 = path.join(projectPath, 'multipleStylesInOneFile', 'text.css')

    expect(selectorsUsage[cssFilePath1]!.selectors.container).toBe(1)
    expect(selectorsUsage[cssFilePath1]!.selectors.unusedContainerStylesSelector).toBe(0)

    expect(selectorsUsage[cssFilePath2]!.selectors.text).toBe(1)
    expect(selectorsUsage[cssFilePath2]!.selectors.unusedTextStylesSelector).toBe(0)
  })

  it('should handle invalid css files gracefully and log an error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { selectorsUsage } = await parseProject(projectPath, options)
    const cssFilePath = path.join(projectPath, 'invalidCss', 'styles.module.css')

    // Invalid CSS file should be treated as having no selectors
    expect(selectorsUsage[cssFilePath]!.selectors).toEqual({})

    // An error should have been logged
    expect(consoleErrorSpy).toHaveBeenCalledOnce()
    const errorOutput = consoleErrorSpy.mock.calls[0]![0] as string
    expect(errorOutput).toContain('CSS Parse Error')
    expect(errorOutput).toContain(cssFilePath)

    consoleErrorSpy.mockRestore()
  })
})

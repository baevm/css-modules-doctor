import { describe, it, expect } from 'vitest'
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
    const { selectors } = selectorsUsage[cssFilePath]

    expect(selectors.selectorForKey).toBe(1)
    expect(selectors.randomSelector).toBe(1)
    expect(selectors.buttonSelector).toBe(2)
    expect(selectors.selectorForComponent).toBe(2)
    expect(selectors.element).toBe(1)
  })

  it('should find all unused selectors', async () => {
    const { selectorsUsage } = await parseProject(projectPath, options)
    const cssFilePath = path.join(projectPath, 'styles.module.css')

    const { selectors } = selectorsUsage[cssFilePath]

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

    expect(undefinedSelectors[componentPath].selectors).toContain('notExisting')
    expect(undefinedSelectors[componentPath].selectors).toContain('someText')
  })

  it('should handle different style file extensions like .scss', async () => {
    const { selectorsUsage } = await parseProject(projectPath, options)
    const scssFilePath = path.join(projectPath, 'scssComponent', 'styles.module.scss')
    expect(selectorsUsage[scssFilePath].selectors.usedBigAssSelector).toBe(1)
  })

  it('should handle components with different css import identifiers', async () => {
    const { selectorsUsage } = await parseProject(projectPath, options)
    const cssFilePath = path.join(projectPath, 'componentWithDifferentCssName', 'styles.css')
    expect(selectorsUsage[cssFilePath].selectors.testContainer).toBe(1)
  })

  it('should correctly parse string template selectors', async () => {
    const { selectorsUsage } = await parseProject(projectPath, options)
    const cssFilePath = path.join(projectPath, 'stringTemplateSelector', 'styles.css')

    expect(selectorsUsage[cssFilePath].selectors.firstClassName).toBe(1)
    expect(selectorsUsage[cssFilePath].selectors.superUniqueUsedClassname).toBe(1)
  })
})

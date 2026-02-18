import { transform } from 'lightningcss'
import fs from 'node:fs'
import util from 'node:util'

type TransformError<T> = {
  message: string
  loc?: {
    line: number
    column: number
  }
  source?: string
  data: T
}

/**
 * Parses all selectors from css file
 * @returns string[] - array of selectors
 */
export function parseCssFileSelectors(cssPath: string) {
  // todo: add handling for css files imported from node_modules
  if (!fs.existsSync(cssPath)) return []

  const fileData = fs.readFileSync(cssPath)

  try {
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
  } catch (error: unknown) {
    const err = error as TransformError<unknown>

    const filename = util.styleText('cyan', cssPath)
    const label = util.styleText(['bold', 'red'], 'CSS Parse Error')
    const reason = util.styleText('yellow', err.message ?? 'Unknown error')
    const loc = err.loc
      ? util.styleText('dim', ` (line ${err.loc.line}, col ${err.loc.column})`)
      : ''

    console.error(`${label} in ${filename}${loc}:  ${reason}`)
    return []
  }
}

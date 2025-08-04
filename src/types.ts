export type Config = {
  /** Paths to ignore. Empty array by default. Can be directories or specific CSS files.  */
  ignore?: string[]
  /** Glob patterns to find CSS module files. Uses .css by default */
  styleGlobs: string[]
  /** Component file extensions. Uses [jsx|tsx] by default  */
  exts: string[]
  reverse?: boolean
}

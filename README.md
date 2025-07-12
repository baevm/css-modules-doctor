# css-modules-doctor

A CLI tool to find unused CSS modules selectors in a project.

# Usage

```
cssmdoc <dir> [options]
```

### Options

- `-i, --ignore <paths...>`: Comma-separated paths to ignore. This can be directories or specific CSS files.
- `--styleGlobs <globs...>`: Glob patterns to find CSS module files. (default: `".css"`)
- `--exts <exts...>`: Component file extensions to check. (default: `"jsx"`, `"tsx"`)
- `-r, --reverse`: Enable reverse mode to find selectors used in components but not defined in CSS files.

### Examples

#### Find unused selectors

To find all unused CSS module selectors in the `test_project` directory:

```bash
cssmdoc ./test_project
```

#### Find undefined selectors (Reverse Mode)

To find selectors that are used in your components but don't exist in the corresponding CSS files:

```bash
cssmdoc ./test_project -r
```

#### Ignoring files and specifying extensions

To analyze a project with `.js` files and ignore the `dist` folder:

```bash
cssmdoc ./my-project --exts js --ignore dist
```

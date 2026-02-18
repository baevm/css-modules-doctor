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
- `-o, --output <path>`: Write report output to file instead of stdout.
- `--outputFormat <format>`: Output format: `cli`, `json`, or `md`.
  - Default: `cli`
  - If omitted and `--output` ends with `.json` or `.md`, format is inferred from extension.

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

#### Save report as JSON

```bash
cssmdoc ./test_project --output report.json
```

#### Save report as Markdown

```bash
cssmdoc ./test_project --output report.md
```

#### Force output format explicitly

```bash
cssmdoc ./test_project --output report.txt --outputFormat md
```

#### Ignoring files and specifying extensions

To analyze a project with `.js` files and ignore the `dist` folder:

```bash
cssmdoc ./my-project --exts js --ignore dist
```

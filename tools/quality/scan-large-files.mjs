import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_ROOTS = ['src', 'tests', 'tools']
export const DEFAULT_EXTENSIONS = ['.vue', '.ts', '.tsx', '.js', '.jsx', '.mjs']
export const DEFAULT_SKIP_DIRECTORIES = [
  '.git',
  '.playwright-cli',
  'dist',
  'node_modules',
  'target',
  'test-results',
]
export const DEFAULT_MAX_LINES = 800
export const DEFAULT_MAX_KB = 80

function parseNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizePath(value) {
  return value.replace(/\\/g, '/')
}

function walkFiles(directory, options, files) {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!options.skipDirectories.has(entry.name)) {
        walkFiles(fullPath, options, files)
      }
      continue
    }
    if (!entry.isFile()) continue
    if (!options.extensions.has(path.extname(entry.name))) continue
    files.push(fullPath)
  }
}

export function scanLargeFiles(options = {}) {
  const cwd = options.cwd || process.cwd()
  const roots = options.roots || DEFAULT_ROOTS
  const maxLines = parseNumber(options.maxLines, DEFAULT_MAX_LINES)
  const maxKb = parseNumber(options.maxKb, DEFAULT_MAX_KB)
  const scanOptions = {
    extensions: new Set(options.extensions || DEFAULT_EXTENSIONS),
    skipDirectories: new Set(options.skipDirectories || DEFAULT_SKIP_DIRECTORIES),
  }
  const files = []

  for (const root of roots) {
    walkFiles(path.join(cwd, root), scanOptions, files)
  }

  const large = files
    .map((filePath) => {
      const text = fs.readFileSync(filePath, 'utf8')
      const bytes = Buffer.byteLength(text)
      const lines = text.length ? text.split(/\r\n|\n|\r/).length : 0
      return {
        path: normalizePath(path.relative(cwd, filePath)),
        lines,
        kb: Number((bytes / 1024).toFixed(1)),
        overLines: lines >= maxLines,
        overKb: bytes >= maxKb * 1024,
      }
    })
    .filter(item => item.overLines || item.overKb)
    .sort((left, right) => right.lines - left.lines || right.kb - left.kb)

  return {
    scannedFiles: files.length,
    threshold: {
      maxLines,
      maxKb,
    },
    count: large.length,
    large,
  }
}

function printReport(report) {
  console.log(`Scanned files: ${report.scannedFiles}`)
  console.log(`Large-file threshold: >= ${report.threshold.maxLines} lines OR >= ${report.threshold.maxKb} KB`)
  console.log(`Large files: ${report.count}`)
  for (const item of report.large) {
    console.log(`${item.path}\t${item.lines} lines\t${item.kb} KB`)
  }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isCli) {
  const report = scanLargeFiles({
    cwd: process.cwd(),
    maxLines: process.env.MAX_LARGE_FILE_LINES,
    maxKb: process.env.MAX_LARGE_FILE_KB,
  })
  printReport(report)
  if (process.env.CI_LARGE_FILE_FAIL === '1' && report.count > 0) {
    process.exitCode = 1
  }
}

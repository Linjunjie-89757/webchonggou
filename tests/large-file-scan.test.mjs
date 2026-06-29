import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { scanLargeFiles } from '../tools/quality/scan-large-files.mjs'

test('scanLargeFiles reports files that exceed line threshold', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'large-file-scan-'))
  fs.mkdirSync(path.join(root, 'src'), { recursive: true })
  fs.writeFileSync(path.join(root, 'src', 'small.ts'), 'export const ok = true\n', 'utf8')
  fs.writeFileSync(path.join(root, 'src', 'large.ts'), Array.from({ length: 4 }, (_, index) => `line${index}`).join('\n'), 'utf8')

  const report = scanLargeFiles({
    cwd: root,
    roots: ['src'],
    maxLines: 4,
    maxKb: 1000,
  })

  assert.equal(report.scannedFiles, 2)
  assert.equal(report.count, 1)
  assert.equal(report.large[0].path, 'src/large.ts')
  assert.equal(report.large[0].lines, 4)
  assert.equal(report.large[0].overLines, true)
})

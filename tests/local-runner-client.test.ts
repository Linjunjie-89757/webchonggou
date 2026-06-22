import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LOCAL_RUNNER_BASE_URL,
  mapRunnerCandidateToCollectCandidate,
  normalizeRunnerHealth,
} from '../src/entities/web-ui-automation/lib/localRunnerClient.ts'

test('local runner client uses localhost runner endpoint', () => {
  assert.equal(LOCAL_RUNNER_BASE_URL, 'http://127.0.0.1:39118')
})

test('normalizeRunnerHealth keeps only the fields needed by the UI', () => {
  const health = normalizeRunnerHealth({
    success: true,
    runner: { version: '0.1.0', port: 39118 },
    playwright: { available: true },
    browsers: { chromium: { installed: true } },
    session: { currentUrl: 'https://example.test/orders' },
  })

  assert.deepEqual(health, {
    online: true,
    runnerVersion: '0.1.0',
    playwrightAvailable: true,
    chromiumInstalled: true,
    currentUrl: 'https://example.test/orders',
  })
})

test('mapRunnerCandidateToCollectCandidate maps runner candidates as static unverified first-phase results', () => {
  const candidate = mapRunnerCandidateToCollectCandidate({
    groupName: 'Login Form',
    screenshotBase64: 'screen',
    candidate: {
      name: 'Username',
      elementType: 'INPUT',
      locator: { strategy: 'TEST_ID', value: 'login-username' },
      text: '',
      placeholder: 'Input username',
      tagName: 'input',
      stabilityScore: 96,
      source: 'RULE',
    },
  })

  assert.equal(candidate.groupName, 'Login Form')
  assert.equal(candidate.elementName, 'Username')
  assert.equal(candidate.locatorType, 'TEST_ID')
  assert.equal(candidate.locatorValue, 'login-username')
  assert.equal(candidate.confidence, 96)
  assert.equal(candidate.candidateSource, 'STATIC_RULE')
  assert.equal(candidate.validationStatus, 'UNVERIFIED')
  assert.equal(candidate.matchCount, null)
  assert.equal(candidate.validationMessage, '静态生成，尚未经过 Runner 真机验证')
  assert.equal(candidate.screenshotBase64, 'screen')
})

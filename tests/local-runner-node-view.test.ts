import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isRunnerSelectable,
  runnerOptionLabel,
  runnerUnselectableReason,
} from '../src/entities/local-runner/lib/runnerNodeView.ts'
import type { RunnerNodeSummary } from '../src/entities/local-runner/model/types.ts'

test('runner node view uses backend selectable state when present', () => {
  const runner = runnerNode({
    runnerId: 'runner-busy',
    runnerName: 'Busy Runner',
    offline: false,
    status: 'ONLINE',
    capabilities: ['WEB_CASE_RUN'],
    selectable: false,
    unselectableReason: 'Insufficient resource slots',
  })

  assert.equal(isRunnerSelectable(runner, 'WEB_CASE_RUN'), false)
  assert.equal(runnerUnselectableReason(runner, 'WEB_CASE_RUN'), 'Insufficient resource slots')
  assert.match(runnerOptionLabel(runner, 'WEB_CASE_RUN'), /不可用/)
})

test('runner node view keeps legacy local capability fallback', () => {
  const runner = runnerNode({
    runnerId: 'runner-api',
    runnerName: 'API Runner',
    offline: false,
    status: 'ONLINE',
    capabilities: ['API_SCENARIO_RUN'],
  })

  assert.equal(isRunnerSelectable(runner, 'WEB_CASE_RUN'), false)
  assert.equal(runnerUnselectableReason(runner, 'WEB_CASE_RUN'), '能力不匹配')
})

function runnerNode(overrides: Partial<RunnerNodeSummary>): RunnerNodeSummary {
  return {
    runnerId: 'runner-1',
    runnerName: 'Runner 1',
    status: 'ONLINE',
    runnerVersion: '0.1.0',
    protocolVersion: '1.0',
    capabilities: [],
    resource: {},
    browser: {},
    session: {},
    lastHeartbeatAt: null,
    secondsSinceHeartbeat: null,
    offline: false,
    activeTasks: [],
    ...overrides,
  }
}

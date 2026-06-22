import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCollectTaskStages,
  isCollectTaskTerminalStatus,
  normalizeElementCollectTaskResponse,
} from '../src/entities/web-ui-automation/lib/collectTask.ts'

test('normalizes web ui collect task detail with filter logs', () => {
  const task = normalizeElementCollectTaskResponse({
    taskId: 12,
    status: 'COMPLETED',
    currentStage: 'FINALIZE',
    progressPercent: 100,
    source: 'LOCAL_RUNNER_STATIC',
    actualUrl: 'https://example.test/orders',
    pageTitle: 'Orders',
    rawCount: 4,
    finalCount: 1,
    filterSummary: {
      originalCount: 4,
      emptyLocatorCount: 1,
      duplicateCount: 1,
      lowStabilityCount: 1,
      finalCount: 1,
    },
    filterLogs: [
      {
        stage: 'STATIC_RULE',
        reason: 'DUPLICATE_LOCATOR',
        count: 1,
        message: '重复定位器候选已合并',
      },
    ],
    candidates: [],
    message: 'done',
    createdAt: '2026-06-22T23:00:00',
    completedAt: '2026-06-22T23:00:01',
  })

  assert.equal(task.taskId, 12)
  assert.equal(task.currentStage, 'FINALIZE')
  assert.equal(task.progressPercent, 100)
  assert.equal(task.filterSummary?.duplicateCount, 1)
  assert.deepEqual(task.filterLogs, [
    {
      stage: 'STATIC_RULE',
      reason: 'DUPLICATE_LOCATOR',
      count: 1,
      message: '重复定位器候选已合并',
    },
  ])
})

test('builds front-end stage model for completed static collect task', () => {
  const stages = buildCollectTaskStages({
    taskId: 12,
    status: 'COMPLETED',
    currentStage: 'FINALIZE',
    progressPercent: 100,
    source: 'LOCAL_RUNNER_STATIC',
    actualUrl: 'https://example.test/orders',
    pageTitle: 'Orders',
    rawCount: 4,
    finalCount: 1,
    filterSummary: null,
    filterLogs: [],
    candidates: [],
    message: null,
    createdAt: '2026-06-22T23:00:00',
    completedAt: '2026-06-22T23:00:01',
  })

  assert.deepEqual(stages.map(stage => [stage.key, stage.status]), [
    ['UPLOAD_SNAPSHOT', 'done'],
    ['RULE_CLEAN', 'done'],
    ['AI_ANALYZE', 'pending'],
    ['LOCAL_VALIDATE', 'pending'],
    ['FINALIZE', 'done'],
  ])
})

test('builds degraded stage model when local validation is skipped', () => {
  const stages = buildCollectTaskStages({
    taskId: 13,
    status: 'DEGRADED',
    currentStage: 'LOCAL_VALIDATE',
    progressPercent: 80,
    source: 'LOCAL_RUNNER_STATIC',
    actualUrl: null,
    pageTitle: null,
    rawCount: 4,
    finalCount: 1,
    filterSummary: null,
    filterLogs: [],
    candidates: [],
    message: '本地 Runner 离线，已降级输出静态候选',
    createdAt: null,
    completedAt: null,
  })

  const localValidate = stages.find(stage => stage.key === 'LOCAL_VALIDATE')
  const finalize = stages.find(stage => stage.key === 'FINALIZE')
  assert.equal(localValidate?.status, 'degraded')
  assert.equal(localValidate?.description, '本地 Runner 离线，已降级输出静态候选')
  assert.equal(finalize?.status, 'done')
})

test('builds running stage model from backend current stage', () => {
  const stages = buildCollectTaskStages({
    taskId: 14,
    status: 'PROCESSING',
    currentStage: 'AI_ANALYZE',
    progressPercent: 60,
    source: 'LOCAL_RUNNER_STATIC',
    actualUrl: null,
    pageTitle: null,
    rawCount: 4,
    finalCount: 0,
    filterSummary: null,
    filterLogs: [],
    candidates: [],
    message: null,
    createdAt: null,
    completedAt: null,
  })

  assert.deepEqual(stages.map(stage => [stage.key, stage.status]), [
    ['UPLOAD_SNAPSHOT', 'done'],
    ['RULE_CLEAN', 'done'],
    ['AI_ANALYZE', 'running'],
    ['LOCAL_VALIDATE', 'pending'],
    ['FINALIZE', 'pending'],
  ])
})

test('identifies collect task terminal statuses for polling', () => {
  assert.equal(isCollectTaskTerminalStatus('COMPLETED'), true)
  assert.equal(isCollectTaskTerminalStatus('FAILED'), true)
  assert.equal(isCollectTaskTerminalStatus('DEGRADED'), true)
  assert.equal(isCollectTaskTerminalStatus('CANCELED'), true)
  assert.equal(isCollectTaskTerminalStatus('PROCESSING'), false)
  assert.equal(isCollectTaskTerminalStatus('PENDING'), false)
})

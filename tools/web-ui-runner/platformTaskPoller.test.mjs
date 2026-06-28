import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildRunnerResourceSnapshot, runApiScript } from './platformTaskPoller.mjs';

test('buildRunnerResourceSnapshot reports web tasks as high resource cost', () => {
  const snapshot = buildRunnerResourceSnapshot({
    maxResourceSlots: 8,
    currentRunId: 'run-web-001',
    currentTaskType: 'WEB_CASE_RUN',
    webElementValidateExecutor: true,
    webCaseRunExecutor: true,
  });

  assert.equal(snapshot.maxSlots, 8);
  assert.equal(snapshot.usedSlots, 5);
  assert.equal(snapshot.availableSlots, 3);
  assert.deepEqual(snapshot.runningRunIds, ['run-web-001']);
});

test('buildRunnerResourceSnapshot reports api tasks as low resource cost', () => {
  const snapshot = buildRunnerResourceSnapshot({
    maxResourceSlots: 4,
    currentRunId: 'run-api-001',
    currentTaskType: 'API_SCENARIO_RUN',
  });

  assert.equal(snapshot.maxSlots, 4);
  assert.equal(snapshot.usedSlots, 1);
  assert.equal(snapshot.availableSlots, 3);
});

test('buildRunnerResourceSnapshot caps used slots at max slots', () => {
  const snapshot = buildRunnerResourceSnapshot({
    maxResourceSlots: 3,
    currentRunId: 'run-web-002',
    currentTaskType: 'WEB_ELEMENT_VALIDATE',
  });

  assert.equal(snapshot.maxSlots, 3);
  assert.equal(snapshot.usedSlots, 3);
  assert.equal(snapshot.availableSlots, 0);
});

test('runApiScript supports legacy variable helpers for backend parity', () => {
  const runtimeVariables = { seed: 'alpha' };

  const result = runApiScript(`
    setVar('token', getVar('seed') + '-token');
    removeVar('seed');
    log(utils.upper('ok'));
  `, {
    runtimeVariables,
    phase: 'pre',
  });

  assert.equal(result.status, 'SUCCESS');
  assert.deepEqual(runtimeVariables, { token: 'alpha-token' });
});

test('runApiScript blocks Function constructor escape', () => {
  assert.throws(() => runApiScript(`
    variables.set('leak', Function('return process')().cwd());
  `, {
    runtimeVariables: {},
    phase: 'pre',
  }), /Function is not defined|not a function/);
});

test('runApiScript blocks constructor constructor escape', () => {
  assert.throws(() => runApiScript(`
    variables.set('leak', this.constructor.constructor('return 1')());
  `, {
    runtimeVariables: {},
    phase: 'pre',
  }), /constructor is not defined|blocked unsafe/);
});

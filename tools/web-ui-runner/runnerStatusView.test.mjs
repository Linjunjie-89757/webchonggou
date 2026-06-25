import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LOCAL_RUNNER_INSTALL_CHROMIUM_COMMAND,
  LOCAL_RUNNER_START_COMMAND,
  buildLocalRunnerStatusView,
} from './runnerStatusView.mjs';

test('reports offline runner with startup command', () => {
  const status = buildLocalRunnerStatusView({
    errorMessage: 'Failed to fetch',
  });

  assert.equal(status.kind, 'OFFLINE');
  assert.equal(status.canCollect, false);
  assert.equal(status.alertType, 'error');
  assert.ok(status.description.includes('Failed to fetch'));
  assert.deepEqual(status.commands, [LOCAL_RUNNER_START_COMMAND]);
});

test('reports missing chromium with install command', () => {
  const status = buildLocalRunnerStatusView({
    health: {
      online: true,
      runnerVersion: '0.1.0',
      playwrightAvailable: true,
      chromiumInstalled: false,
      currentUrl: null,
    },
  });

  assert.equal(status.kind, 'CHROMIUM_MISSING');
  assert.equal(status.canCollect, false);
  assert.ok(status.commands.includes(LOCAL_RUNNER_INSTALL_CHROMIUM_COMMAND));
});

test('blocks collection on likely login page', () => {
  const status = buildLocalRunnerStatusView({
    health: {
      online: true,
      runnerVersion: '0.1.0',
      playwrightAvailable: true,
      chromiumInstalled: true,
      currentUrl: 'https://example.com/login',
    },
  });

  assert.equal(status.kind, 'LOGIN_PAGE');
  assert.equal(status.canCollect, false);
});

test('allows collection when current page differs from expected url but warns', () => {
  const status = buildLocalRunnerStatusView({
    expectedUrl: 'https://example.com/orders',
    health: {
      online: true,
      runnerVersion: '0.1.0',
      playwrightAvailable: true,
      chromiumInstalled: true,
      currentUrl: 'https://example.com/orders/list',
    },
  });

  assert.equal(status.kind, 'URL_MISMATCH');
  assert.equal(status.canCollect, true);
  assert.equal(status.alertType, 'warning');
});

test('reports ready when runner page matches expected page', () => {
  const status = buildLocalRunnerStatusView({
    expectedUrl: 'https://example.com/orders?tab=open',
    health: {
      online: true,
      runnerVersion: '0.1.0',
      playwrightAvailable: true,
      chromiumInstalled: true,
      currentUrl: 'https://example.com/orders?tab=open',
    },
  });

  assert.equal(status.kind, 'READY');
  assert.equal(status.canCollect, true);
  assert.equal(status.tagType, 'success');
});

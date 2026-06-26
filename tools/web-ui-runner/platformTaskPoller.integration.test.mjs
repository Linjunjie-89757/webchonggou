import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';

test('polls generic runner task and reports real WEB_ELEMENT_VALIDATE result', async () => {
  const runnerPort = await findAvailablePort();
  let platformPort = await findAvailablePort();
  while (platformPort === runnerPort) {
    platformPort = await findAvailablePort();
  }
  const runnerBaseUrl = `http://127.0.0.1:${runnerPort}`;
  const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
  const reports = {
    register: [],
    pull: [],
    status: [],
    logs: [],
    steps: [],
    results: [],
  };
  let taskPulled = false;

  const fakePlatform = createServer(async (request, response) => {
    const url = new URL(request.url || '/', platformBaseUrl);
    const body = await readJson(request);

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/register') {
      reports.register.push(body);
      return sendJson(response, 200, {
        success: true,
        data: {
          runnerId: 'runner_generic_test',
          runnerToken: 'runner_token',
          runnerName: 'Generic Test Runner',
          protocolVersion: '1.0',
          accepted: true,
          message: 'registered',
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/pull') {
      reports.pull.push(body);
      if (taskPulled) {
        return sendJson(response, 200, {
          success: true,
          data: {
            hasTask: false,
            serverTime: new Date().toISOString(),
            pollIntervalMs: 1000,
            task: null,
          },
        });
      }
      taskPulled = true;
      return sendJson(response, 200, {
        success: true,
        data: {
          hasTask: true,
          serverTime: new Date().toISOString(),
          pollIntervalMs: 1000,
          task: {
            runId: 'run_generic_validate_001',
            taskType: 'WEB_ELEMENT_VALIDATE',
            executionLocation: 'LOCAL_RUNNER',
            executionToken: 'execution_token',
            runnerId: 'runner_generic_test',
            workspaceCode: 'account-open',
            userId: '1',
            protocolVersion: '1.0',
            priority: 'MANUAL',
            resourceCost: 3,
            createdAt: new Date().toISOString(),
            deadlineAt: null,
            timeoutPolicy: {},
            environmentSnapshot: {},
            variableSnapshot: {},
            scriptSnapshot: {},
            artifactRefs: [],
            maskingRules: [],
            screenshotPolicy: {},
            payload: {
              pageUrl: 'https://example.test',
              locators: [
                {
                  locatorId: 'save-button',
                  locatorType: 'CSS',
                  locatorValue: '#save',
                },
              ],
            },
          },
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_validate_001/status') {
      reports.status.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_validate_001/logs') {
      reports.logs.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_validate_001/steps') {
      reports.steps.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: 'RUNNING' } });
    }

    if (request.method === 'POST' && url.pathname === '/api/public/local-runner/tasks/run_generic_validate_001/result') {
      reports.results.push(body);
      return sendJson(response, 200, { success: true, data: { accepted: true, status: body.status } });
    }

    return sendJson(response, 404, {
      success: false,
      message: `Unexpected platform route: ${request.method} ${url.pathname}`,
    });
  });

  await listen(fakePlatform, platformPort);

  const runner = spawn(process.execPath, ['tools/web-ui-runner/server.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WEB_UI_RUNNER_PORT: String(runnerPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stderr = [];
  runner.stderr.on('data', chunk => stderr.push(String(chunk)));

  try {
    await waitForRunnerHealth(runnerBaseUrl);
    const opened = await postJson(runnerBaseUrl, '/collect/open', {
      url: 'data:text/html,<button id="save">Save</button>',
      workspaceId: 'account-open',
      environmentId: 'default',
      headless: true,
    });
    assert.equal(opened.success, true);

    const started = await postJson(runnerBaseUrl, '/tasks/poll/start', {
      apiBaseUrl: platformBaseUrl,
      installId: 'generic-task-test',
      intervalMs: 1000,
      capabilities: ['WEB_ELEMENT_VALIDATE'],
    });
    assert.equal(started.success, true);
    assert.equal(started.poller.runnerId, 'runner_generic_test');

    await waitFor(() => reports.results.length > 0);

    assert.equal(reports.register.length, 1);
    assert.equal(reports.pull[0].runnerId, 'runner_generic_test');
    assert.equal(reports.status[0].status, 'RUNNING');
    assert.equal(reports.logs[0].message, '开始执行 WEB_ELEMENT_VALIDATE 任务');
    assert.equal(reports.steps[0].stepId, 'web-element-validate-local');
    assert.equal(reports.results[0].status, 'SUCCESS');
    assert.equal(reports.results[0].summary.mode, 'LOCAL_PLAYWRIGHT');
    assert.equal(reports.results[0].reportData.validationMode, 'LOCAL_PLAYWRIGHT');
    assert.equal(reports.results[0].reportData.results[0].validationStatus, 'PASSED');
    assert.equal(reports.results[0].reportData.results[0].matchCount, 1);
    assert.equal(reports.results[0].reportData.results[0].visible, true);

    const status = await getJson(runnerBaseUrl, '/tasks/poll/status');
    assert.equal(status.success, true);
    assert.ok(status.poller.completedCount >= 1);
  } finally {
    await postJson(runnerBaseUrl, '/tasks/poll/stop', {}).catch(() => {});
    runner.kill();
    await closeServer(fakePlatform);
    await once(runner, 'exit').catch(() => {});
  }

  assert.deepEqual(stderr, []);
});

async function waitForRunnerHealth(baseUrl) {
  await waitFor(async () => {
    const health = await getJson(baseUrl, '/health');
    return health.success;
  });
}

async function waitFor(predicate, timeoutMs = 10_000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await predicate()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw lastError || new Error('Timed out waiting for condition');
}

async function listen(server, port) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

async function closeServer(server) {
  if (!server.listening) {
    return;
  }
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function findAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await closeServer(server);
  return port;
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(1500),
  });
  return response.json();
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }
  return payload;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

const DEFAULT_PROTOCOL_VERSION = '1.0';
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_CAPABILITIES = ['WEB_ELEMENT_VALIDATE', 'WEB_CASE_RUN'];

export function createRunnerTaskPoller(options = {}) {
  const runnerVersion = options.runnerVersion || '0.1.0';
  const defaultInstallId = options.defaultInstallId || 'web-ui-runner-local';
  const defaultMachineHint = options.machineHint || {};
  const webElementValidateExecutor = typeof options.webElementValidateExecutor === 'function'
    ? options.webElementValidateExecutor
    : null;
  let poller;

  async function start(payload = {}) {
    const apiBaseUrl = normalizePlatformApiBaseUrl(payload.apiBaseUrl);
    if (!apiBaseUrl) {
      throw new Error('apiBaseUrl is required');
    }

    stop('replaced');
    poller = {
      apiBaseUrl,
      installId: optionalString(payload.installId) || defaultInstallId,
      runnerId: optionalString(payload.runnerId),
      runnerToken: optionalString(payload.runnerToken),
      runnerVersion: optionalString(payload.runnerVersion) || runnerVersion,
      protocolVersion: optionalString(payload.protocolVersion) || DEFAULT_PROTOCOL_VERSION,
      capabilities: normalizeCapabilities(payload.capabilities),
      workspaceCodes: Array.isArray(payload.workspaceCodes) ? payload.workspaceCodes : [],
      intervalMs: normalizeIntervalMs(payload.intervalMs),
      running: true,
      tickRunning: false,
      startedAt: new Date().toISOString(),
      lastTickAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastMessage: '通用任务后台轮询已启动',
      pulledCount: 0,
      completedCount: 0,
      failedCount: 0,
      sequenceNo: 0,
      timer: null,
    };

    if (!poller.runnerId || !poller.runnerToken) {
      await registerRunner(poller, defaultMachineHint);
    }
    schedule(0);
    return status();
  }

  function stop(reason = 'manual') {
    if (poller?.timer) {
      clearTimeout(poller.timer);
    }
    const previous = poller ? sanitize(poller) : null;
    poller = undefined;
    return {
      success: true,
      stopped: Boolean(previous),
      reason,
      poller: previous,
    };
  }

  function status() {
    return {
      success: true,
      poller: poller ? sanitize(poller) : null,
    };
  }

  function schedule(delayMs) {
    if (!poller?.running) {
      return;
    }
    poller.timer = setTimeout(() => {
      void tick();
    }, delayMs);
  }

  async function tick() {
    const current = poller;
    if (!current?.running || current.tickRunning) {
      return;
    }
    current.tickRunning = true;
    current.lastTickAt = new Date().toISOString();
    try {
      if (!current.runnerId || !current.runnerToken) {
        await registerRunner(current, defaultMachineHint);
      }
      const pulled = await postPlatformJson(current, '/public/local-runner/tasks/pull', {
        runnerId: current.runnerId,
        runnerToken: current.runnerToken,
        runnerVersion: current.runnerVersion,
        protocolVersion: current.protocolVersion,
        capabilities: current.capabilities,
        workspaceCodes: current.workspaceCodes,
        resource: {
          mode: 'LOCAL_NODE_RUNNER',
          validationMode: webElementValidateExecutor ? 'LOCAL_PLAYWRIGHT' : 'UNCONFIGURED',
        },
      });

      current.lastSuccessAt = new Date().toISOString();
      if (!pulled?.hasTask || !pulled.task) {
        current.lastMessage = '暂无可领取任务';
        schedule(pulled?.pollIntervalMs || current.intervalMs);
        return;
      }

      current.pulledCount += 1;
      current.lastMessage = `已领取任务 ${pulled.task.runId}`;
      await executeTask(current, pulled.task);
      current.completedCount += 1;
      current.lastSuccessAt = new Date().toISOString();
      current.lastMessage = `任务 ${pulled.task.runId} 已完成并回传结果`;
      schedule(0);
    } catch (error) {
      if (poller === current) {
        current.failedCount += 1;
        current.lastError = error instanceof Error ? error.message : String(error);
        current.lastMessage = current.lastError;
        schedule(current.intervalMs);
      }
    } finally {
      if (poller === current) {
        current.tickRunning = false;
      }
    }
  }

  async function executeTask(current, task) {
    const taskType = optionalString(task.taskType).toUpperCase();
    await reportStatus(current, task, {
      status: 'RUNNING',
      currentStage: taskType === 'WEB_ELEMENT_VALIDATE' ? 'VALIDATING' : 'EXECUTING',
      progress: { current: 0, total: 1, percent: 0 },
      message: 'Local Runner 已开始执行任务',
    });
    await appendLog(current, task, 'INFO', `开始执行 ${taskType || 'UNKNOWN'} 任务`, {
      validationMode: taskType === 'WEB_ELEMENT_VALIDATE' ? 'LOCAL_PLAYWRIGHT' : 'UNKNOWN',
    });

    if (taskType === 'WEB_ELEMENT_VALIDATE') {
      await executeWebElementValidateTask(current, task);
      return;
    }

    await appendLog(current, task, 'WARN', `暂不支持的通用任务类型：${taskType || 'UNKNOWN'}`, {});
    await reportFinalResult(current, task, {
      status: 'FAILED',
      summary: {
        taskType,
        supported: false,
      },
      errorMessage: `Unsupported runner task type: ${taskType || 'UNKNOWN'}`,
      reportData: {},
    });
  }

  async function executeWebElementValidateTask(current, task) {
    const locators = Array.isArray(task.payload?.locators) ? task.payload.locators : [];
    const startedAt = Date.now();

    try {
      if (!webElementValidateExecutor) {
        throw new Error('WEB_ELEMENT_VALIDATE executor is not configured');
      }
      const validation = await webElementValidateExecutor({
        task,
        locators,
      });
      const rawResults = Array.isArray(validation?.results) ? validation.results : [];
      const results = rawResults.map((result, index) => ({
        locatorId: locators[index]?.locatorId || locators[index]?.elementId || `locator-${index + 1}`,
        ...result,
      }));
      const passed = results.filter(item => item.validationStatus === 'PASSED').length;
      const failed = results.length - passed;
      const durationMs = Date.now() - startedAt;

      await reportStepResult(current, task, {
        stepId: 'web-element-validate-local',
        status: failed > 0 ? 'FAILED' : 'SUCCESS',
        durationMs,
        extra: {
          mode: 'LOCAL_PLAYWRIGHT',
          total: results.length,
          passed,
          failed,
        },
      });
      await reportStatus(current, task, {
        status: 'RUNNING',
        currentStage: 'VALIDATING',
        progress: { current: results.length, total: results.length, percent: 100 },
        message: `真机验证完成：通过 ${passed} 个，失败 ${failed} 个`,
      });
      await reportFinalResult(current, task, {
        status: failed > 0 ? 'DEGRADED' : 'SUCCESS',
        durationMs,
        summary: {
          mode: 'LOCAL_PLAYWRIGHT',
          total: results.length,
          passed,
          failed,
        },
        reportData: {
          validationMode: 'LOCAL_PLAYWRIGHT',
          pageUrl: validation?.page?.url || task.payload?.pageUrl || '',
          page: validation?.page || null,
          results,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startedAt;

      await appendLog(current, task, 'ERROR', 'WEB_ELEMENT_VALIDATE 真机验证失败', {
        errorMessage: message,
      });
      await reportStepResult(current, task, {
        stepId: 'web-element-validate-local',
        status: 'FAILED',
        durationMs,
        errorMessage: message,
        extra: {
          mode: 'LOCAL_PLAYWRIGHT',
        },
      });
      await reportFinalResult(current, task, {
        status: 'FAILED',
        durationMs,
        summary: {
          mode: 'LOCAL_PLAYWRIGHT',
          total: locators.length,
          passed: 0,
          failed: locators.length,
        },
        errorMessage: message,
        reportData: {
          validationMode: 'LOCAL_PLAYWRIGHT',
          pageUrl: task.payload?.pageUrl || '',
          results: [],
        },
      });
    }
  }

  async function registerRunner(current, machineHint) {
    const registered = await postPlatformJson(current, '/public/local-runner/register', {
      installId: current.installId,
      runnerVersion: current.runnerVersion,
      protocolVersion: current.protocolVersion,
      machineHint,
      capabilities: current.capabilities,
    });
    current.runnerId = registered.runnerId;
    current.runnerToken = registered.runnerToken;
    current.lastMessage = registered.message || 'Runner 已注册';
  }

  async function reportStatus(current, task, body) {
    return postPlatformJson(current, `/public/local-runner/tasks/${encodeURIComponent(task.runId)}/status`, {
      runnerId: current.runnerId,
      executionToken: task.executionToken,
      reportedAt: new Date().toISOString(),
      ...body,
    });
  }

  async function appendLog(current, task, level, message, data) {
    current.sequenceNo += 1;
    return postPlatformJson(current, `/public/local-runner/tasks/${encodeURIComponent(task.runId)}/logs`, {
      runnerId: current.runnerId,
      executionToken: task.executionToken,
      sequenceNo: current.sequenceNo,
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async function reportStepResult(current, task, body) {
    return postPlatformJson(current, `/public/local-runner/tasks/${encodeURIComponent(task.runId)}/steps`, {
      runnerId: current.runnerId,
      executionToken: task.executionToken,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      ...body,
    });
  }

  async function reportFinalResult(current, task, body) {
    return postPlatformJson(current, `/public/local-runner/tasks/${encodeURIComponent(task.runId)}/result`, {
      runnerId: current.runnerId,
      executionToken: task.executionToken,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      ...body,
    });
  }

  return {
    start,
    stop,
    status,
  };
}

async function postPlatformJson(poller, path, body) {
  const response = await fetch(`${poller.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.message || payload?.error || text || `HTTP ${response.status}`;
    throw new Error(`平台任务接口请求失败：${message}`);
  }
  if (payload?.success === false) {
    throw new Error(payload.message || '平台任务接口返回失败');
  }
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

function sanitize(value) {
  return {
    apiBaseUrl: value.apiBaseUrl,
    installId: value.installId,
    runnerId: value.runnerId || null,
    runnerVersion: value.runnerVersion,
    protocolVersion: value.protocolVersion,
    capabilities: value.capabilities,
    workspaceCodes: value.workspaceCodes,
    running: Boolean(value.running),
    tickRunning: Boolean(value.tickRunning),
    startedAt: value.startedAt,
    lastTickAt: value.lastTickAt,
    lastSuccessAt: value.lastSuccessAt,
    lastError: value.lastError,
    lastMessage: value.lastMessage,
    pulledCount: value.pulledCount || 0,
    completedCount: value.completedCount || 0,
    failedCount: value.failedCount || 0,
    intervalMs: value.intervalMs,
  };
}

function normalizePlatformApiBaseUrl(value) {
  const text = optionalString(value).replace(/\/+$/, '');
  if (!text) {
    return '';
  }
  return text.endsWith('/api') ? text : `${text}/api`;
}

function normalizeCapabilities(value) {
  const capabilities = Array.isArray(value)
    ? value.map(optionalString).filter(Boolean)
    : DEFAULT_CAPABILITIES;
  return capabilities.length > 0 ? capabilities : DEFAULT_CAPABILITIES;
}

function normalizeIntervalMs(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(1000, Math.min(numeric, 15000)) : DEFAULT_POLL_INTERVAL_MS;
}

function optionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

import { createServer } from 'node:http';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { buildCandidatesFromElements, normalizeLocatorValidationResult, isProbablyLoginPage } from './collector.mjs';
import { isAllowedRunnerOrigin, parseAllowedOrigins } from './cors.mjs';
import { resolveOpenTarget } from './session.mjs';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 39118;
const RUNNER_VERSION = '0.1.0';
const DATA_DIR = join(homedir(), '.auto-web-ui-runner');
const AUTH_DIR = join(DATA_DIR, 'auth');
const VALIDATION_LOCATOR_LIMIT = 200;
const VALIDATION_SCREENSHOT_LIMIT = 8;
const AUTH_STALE_MINUTES = 24 * 60;
const DEFAULT_SESSION_TTL_MINUTES = 15;

let browser;
let context;
let page;
let activeSession;
let playwrightModule;

const port = Number.parseInt(process.env.WEB_UI_RUNNER_PORT || '', 10) || DEFAULT_PORT;
const allowedOrigins = parseAllowedOrigins(process.env.WEB_UI_RUNNER_ORIGINS);
const sessionTtlMinutes = normalizePositiveInteger(process.env.WEB_UI_RUNNER_SESSION_TTL_MINUTES, DEFAULT_SESSION_TTL_MINUTES);

const server = createServer(async (request, response) => {
  try {
    if (handleCors(request, response)) {
      return;
    }

    const route = `${request.method || 'GET'} ${new URL(request.url || '/', `http://${HOST}`).pathname}`;

    if (route === 'GET /health') {
      return sendJson(response, 200, await getHealth());
    }

    if (route === 'POST /collect/open') {
      const payload = await readJson(request);
      const result = await openCollectPage(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /collect/capture') {
      const payload = await readJson(request);
      const result = await captureCurrentPage(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /collect/validate') {
      const payload = await readJson(request);
      const result = await validateCurrentPageLocators(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /session/release') {
      const result = await releaseCurrentSession('manual');
      return sendJson(response, 200, result);
    }

    if (route === 'POST /auth/save') {
      const payload = await readJson(request);
      const result = await saveAuthState(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /auth/status') {
      const payload = await readJson(request);
      const result = await getAuthStateStatus(payload);
      return sendJson(response, 200, result);
    }

    if (route === 'POST /auth/clear') {
      const payload = await readJson(request);
      const result = await clearAuthState(payload);
      return sendJson(response, 200, result);
    }

    return sendJson(response, 404, {
      success: false,
      message: 'Unknown runner endpoint',
    });
  } catch (error) {
    return sendJson(response, 500, {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, HOST, () => {
  console.log(`Web UI Local Runner ${RUNNER_VERSION} listening on http://${HOST}:${port}`);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function getHealth() {
  const playwright = await loadPlaywright();
  let chromiumInstalled = false;
  let chromiumError = '';

  if (playwright.available) {
    try {
      chromiumInstalled = Boolean(playwright.module.chromium.executablePath());
    } catch (error) {
      chromiumError = error instanceof Error ? error.message : String(error);
    }
  }

  clearClosedSession();

  return {
    success: true,
    runner: {
      name: 'Web UI Local Runner',
      version: RUNNER_VERSION,
      host: HOST,
      port,
    },
    playwright: {
      available: playwright.available,
      error: playwright.error,
    },
    browsers: {
      chromium: {
        installed: chromiumInstalled,
        error: chromiumError,
      },
    },
    session: buildSessionView(),
  };
}

async function openCollectPage(payload) {
  const workspaceId = optionalString(payload.workspaceId) || 'default-workspace';
  const environmentId = optionalString(payload.environmentId) || 'default-environment';
  const headed = payload.headless === true ? false : true;
  const playwright = await ensurePlaywright();
  clearClosedSession();
  const target = resolveOpenTarget({
    requestedUrl: payload.url,
    hasActivePage: hasUsablePage(),
    currentUrl: getActivePageUrl(),
  });

  if (target.action === 'REUSE_CURRENT_PAGE') {
    activeSession = {
      ...(activeSession || {}),
      sessionId: activeSession?.sessionId || randomUUID(),
      workspaceId,
      environmentId,
      originalUrl: activeSession?.originalUrl || target.url,
      currentUrl: page.url(),
      openedAt: activeSession?.openedAt || new Date().toISOString(),
      authStateExists: activeSession?.authStateExists || false,
      expiresAt: activeSession?.expiresAt || buildSessionExpiresAt(),
    };

    return {
      success: true,
      session: buildSessionView(),
      page: await getPageInfo(page),
    };
  }

  if (context) {
    await context.close();
    context = undefined;
    page = undefined;
  }

  browser ||= await playwright.chromium.launch({
    headless: !headed,
  });

  const storageStatePath = getStorageStatePath(workspaceId, environmentId);
  const contextOptions = existsSync(storageStatePath) ? { storageState: storageStatePath } : {};
  context = await browser.newContext(contextOptions);
  page = await context.newPage();
  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  activeSession = {
    sessionId: randomUUID(),
    workspaceId,
    environmentId,
    originalUrl: target.url,
    currentUrl: page.url(),
    openedAt: new Date().toISOString(),
    authStateExists: existsSync(storageStatePath),
    expiresAt: buildSessionExpiresAt(),
  };

  return {
    success: true,
    session: buildSessionView(),
    page: await getPageInfo(page),
  };
}

async function captureCurrentPage(payload) {
  ensurePage();
  ensureSessionFresh();

  if (payload.waitMs) {
    await page.waitForTimeout(Math.min(Number(payload.waitMs), 10_000));
  }

  const rawElements = await page.evaluate(collectElementsInPage);
  const pageInfo = await getPageInfo(page);
  const screenshot = await page.screenshot({
    fullPage: false,
    type: 'png',
  });

  return {
    success: true,
    session: buildSessionView(),
    page: pageInfo,
    candidates: buildCandidatesFromElements(rawElements),
    rawCount: rawElements.length,
    screenshotBase64: screenshot.toString('base64'),
  };
}

async function validateCurrentPageLocators(payload) {
  ensurePage();
  ensureSessionFresh();
  const locators = Array.isArray(payload.locators) ? payload.locators : [];
  const results = [];
  let screenshotCount = 0;

  for (const item of locators.slice(0, VALIDATION_LOCATOR_LIMIT)) {
    const locatorType = optionalString(item.locatorType).toUpperCase();
    const locatorValue = optionalString(item.locatorValue);
    if (!locatorType || !locatorValue) {
      results.push(normalizeLocatorValidationResult({
        locatorType,
        locatorValue,
        matchCount: 0,
        screenshotBase64: null,
      }));
      continue;
    }

    try {
      const locator = resolveLocator(page, locatorType, locatorValue);
      const matchCount = await locator.count();
      let screenshotBase64 = null;
      let visible = false;
      let editable = false;
      let enabled = false;
      if (matchCount > 0) {
        const first = locator.first();
        await first.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
        visible = await first.isVisible({ timeout: 1000 }).catch(() => false);
        editable = await first.isEditable({ timeout: 1000 }).catch(() => false);
        enabled = await first.isEnabled({ timeout: 1000 }).catch(() => false);
        if (screenshotCount < VALIDATION_SCREENSHOT_LIMIT) {
          const screenshot = await first.screenshot({ timeout: 1200 }).catch(() => null);
          screenshotBase64 = screenshot ? screenshot.toString('base64') : null;
          if (screenshotBase64) {
            screenshotCount += 1;
          }
        }
      }
      results.push(normalizeLocatorValidationResult({
        locatorType,
        locatorValue,
        matchCount,
        visible,
        editable,
        enabled,
        screenshotBase64,
      }));
    } catch (error) {
      results.push({
        locatorType,
        locatorValue,
        validationStatus: 'FAILED',
        matchCount: 0,
        validationMessage: error instanceof Error ? error.message : String(error),
        screenshotBase64: null,
      });
    }
  }

  return {
    success: true,
    session: activeSession,
    page: await getPageInfo(page),
    results,
  };
}

function resolveLocator(targetPage, locatorType, locatorValue) {
  switch (locatorType) {
    case 'XPATH':
      return targetPage.locator(`xpath=${locatorValue}`);
    case 'TEXT':
      return targetPage.getByText(locatorValue);
    case 'ROLE': {
      const match = locatorValue.match(/^([^[]+)\[name="(.+)"\]$/);
      if (match) {
        return targetPage.getByRole(match[1], { name: match[2] });
      }
      const legacyParts = locatorValue.split(':');
      if (legacyParts.length > 1) {
        return targetPage.getByRole(legacyParts[0], { name: legacyParts.slice(1).join(':') });
      }
      return targetPage.getByRole(locatorValue);
    }
    case 'LABEL':
      return targetPage.getByLabel(locatorValue);
    case 'PLACEHOLDER':
      return targetPage.getByPlaceholder(locatorValue);
    case 'TEST_ID':
      return targetPage.locator([
        `[data-testid="${cssAttributeEscape(locatorValue)}"]`,
        `[data-test="${cssAttributeEscape(locatorValue)}"]`,
        `[data-qa="${cssAttributeEscape(locatorValue)}"]`,
        `[id="${cssAttributeEscape(locatorValue)}"]`,
      ].join(', '));
    default:
      return targetPage.locator(locatorValue);
  }
}

function cssAttributeEscape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function saveAuthState(payload) {
  ensureContext();
  ensurePage();
  const workspaceId = optionalString(payload.workspaceId) || activeSession?.workspaceId || 'default-workspace';
  const environmentId = optionalString(payload.environmentId) || activeSession?.environmentId || 'default-environment';
  const storageStatePath = getStorageStatePath(workspaceId, environmentId);

  await mkdir(AUTH_DIR, { recursive: true });
  await context.storageState({ path: storageStatePath });
  const savedAt = new Date().toISOString();
  await writeFile(
    `${storageStatePath}.meta.json`,
    JSON.stringify({
      workspaceId,
      environmentId,
      savedAt,
      url: page?.url() || '',
    }, null, 2),
    'utf8',
  );
  if (activeSession) {
    activeSession.authStateExists = true;
    activeSession.authSavedAt = savedAt;
  }

  return {
    success: true,
    storageStatePath,
    savedAt,
  };
}

async function getAuthStateStatus(payload) {
  const workspaceId = optionalString(payload.workspaceId) || activeSession?.workspaceId || 'default-workspace';
  const environmentId = optionalString(payload.environmentId) || activeSession?.environmentId || 'default-environment';
  const storageStatePath = getStorageStatePath(workspaceId, environmentId);
  const exists = existsSync(storageStatePath);
  const meta = await readJsonFile(`${storageStatePath}.meta.json`);
  const savedAt = typeof meta?.savedAt === 'string' ? meta.savedAt : null;
  const savedUrl = typeof meta?.url === 'string' ? meta.url : null;
  const ageMinutes = savedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(savedAt)) / 60000)) : null;

  return {
    success: true,
    workspaceId,
    environmentId,
    exists,
    savedAt,
    savedUrl,
    ageMinutes,
    stale: exists && typeof ageMinutes === 'number' ? ageMinutes >= AUTH_STALE_MINUTES : false,
    staleAfterMinutes: AUTH_STALE_MINUTES,
    activeSession: activeSession
      ? {
          sessionId: activeSession.sessionId,
          currentUrl: getActivePageUrl() || activeSession.currentUrl || '',
          openedAt: activeSession.openedAt || null,
          expiresAt: activeSession.expiresAt || null,
          authStateExists: Boolean(activeSession.authStateExists),
        }
      : null,
  };
}

async function clearAuthState(payload) {
  const workspaceId = optionalString(payload.workspaceId) || activeSession?.workspaceId || 'default-workspace';
  const environmentId = optionalString(payload.environmentId) || activeSession?.environmentId || 'default-environment';
  const storageStatePath = getStorageStatePath(workspaceId, environmentId);
  await rm(storageStatePath, { force: true });
  await rm(`${storageStatePath}.meta.json`, { force: true });
  if (activeSession && activeSession.workspaceId === workspaceId && activeSession.environmentId === environmentId) {
    activeSession.authStateExists = false;
    activeSession.authSavedAt = null;
  }

  return {
    success: true,
    cleared: true,
  };
}

async function releaseCurrentSession(reason = 'manual') {
  const releasedSession = buildSessionView();
  if (context) {
    await context.close().catch(() => {});
  }
  context = undefined;
  page = undefined;
  activeSession = undefined;

  return {
    success: true,
    released: Boolean(releasedSession),
    reason,
    session: releasedSession,
  };
}

async function getPageInfo(targetPage) {
  const info = await targetPage.evaluate(() => {
    const visibleText = document.body?.innerText || '';
    return {
      title: document.title,
      visibleText: visibleText.slice(0, 2000),
      hasPasswordInput: Boolean(document.querySelector('input[type="password"]')),
    };
  });

  return {
    url: targetPage.url(),
    title: info.title,
    isProbablyLoginPage: isProbablyLoginPage({
      url: targetPage.url(),
      title: info.title,
      visibleText: info.visibleText,
      hasPasswordInput: info.hasPasswordInput,
    }),
  };
}

function collectElementsInPage() {
  const selector = [
    'a',
    'button',
    'input',
    'select',
    'textarea',
    '[role]',
    '[data-testid]',
    '[data-test]',
    '[aria-label]',
  ].join(',');

  return Array.from(document.querySelectorAll(selector)).slice(0, 500).map((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const label = findLabelText(element);
    return {
      tagName: element.tagName,
      type: element.getAttribute('type') || '',
      visible: rect.width > 0
        && rect.height > 0
        && style.visibility !== 'hidden'
        && style.display !== 'none',
      text: element.innerText || element.textContent || '',
      placeholder: element.getAttribute('placeholder') || '',
      ariaLabel: element.getAttribute('aria-label') || '',
      name: element.getAttribute('name') || '',
      id: element.id || '',
      testId: element.getAttribute('data-testid') || element.getAttribute('data-test') || '',
      href: element.getAttribute('href') || '',
      role: element.getAttribute('role') || '',
      label,
      cssPath: buildCssPath(element),
      xpath: buildXPath(element),
    };
  });

  function findLabelText(element) {
    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label?.textContent) {
        return label.textContent;
      }
    }
    const wrapperLabel = element.closest('label');
    if (wrapperLabel?.textContent) {
      return wrapperLabel.textContent;
    }
    return '';
  }

  function buildCssPath(element) {
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
      const tag = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      current = parent;
    }
    return parts.join(' > ');
  }

  function buildXPath(element) {
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const tag = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`*[@id="${current.id.replaceAll('"', '\\"')}"]`);
        return `//${parts.join('/')}`;
      }
      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${tag}[${index}]`);
      current = parent;
    }
    return `/${parts.join('/')}`;
  }
}

async function loadPlaywright() {
  if (playwrightModule) {
    return {
      available: true,
      module: playwrightModule,
      error: '',
    };
  }

  try {
    playwrightModule = await import('playwright');
    return {
      available: true,
      module: playwrightModule,
      error: '',
    };
  } catch (error) {
    return {
      available: false,
      module: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function ensurePlaywright() {
  const playwright = await loadPlaywright();
  if (!playwright.available) {
    throw new Error(`Playwright is not installed. Run: npm install -D playwright && npx playwright install chromium. ${playwright.error}`);
  }
  return playwright.module;
}

function ensureContext() {
  clearClosedSession();
  if (!context) {
    throw new Error('No active browser context. Please click "打开目标页" or run /collect/open first.');
  }
}

function ensurePage() {
  clearClosedSession();
  if (!hasUsablePage()) {
    throw new Error('No active browser page. Please click "打开目标页" or run /collect/open before capture.');
  }
}

function ensureSessionFresh() {
  if (!activeSession || !isSessionExpired(activeSession)) {
    return;
  }
  const expiredAt = activeSession.expiresAt || '';
  void releaseCurrentSession('expired');
  throw new Error(`Local Runner page session has expired${expiredAt ? ` at ${expiredAt}` : ''}. Please open the target page again.`);
}

function getStorageStatePath(workspaceId, environmentId) {
  return join(AUTH_DIR, `${safeName(workspaceId)}__${safeName(environmentId)}.json`);
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function safeName(value) {
  return String(value || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function handleCors(request, response) {
  const origin = request.headers.origin || '';
  if (isAllowedRunnerOrigin(origin, allowedOrigins)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Web-Ui-Runner-Token');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return true;
  }

  return false;
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

function requireString(value, fieldName) {
  const normalized = optionalString(value);
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function hasUsablePage() {
  return Boolean(page && !page.isClosed());
}

function getActivePageUrl() {
  return hasUsablePage() ? page.url() : '';
}

function buildSessionExpiresAt() {
  return new Date(Date.now() + sessionTtlMinutes * 60_000).toISOString();
}

function buildSessionView() {
  if (!activeSession) {
    return null;
  }
  const now = Date.now();
  const expiresAt = activeSession.expiresAt || null;
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : NaN;
  const remainingMs = Number.isNaN(expiresAtMs) ? null : Math.max(0, expiresAtMs - now);
  return {
    ...activeSession,
    currentUrl: getActivePageUrl() || activeSession.currentUrl || '',
    expiresAt,
    ttlMinutes: sessionTtlMinutes,
    remainingSeconds: typeof remainingMs === 'number' ? Math.ceil(remainingMs / 1000) : null,
    expired: isSessionExpired(activeSession),
  };
}

function isSessionExpired(session) {
  if (!session?.expiresAt) {
    return false;
  }
  const expiresAtMs = Date.parse(session.expiresAt);
  return !Number.isNaN(expiresAtMs) && Date.now() >= expiresAtMs;
}

function clearClosedSession() {
  if (page && page.isClosed()) {
    page = undefined;
  }
  if (!page) {
    activeSession = undefined;
  }
}

function optionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePositiveInteger(value, fallback) {
  const numeric = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

async function shutdown() {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  process.exit(0);
}

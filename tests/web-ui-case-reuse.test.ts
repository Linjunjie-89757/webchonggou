import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildWebUiCaseExportJson,
  buildWebUiDraftFromTemplate,
  buildWebUiDraftFromTemplateDetail,
  parseWebUiCaseImportJson,
  WEB_UI_CASE_TEMPLATES,
} from '../src/entities/web-ui-automation/lib/caseReuse.ts'

test('builds a draft case from a maintained template detail', () => {
  const draft = buildWebUiDraftFromTemplateDetail({
    id: 8,
    workspaceCode: 'risk-ops',
    workspaceName: 'Risk Ops',
    name: 'Maintained Login Template',
    moduleName: 'Login',
    status: 'ENABLED',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    baseUrl: 'https://example.test',
    description: 'shared team template',
    stepCount: 2,
    updatedAt: '2026-06-21T10:00:00',
    createdAt: '2026-06-21T09:00:00',
    steps: [
      {
        id: 81,
        templateId: 8,
        name: 'Open login',
        type: 'OPEN',
        inputValue: '/login',
        continueOnFailure: false,
        screenshotPolicy: 'ON_FAILURE',
        enabled: true,
        sortOrder: 1,
      },
      {
        id: 82,
        templateId: 8,
        name: 'Assert login form',
        type: 'ASSERT_VISIBLE',
        locatorType: 'CSS',
        locatorValue: '#login',
        continueOnFailure: false,
        screenshotPolicy: 'ON_FAILURE',
        enabled: true,
        sortOrder: 2,
      },
    ],
  }, 'risk-ops')

  assert.equal(draft.id, 0)
  assert.equal(draft.name, 'Maintained Login Template')
  assert.equal(draft.steps.length, 2)
  assert.equal(draft.steps[0].id, null)
  assert.equal(draft.steps[0].sortOrder, 1)
  assert.equal(draft.steps[1].locatorValue, '#login')
})

test('builds a draft case from a built-in template', () => {
  const template = WEB_UI_CASE_TEMPLATES[0]
  const draft = buildWebUiDraftFromTemplate(template, 'risk-ops')

  assert.equal(draft.id, 0)
  assert.equal(draft.workspaceCode, 'risk-ops')
  assert.equal(draft.name, template.name)
  assert.equal(draft.stepCount, template.steps.length)
  assert.equal(draft.steps[0].id, null)
  assert.equal(draft.steps[0].sortOrder, 1)
})

test('exports a case as portable JSON without runtime history', () => {
  const exported = buildWebUiCaseExportJson({
    id: 12,
    workspaceCode: 'risk-ops',
    workspaceName: '风险运营',
    name: '登录冒烟',
    moduleName: '登录',
    status: 'ENABLED',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    baseUrl: 'https://example.test',
    description: '登录流程',
    stepCount: 1,
    lastRunResult: 'FAILED',
    lastRunAt: '2026-06-21T10:00:00',
    updatedAt: '2026-06-21T10:00:00',
    createdAt: '2026-06-21T09:00:00',
    steps: [{
      id: 100,
      type: 'OPEN',
      inputValue: '/login',
      continueOnFailure: false,
      screenshotPolicy: 'ON_FAILURE',
      enabled: true,
      sortOrder: 1,
    }],
  })

  const parsed = JSON.parse(exported)
  assert.equal(parsed.version, 1)
  assert.equal(parsed.name, '登录冒烟')
  assert.equal(parsed.steps[0].id, undefined)
  assert.equal(parsed.lastRunResult, undefined)
  assert.equal(parsed.steps[0].sortOrder, 1)
})

test('imports valid JSON as a new draft case', () => {
  const result = parseWebUiCaseImportJson(JSON.stringify({
    version: 1,
    name: '导入用例',
    moduleName: '列表',
    baseUrl: 'https://example.test',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 8000,
    status: 'ENABLED',
    steps: [
      { name: '打开列表', type: 'OPEN', inputValue: '/items', enabled: true },
      { name: '断言搜索框', type: 'ASSERT_VISIBLE', locatorType: 'CSS', locatorValue: '#keyword', enabled: true },
    ],
  }), 'risk-ops')

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.draft.id, 0)
    assert.equal(result.draft.workspaceCode, 'risk-ops')
    assert.equal(result.draft.name, '导入用例')
    assert.equal(result.draft.steps.length, 2)
    assert.equal(result.draft.steps[1].sortOrder, 2)
  }
})

test('rejects JSON with invalid executable steps', () => {
  const result = parseWebUiCaseImportJson(JSON.stringify({
    name: '坏用例',
    steps: [
      { type: 'CLICK', enabled: true },
    ],
  }), 'risk-ops')

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.errors.join('\n'), /定位器/)
  }
})

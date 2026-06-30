<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { ApiRunStepResult } from '@/entities/api-automation'
import ApiCodeEditor from '../api-interface-workspace/ApiCodeEditor.vue'

type ResponseTab = 'body' | 'header' | 'console' | 'actualRequest' | 'assertions'
type RequestTab = 'header' | 'body'
type CodeLanguage = 'json' | 'xml' | 'text'

const props = defineProps<{
  step: ApiRunStepResult | null
}>()

const requestTab = ref<RequestTab>('body')
const responseTab = ref<ResponseTab>('body')

const requestMethod = computed(() => props.step?.request?.method || 'HTTP')
const requestUrl = computed(() => props.step?.request?.url || '-')
const requestHeaders = computed(() => toPrettyJson(props.step?.request?.headers || {}))
const requestBody = computed(() => {
  const request = props.step?.request
  if (!request) return '-'
  if (request.body != null && request.body !== '') return toPrettyJson(request.body)
  if (request.bodyFormItems?.length) return toPrettyJson(request.bodyFormItems)
  if (request.queryParams?.length) return toPrettyJson(request.queryParams)
  return '-'
})
const requestBodyLanguage = computed<CodeLanguage>(() => inferBodyLanguage(
  props.step?.request?.bodyContentType || props.step?.request?.bodyFileContentType,
  String(props.step?.request?.body || ''),
))

const responseBody = computed(() => toPrettyJson(props.step?.response?.body || props.step?.errorMessage || ''))
const responseBodyLanguage = computed<CodeLanguage>(() => inferBodyLanguage(
  props.step?.response?.contentType,
  String(props.step?.response?.body || ''),
))
const responseHeaders = computed(() => toPrettyJson(props.step?.response?.headers || {}))
const responseStatusCode = computed(() => props.step?.response?.statusCode ?? null)
const responseStatusTone = computed(() => statusTone(responseStatusCode.value))
const responseDuration = computed(() => props.step?.durationMs ?? null)
const responseSize = computed(() => formatResponseSize(props.step?.response?.body))
const responseConsole = computed(() => buildConsolePreview(
  runStepDebugError(props.step),
  props.step?.processorResults || [],
  props.step?.assertionResults || [],
  props.step?.extractionResults || [],
))
const actualRequest = computed(() => toPrettyJson({
  method: props.step?.request?.method || 'GET',
  url: props.step?.request?.url || '',
  headers: props.step?.request?.headers || {},
  queryParams: props.step?.request?.queryParams || [],
  body: props.step?.request?.body ?? null,
}))
const assertions = computed(() => props.step?.assertionResults || [])
const assertionPresentation = computed(() => {
  if (props.step?.errorMessage) return { visible: true, tone: 'failed', label: '执行失败' }
  if (!assertions.value.length) return { visible: true, tone: 'no-assertion', label: '无断言' }
  return assertions.value.some(item => item.success === false)
    ? { visible: true, tone: 'not-passed', label: '断言不通过' }
    : { visible: true, tone: 'passed', label: '断言通过' }
})

watch(
  () => props.step,
  (step) => {
    requestTab.value = step?.request?.body || step?.request?.queryParams?.length ? 'body' : 'header'
    responseTab.value = step?.response ? 'body' : 'console'
  },
  { immediate: true },
)

function toPrettyJson(value: unknown) {
  if (value == null || value === '') return '-'
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function inferBodyLanguage(contentType?: string | null, bodyText = ''): CodeLanguage {
  const content = String(contentType || '').toLowerCase()
  const text = bodyText.trim()
  if (content.includes('json')) return 'json'
  if (content.includes('xml') || content.includes('html')) return 'xml'
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      JSON.parse(text)
      return 'json'
    } catch {
      return 'text'
    }
  }
  if (text.startsWith('<') && text.endsWith('>')) return 'xml'
  return 'text'
}

function formatResponseSize(body?: string | null) {
  if (!body) return '-'
  const bytes = new Blob([body]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function statusTone(statusCode?: number | null) {
  if (statusCode == null) return 'muted'
  if (statusCode >= 200 && statusCode < 300) return 'success'
  if (statusCode >= 300 && statusCode < 400) return 'warning'
  return 'danger'
}

function runStepDebugError(step: ApiRunStepResult | null) {
  if (step?.errorMessage) return step.errorMessage
  if (!step || step.success !== false) return ''
  if (step.assertionResults?.some(item => !item.success)) return ''
  if (!step.response) return '请求执行失败，未获取到响应内容'
  if (typeof step.response.statusCode === 'number' && step.response.statusCode >= 400) {
    return `请求返回 HTTP ${step.response.statusCode}`
  }
  return ''
}

function unknownValue(row: unknown, key: string) {
  if (!row || typeof row !== 'object') return undefined
  return (row as Record<string, unknown>)[key]
}

function unknownText(value: unknown) {
  if (value == null || value === '') return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function buildConsolePreview(
  debugError: string,
  processorResults: unknown[],
  assertionResults: ApiRunStepResult['assertionResults'],
  extractionResults: unknown[],
) {
  const lines: string[] = []
  if (debugError) lines.push(`[错误] ${debugError}`)
  processorResults.forEach((row, index) => {
    const name = unknownText(unknownValue(row, 'name') ?? unknownValue(row, 'processorName') ?? `处理器 ${index + 1}`)
    const stage = unknownText(unknownValue(row, 'stage') ?? unknownValue(row, 'processorStage'))
    const success = unknownValue(row, 'success')
    const duration = unknownValue(row, 'durationMs')
    const message = unknownText(unknownValue(row, 'message') ?? unknownValue(row, 'errorMessage') ?? unknownValue(row, 'result'))
    lines.push(`[处理器 ${index + 1}] ${stage !== '-' ? `${stage} / ` : ''}${name} / ${success === false ? '失败' : '通过'}${typeof duration === 'number' ? ` / ${duration} ms` : ''}`)
    if (message !== '-') lines.push(`  ${message}`)
  })
  assertionResults.forEach((row, index) => {
    lines.push(`[断言 ${index + 1}] ${(row.name || row.type)} / ${row.success ? '通过' : '失败'}`)
    if (row.message) lines.push(`  ${row.message}`)
    if (row.expectedValue !== undefined || row.actualValue !== undefined) {
      lines.push(`  期望值: ${row.expectedValue ?? ''}`)
      lines.push(`  实际值: ${row.actualValue ?? ''}`)
    }
  })
  extractionResults.forEach((row, index) => {
    const name = unknownText(unknownValue(row, 'name') ?? unknownValue(row, 'variableName') ?? `提取项 ${index + 1}`)
    const success = unknownValue(row, 'success')
    const value = unknownText(unknownValue(row, 'value') ?? unknownValue(row, 'actualValue'))
    const message = unknownText(unknownValue(row, 'message') ?? unknownValue(row, 'errorMessage'))
    lines.push(`[提取 ${index + 1}] ${name} / ${success === false ? '失败' : '通过'}`)
    lines.push(`  ${value !== '-' ? value : message}`)
  })
  return lines.length ? lines.join('\n') : '暂无控制台内容'
}

function methodClass(method?: string | null) {
  return `is-${String(method || 'get').toLowerCase()}`
}

function assertionTypeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    STATUS_CODE: '状态码',
    RESPONSE_CODE: '状态码',
    HEADER: '响应头',
    RESPONSE_HEADER: '响应头',
    BODY: '响应体',
    RESPONSE_BODY: '响应体',
    RESPONSE_TIME: '响应时间',
    JSON_PATH: 'JSONPath',
    VARIABLE: '变量',
    SCRIPT: '脚本',
  }
  return labels[value || ''] || value || '-'
}

function assertionConditionLabel(value?: string | null) {
  const labels: Record<string, string> = {
    EQUALS: '等于',
    NOT_EQUALS: '不等于',
    CONTAINS: '包含',
    NOT_CONTAINS: '不包含',
    EXISTS: '存在',
    NOT_EXISTS: '不存在',
    GREATER_THAN: '大于',
    LESS_THAN: '小于',
    REGEX: '正则',
  }
  return labels[value || ''] || value || '-'
}
</script>

<template>
  <div v-if="step" class="api-run-step-detail-viewer">
    <div class="api-run-step-detail-viewer__summary">
      <span :class="['api-run-step-detail-viewer__method', methodClass(requestMethod)]">{{ requestMethod }}</span>
      <span class="api-run-step-detail-viewer__url">{{ requestUrl }}</span>
    </div>

    <section class="api-run-step-detail-viewer__request">
      <div class="api-run-step-detail-viewer__section-head">
        <strong>实际请求</strong>
      </div>
      <div class="api-run-step-detail-viewer__tabs">
        <button :class="{ 'is-active': requestTab === 'header' }" type="button" @click="requestTab = 'header'">Header</button>
        <button :class="{ 'is-active': requestTab === 'body' }" type="button" @click="requestTab = 'body'">Body</button>
      </div>
      <div class="api-run-step-detail-viewer__code">
        <ApiCodeEditor
          v-if="requestTab === 'header'"
          :model-value="requestHeaders"
          language="json"
          :read-only="true"
          :show-format-button="false"
          height="100%"
        />
        <ApiCodeEditor
          v-else
          :model-value="requestBody"
          :language="requestBodyLanguage"
          :read-only="true"
          :show-format-button="false"
          height="100%"
        />
      </div>
    </section>

    <section class="api-run-step-detail-viewer__response">
      <div class="api-run-step-detail-viewer__section-head">
        <strong>响应内容</strong>
        <div class="api-run-step-detail-viewer__metrics">
          <span v-if="assertionPresentation.visible" :class="['api-run-step-detail-viewer__result', `is-${assertionPresentation.tone}`]">
            {{ assertionPresentation.label }}
          </span>
          <span :class="['api-run-step-detail-viewer__status', `is-${responseStatusTone}`]">状态 {{ responseStatusCode ?? '-' }}</span>
          <span>耗时 {{ responseDuration ?? '-' }}<template v-if="responseDuration !== null"> ms</template></span>
          <span>大小 {{ responseSize }}</span>
        </div>
      </div>
      <div class="api-run-step-detail-viewer__tabs">
        <button :class="{ 'is-active': responseTab === 'body' }" type="button" @click="responseTab = 'body'">Body</button>
        <button :class="{ 'is-active': responseTab === 'header' }" type="button" @click="responseTab = 'header'">Header</button>
        <button :class="{ 'is-active': responseTab === 'console' }" type="button" @click="responseTab = 'console'">控制台</button>
        <button :class="{ 'is-active': responseTab === 'actualRequest' }" type="button" @click="responseTab = 'actualRequest'">实际请求</button>
        <button :class="{ 'is-active': responseTab === 'assertions' }" type="button" @click="responseTab = 'assertions'">断言</button>
      </div>
      <div class="api-run-step-detail-viewer__code">
        <ApiCodeEditor v-if="responseTab === 'body'" :model-value="responseBody || '-'" :language="responseBodyLanguage" :read-only="true" :show-format-button="false" height="100%" />
        <ApiCodeEditor v-else-if="responseTab === 'header'" :model-value="responseHeaders" language="json" :read-only="true" :show-format-button="false" height="100%" />
        <ApiCodeEditor v-else-if="responseTab === 'console'" :model-value="responseConsole" language="text" :read-only="true" :show-format-button="false" height="100%" />
        <ApiCodeEditor v-else-if="responseTab === 'actualRequest'" :model-value="actualRequest" language="json" :read-only="true" :show-format-button="false" height="100%" />
        <div v-else class="api-run-step-detail-viewer__assertions">
          <div v-if="!assertions.length" class="api-run-step-detail-viewer__empty">当前请求未配置断言</div>
          <el-table v-else :data="assertions" size="small">
            <el-table-column label="断言名称" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">{{ row.name || assertionTypeLabel(row.type) }}</template>
            </el-table-column>
            <el-table-column label="断言对象" width="96">
              <template #default="{ row }">{{ assertionTypeLabel(row.type) }}</template>
            </el-table-column>
            <el-table-column label="条件" width="92">
              <template #default="{ row }">{{ assertionConditionLabel(row.condition) }}</template>
            </el-table-column>
            <el-table-column label="期望值" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.expectedValue || '-' }}</template>
            </el-table-column>
            <el-table-column label="实际值" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.actualValue || '-' }}</template>
            </el-table-column>
            <el-table-column label="结果" width="78">
              <template #default="{ row }">
                <span :class="['api-run-step-detail-viewer__assertion-result', row.success ? 'is-passed' : 'is-failed']">
                  {{ row.success ? '通过' : '不通过' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="失败原因" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">{{ row.success ? '-' : row.message || '-' }}</template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.api-run-step-detail-viewer {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
}

.api-run-step-detail-viewer__summary {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 10px;
  padding: 0 2px;
  color: #344054;
  font-size: 13px;
}

.api-run-step-detail-viewer__url {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-run-step-detail-viewer__request,
.api-run-step-detail-viewer__response {
  display: flex;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #ffffff;
}

.api-run-step-detail-viewer__section-head {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.api-run-step-detail-viewer__section-head strong {
  color: #111827;
  font-size: 14px;
  font-weight: 500;
}

.api-run-step-detail-viewer__metrics {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: #667085;
  font-size: 12px;
}

.api-run-step-detail-viewer__method {
  display: inline-flex;
  min-width: 48px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border: 1px solid currentColor;
  border-radius: 6px;
  background: #ffffff;
  font-size: 12px;
  font-weight: 600;
}

.api-run-step-detail-viewer__method.is-get,
.api-run-step-detail-viewer__method.is-head {
  color: #15803d;
}

.api-run-step-detail-viewer__method.is-post {
  color: #ea580c;
}

.api-run-step-detail-viewer__method.is-put {
  color: #2563eb;
}

.api-run-step-detail-viewer__method.is-delete {
  color: #dc2626;
}

.api-run-step-detail-viewer__method.is-patch,
.api-run-step-detail-viewer__method.is-options {
  color: #7c3aed;
}

.api-run-step-detail-viewer__tabs {
  display: flex;
  height: 41px;
  min-height: 41px;
  align-items: center;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 0 12px;
}

.api-run-step-detail-viewer__tabs button {
  box-sizing: border-box;
  height: 41px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #4b5563;
  cursor: pointer;
  font-size: 13px;
  padding: 0 12px;
}

.api-run-step-detail-viewer__tabs button.is-active {
  border-bottom-color: #2563eb;
  color: #2563eb;
  font-weight: 500;
}

.api-run-step-detail-viewer__code {
  min-height: 0;
  flex: 1;
  overflow: auto;
  background: #ffffff;
  padding: 12px;
}

.api-run-step-detail-viewer__response .api-run-step-detail-viewer__code {
  min-height: 0;
}

.api-run-step-detail-viewer__status,
.api-run-step-detail-viewer__result {
  color: #667085;
  font-weight: 500;
}

.api-run-step-detail-viewer__status.is-success,
.api-run-step-detail-viewer__result.is-passed {
  color: #16a34a;
}

.api-run-step-detail-viewer__status.is-danger,
.api-run-step-detail-viewer__result.is-failed,
.api-run-step-detail-viewer__result.is-not-passed {
  color: #dc2626;
}

.api-run-step-detail-viewer__status.is-warning {
  color: #ea580c;
}

.api-run-step-detail-viewer__result.is-no-assertion {
  color: #667085;
}

.api-run-step-detail-viewer__assertions {
  height: 100%;
  min-height: 0;
  overflow: auto;
}

.api-run-step-detail-viewer__empty {
  display: flex;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  color: #98a2b3;
  font-size: 13px;
}

.api-run-step-detail-viewer__assertion-result {
  display: inline-flex;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.api-run-step-detail-viewer__assertion-result.is-passed {
  background: #ecfdf3;
  color: #039855;
}

.api-run-step-detail-viewer__assertion-result.is-failed {
  background: #fef3f2;
  color: #d92d20;
}
</style>

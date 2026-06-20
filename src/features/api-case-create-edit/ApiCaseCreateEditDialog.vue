<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { X } from '@lucide/vue'

import {
  type ApiDefinitionCaseDetail,
  type ApiDefinitionCaseItem,
  type ApiDefinitionItem,
  type ApiKeyValueInput,
  type ApiRequestConfigInput,
  type ApiRunResult,
  type ApiRunStepResult,
} from '@/entities/api-automation'
import ApiCodeEditor from '@/widgets/api-interface-workspace/ApiCodeEditor.vue'

import ApiCaseAdvancedEditor from './ApiCaseAdvancedEditor.vue'
import {
  buildSaveApiCasePayload,
  createApiCaseFormFromDetail,
  createApiCaseFormFromSummary,
  createDefaultApiCaseForm,
  type ApiCaseDialogMode,
  type ApiCaseForm,
  validateApiCaseForm,
} from './model'

const CASE_PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3'] as const
const CASE_STATUS_OPTIONS = ['进行中', '已完成', '已废弃'] as const
const REQUEST_TABS = [
  { label: '请求头', value: 'headers' },
  { label: '请求体', value: 'body' },
  { label: 'Params', value: 'params' },
  { label: 'Auth', value: 'auth' },
  { label: '前置处理', value: 'pre' },
  { label: '后置处理', value: 'post' },
  { label: '断言', value: 'tests' },
  { label: '设置', value: 'settings' },
] as const
const BODY_MODES = [
  { label: 'none', value: 'NONE' },
  { label: 'form-data', value: 'FORM_DATA' },
  { label: 'x-www-form-urlencoded', value: 'FORM_URLENCODED' },
  { label: 'json', value: 'RAW_JSON' },
  { label: 'xml', value: 'RAW_XML' },
  { label: 'raw', value: 'RAW_TEXT' },
  { label: 'binary', value: 'BINARY' },
] as const
const QUERY_PARAM_TYPE_OPTIONS = ['string', 'number', 'boolean', 'array', 'object'] as const
const BODY_FORM_PARAM_TYPE_OPTIONS = ['string', 'number', 'boolean', 'array', 'object', 'file'] as const

type ApiCaseEditTab = typeof REQUEST_TABS[number]['value']
type ApiCaseBodyType = typeof BODY_MODES[number]['value']

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: ApiCaseDialogMode
    definition: ApiDefinitionItem | null
    caseItem?: ApiDefinitionCaseItem | null
    caseDetail?: ApiDefinitionCaseDetail | null
    caseDraftDetail?: ApiDefinitionCaseDetail | null
    saving?: boolean
    loadingDetail?: boolean
    detailErrorMessage?: string
    defaultWorkspaceCode?: string
    workspaceDisplayName?: string
    environmentName?: string
    variableSetName?: string
    debugRunning?: boolean
    debugResult?: ApiRunResult | null
    debugError?: string
  }>(),
  {
    caseItem: null,
    caseDetail: null,
    caseDraftDetail: null,
    detailErrorMessage: '',
    defaultWorkspaceCode: 'ALL',
    workspaceDisplayName: '',
    environmentName: '未选择环境',
    variableSetName: '未选择变量集',
    debugResult: null,
    debugError: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildSaveApiCasePayload>]
  debug: [payload: ReturnType<typeof buildSaveApiCasePayload>]
  retryDetail: []
}>()

const form = reactive<ApiCaseForm>(createDefaultApiCaseForm(props.definition, props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})
const activeTab = ref<ApiCaseEditTab>('body')
const binaryFileInputRef = ref<HTMLInputElement | null>(null)
const draggingKeyValueRow = ref<{ rows: ApiKeyValueInput[], index: number } | null>(null)

const drawerTitle = computed(() => props.mode === 'create' ? '创建用例' : '编辑用例')
const drawerSubtitle = computed(() => form.definitionName || props.definition?.name || '未选择接口')
const submitLabel = computed(() => props.mode === 'create' ? '创建' : '保存')
const primaryActionLabel = computed(() => props.debugRunning ? '发送中...' : '发送')
const canSubmit = computed(() => !props.loadingDetail && !props.detailErrorMessage && !props.saving)
const canSend = computed(() => Boolean(form.method?.trim() && form.path?.trim()) && !props.loadingDetail && !props.debugRunning)
const requestConfig = computed(() => form.baseRequestConfig as ApiRequestConfigInput)
const workspaceLabel = computed(() => {
  if (!form.workspaceCode || form.workspaceCode === 'ALL') return '未选择'
  return props.workspaceDisplayName || form.workspaceName || form.workspaceCode
})
const lastRunLabel = computed(() => formatTimeLabel(form.lastRunAt))
const queryEnabledCount = computed(() => enabledRows(requestConfig.value.queryParams).length)
const assertionEnabledCount = computed(() => form.assertions.filter((item: any) => item?.enabled !== false).length)
const rawBodyLanguage = computed(() => {
  if (requestConfig.value.body.type === 'RAW_JSON') return 'json'
  if (requestConfig.value.body.type === 'RAW_XML') return 'xml'
  return 'text'
})

const timeoutModel = computed({
  get: () => Number(requestConfig.value.timeoutMs || form.timeoutMs || 10000),
  set: (value: number | undefined) => {
    const nextValue = String(value || 10000)
    form.timeoutMs = nextValue
    requestConfig.value.timeoutMs = Number(nextValue) || 10000
  },
})

const bodyTextModel = computed({
  get: () => {
    const body = requestConfig.value.body
    if (body.type === 'RAW_JSON') return body.jsonText ?? body.rawText ?? ''
    if (body.type === 'RAW_XML') return body.xmlText ?? body.rawText ?? ''
    if (body.type === 'RAW_TEXT') return body.plainText ?? body.rawText ?? ''
    return body.rawText ?? ''
  },
  set: (value: string) => {
    const body = requestConfig.value.body
    body.rawText = value
    if (body.type === 'RAW_JSON') body.jsonText = value
    if (body.type === 'RAW_XML') body.xmlText = value
    if (body.type === 'RAW_TEXT') body.plainText = value
  },
})
const responseTab = ref<'body' | 'header' | 'console' | 'actualRequest' | 'assertions'>('body')
const responseStep = computed<ApiRunStepResult | null>(() => pickPreferredRunStep(props.debugResult?.stepResults ?? []))
const responseStatusCode = computed(() => responseStep.value?.response?.statusCode ?? null)
const responseDuration = computed(() => responseStep.value?.durationMs ?? null)
const responseBody = computed(() => toPrettyJson(responseStep.value?.response?.body || ''))
const hasResponseBody = computed(() => Boolean(responseBody.value.trim()))
const responseSize = computed(() => formatResponseSize(responseStep.value?.response?.body))
const latestResponseBodyForExtraction = computed(() => String(responseStep.value?.response?.body || ''))
const responseHeaders = computed(() => JSON.stringify(responseStep.value?.response?.headers ?? {}, null, 2))
const responseConsole = computed(() => buildConsolePreview(props.debugError, responseStep.value))
const responseActualRequest = computed(() => JSON.stringify(actualRequestPreview(responseStep.value?.request ?? null), null, 2))
const responseAssertionRows = computed(() => responseStep.value?.assertionResults ?? [])
const responseBodyLanguage = computed<'json' | 'xml' | 'text'>(() => {
  const content = String(responseStep.value?.response?.body || '')
  const contentType = responseStep.value?.response?.contentType || ''
  if (contentType.includes('json') || content.trim().startsWith('{') || content.trim().startsWith('[')) return 'json'
  if (contentType.includes('xml') || content.trim().startsWith('<')) return 'xml'
  return 'text'
})
const hasResponseContent = computed(() => Boolean(responseStep.value || props.debugError))

const tagsModel = computed<string[]>({
  get: () => parseTags(form.tagsText),
  set: (value) => {
    form.tagsText = value.map(item => item.trim()).filter(Boolean).join(', ')
  },
})

function parseTags(value: string) {
  return value
    .split(/[,，\n]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.caseDetail
      ? createApiCaseFormFromDetail(props.caseDetail)
      : props.mode === 'edit' && props.caseItem
        ? createApiCaseFormFromSummary(props.caseItem, props.definition, props.defaultWorkspaceCode)
        : props.mode === 'create' && props.caseDraftDetail
          ? createApiCaseFormFromDetail(props.caseDraftDetail)
          : createDefaultApiCaseForm(props.definition, props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  if (!form.workspaceName && props.definition?.workspaceName) {
    form.workspaceName = props.definition.workspaceName
  }
  if (!form.directoryName && props.definition?.directoryName) {
    form.directoryName = props.definition.directoryName
  }
  activeTab.value = 'body'
  formError.message = ''
}

function formatTimeLabel(value: string | null | undefined) {
  if (!value) return '未运行'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function enabledRows(rows: ApiKeyValueInput[] | undefined) {
  return (rows || []).filter(row => row.enabled !== false && (row.key || row.value))
}

function createEmptyRow(): ApiKeyValueInput {
  return {
    key: '',
    value: '',
    description: '',
    enabled: true,
    paramType: 'string',
    required: false,
    encode: true,
    minLength: null,
    maxLength: null,
  }
}

function addRow(rows: ApiKeyValueInput[]) {
  rows.push(createEmptyRow())
}

function removeRow(rows: ApiKeyValueInput[], index: number) {
  rows.splice(index, 1)
  if (!rows.length) {
    rows.push(createEmptyRow())
  }
}

function handleKeyValueDragStart(rows: ApiKeyValueInput[], index: number, event: DragEvent) {
  draggingKeyValueRow.value = { rows, index }
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function handleKeyValueDrop(rows: ApiKeyValueInput[], index: number, event: DragEvent) {
  event.preventDefault()
  const dragging = draggingKeyValueRow.value
  draggingKeyValueRow.value = null
  if (!dragging || dragging.rows !== rows || dragging.index === index) return
  const [moved] = rows.splice(dragging.index, 1)
  const targetIndex = dragging.index < index ? index - 1 : index
  rows.splice(targetIndex, 0, moved)
}

function handleKeyValueDragEnd() {
  draggingKeyValueRow.value = null
}

function isKeyValueRowDragging(rows: ApiKeyValueInput[], index: number) {
  const dragging = draggingKeyValueRow.value
  return Boolean(dragging && dragging.rows === rows && dragging.index === index)
}

function setBodyType(type: ApiCaseBodyType) {
  requestConfig.value.body.type = type
  if ((type === 'FORM_DATA' || type === 'FORM_URLENCODED') && !requestConfig.value.body.formItems.length) {
    requestConfig.value.body.formItems.push(createEmptyRow())
  }
}

function pickBinaryBodyFile() {
  binaryFileInputRef.value?.click()
}

function clearBinaryBodyFile() {
  requestConfig.value.body.fileName = null
  requestConfig.value.body.fileSize = null
  requestConfig.value.body.contentType = null
  requestConfig.value.body.binaryBase64 = null
  if (binaryFileInputRef.value) {
    binaryFileInputRef.value.value = ''
  }
}

function handleBinaryBodyFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const result = String(reader.result || '')
    const [, base64 = ''] = result.split(',')
    requestConfig.value.body.fileName = file.name
    requestConfig.value.body.fileSize = file.size
    requestConfig.value.body.contentType = file.type || null
    requestConfig.value.body.binaryBase64 = base64 || null
  }
  reader.readAsDataURL(file)
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] || '' : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function pickBodyFormRowFile(row: ApiKeyValueInput) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '*/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    row.paramType = 'file'
    row.fileName = file.name
    row.fileSize = file.size
    row.contentType = file.type || 'application/octet-stream'
    row.fileBase64 = await readFileAsBase64(file)
    row.value = file.name
  }
  input.click()
}

function clearBodyFormRowFile(row: ApiKeyValueInput) {
  row.fileName = null
  row.fileSize = null
  row.contentType = null
  row.fileBase64 = null
  if (row.paramType === 'file') {
    row.value = ''
  }
}

function formatBinaryFileSize(size: number | null | undefined) {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function setAuthType(value: string) {
  requestConfig.value.authConfig.authType = value
  if (value === 'BASIC' && !requestConfig.value.authConfig.basicAuth) {
    requestConfig.value.authConfig.basicAuth = { userName: '', password: '' }
  }
  if (value === 'DIGEST' && !requestConfig.value.authConfig.digestAuth) {
    requestConfig.value.authConfig.digestAuth = { userName: '', password: '' }
  }
}

function closeDrawer() {
  emit('update:modelValue', false)
}

function handleDrawerModelValueChange(value: boolean) {
  if (!value) {
    closeDrawer()
    return
  }
  emit('update:modelValue', value)
}

function handleBeforeClose() {
  closeDrawer()
}

function submit() {
  const error = validateApiCaseForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildSaveApiCasePayload(form))
}

function debugCurrentCase() {
  const error = validateApiCaseForm(form)
  if (error) {
    formError.message = error
    return
  }
  formError.message = ''
  responseTab.value = 'body'
  emit('debug', buildSaveApiCasePayload(form))
}

function pickPreferredRunStep(steps: ApiRunStepResult[]) {
  if (!steps.length) return null
  return steps.find(step => step.response || step.errorMessage || step.assertionResults?.length) || steps[0]
}

function toPrettyJson(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value !== 'string') {
    return JSON.stringify(value, null, 2)
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function formatResponseSize(value: unknown) {
  if (value === null || value === undefined || value === '') return '0 B'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const bytes = new Blob([text]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function enabledObjectRows(rows: ApiKeyValueInput[] | undefined) {
  return Object.fromEntries(enabledRows(rows).map(row => [row.key, row.value]))
}

function requestBodyPreviewFromForm() {
  const body = requestConfig.value.body
  if (body.type === 'NONE') return null
  if (body.type === 'RAW_JSON') return body.jsonText ?? body.rawText ?? null
  if (body.type === 'RAW_XML') return body.xmlText ?? body.rawText ?? null
  if (body.type === 'RAW_TEXT') return body.plainText ?? body.rawText ?? null
  if (body.type === 'BINARY') return body.fileName ? { fileName: body.fileName, fileSize: body.fileSize ?? null, contentType: body.contentType ?? null } : null
  return Object.fromEntries(enabledRows(body.formItems).map(row => [row.key, row.fileName || row.value || '']))
}

function actualRequestPreview(request: ApiRunStepResult['request']) {
  if (request) {
    return {
      method: request.method || form.method || 'GET',
      url: request.url || form.path || '',
      headers: request.headers ?? {},
      body: request.body ?? null,
    }
  }
  return {
    method: requestConfig.value.method || form.method || 'GET',
    url: requestConfig.value.path || form.path || '',
    headers: enabledObjectRows(requestConfig.value.headers),
    body: requestBodyPreviewFromForm(),
  }
}

function buildConsolePreview(errorMessage: string, step: ApiRunStepResult | null) {
  const lines: string[] = []
  const stepError = step?.errorMessage || errorMessage
  if (stepError) lines.push(`[错误] ${stepError}`)
  ;(step?.processorResults ?? []).forEach((item, index) => {
    const row = item as Record<string, unknown>
    lines.push(`[处理器 ${index + 1}] ${String(row.name || row.processorName || row.type || '处理器')} / ${row.success === false ? '失败' : '通过'}`)
    const message = row.message || row.errorMessage || row.durationMs
    if (message) lines.push(`  ${String(message)}`)
  })
  ;(step?.assertionResults ?? []).forEach((item, index) => {
    lines.push(`[断言 ${index + 1}] ${item.name || item.type} / ${item.success ? '通过' : '失败'}`)
    if (item.message) lines.push(`  ${item.message}`)
    if (item.expectedValue !== undefined || item.actualValue !== undefined) {
      lines.push(`  期望值: ${item.expectedValue ?? ''}`)
      lines.push(`  实际值: ${item.actualValue ?? ''}`)
    }
  })
  ;(step?.extractionResults ?? []).forEach((item, index) => {
    const row = item as Record<string, unknown>
    lines.push(`[提取 ${index + 1}] ${String(row.name || row.variableName || '提取项')} / ${row.success === false ? '失败' : '通过'}`)
    const value = row.value || row.actualValue || row.message || row.errorMessage
    if (value) lines.push(`  ${String(value)}`)
  })
  return lines.length ? lines.join('\n') : '暂无控制台内容'
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
    }
  },
)

watch(
  () => [props.definition, props.caseItem, props.caseDetail, props.caseDraftDetail, props.defaultWorkspaceCode],
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
)
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    append-to-body
    destroy-on-close
    :with-header="false"
    :show-close="false"
    close-on-click-modal
    close-on-press-escape
    modal-class="api-case-drawer-modal"
    size="894px"
    class="api-case-edit-drawer"
    :before-close="handleBeforeClose"
    @update:model-value="handleDrawerModelValueChange"
  >
    <div class="api-case-drawer-shell">
      <div class="api-case-drawer-top">
        <div class="api-case-drawer-header">
          <div class="api-case-drawer-title">{{ drawerTitle }}</div>
          <div class="api-case-drawer-subtitle">{{ drawerSubtitle }}</div>
        </div>
        <button type="button" class="api-case-drawer-close" @click="closeDrawer">
          <X />
        </button>
      </div>

      <div class="api-case-drawer-scroll">
        <div class="api-case-drawer-summary-card">
          <div class="api-case-drawer-summary-main">
            <div class="api-case-drawer-summary-meta">
              <span :class="['api-case-drawer-method-tag', `request-method-${String(form.method || 'GET').toLowerCase()}`]">
                {{ form.method || 'GET' }}
              </span>
              <span class="api-case-drawer-summary-path">{{ form.path || '未设置路径' }}</span>
            </div>
          </div>
        </div>

        <div v-if="loadingDetail" class="api-case-dialog__hint">正在加载用例详情...</div>
        <div v-else-if="detailErrorMessage" class="api-case-dialog__error-panel">
          <span>{{ detailErrorMessage }}</span>
          <button type="button" class="api-case-inline-button" @click="emit('retryDetail')">重试</button>
        </div>

        <div class="api-case-drawer-name-row">
          <el-input
            v-model="form.name"
            :disabled="loadingDetail"
            maxlength="255"
            show-word-limit
            placeholder="请输入用例名称"
            class="api-case-drawer-name-input"
          />
          <el-button class="api-case-drawer-debug-button" type="primary" :disabled="!canSend" :loading="debugRunning" @click="debugCurrentCase">
            {{ primaryActionLabel }}
          </el-button>
        </div>

        <div class="api-case-drawer-meta-row">
          <el-select v-model="form.priority" class="api-case-drawer-meta-field">
            <el-option v-for="item in CASE_PRIORITY_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
          <el-select v-model="form.status" class="api-case-drawer-meta-field">
            <el-option v-for="item in CASE_STATUS_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
          <el-select
            v-model="tagsModel"
            class="api-case-drawer-tags-field"
            multiple
            filterable
            allow-create
            default-first-option
            :reserve-keyword="false"
            :teleported="false"
            popper-class="api-case-drawer-tag-popper"
            placeholder="输入内容后回车可直接添加标签"
          />
        </div>

        <div class="api-case-drawer-tabs">
          <div class="ms-like-top-tabs case-drawer-top-tabs">
            <button
              v-for="tab in REQUEST_TABS"
              :key="tab.value"
              :class="['ms-like-top-tab', { active: activeTab === tab.value }]"
              @click="activeTab = tab.value"
            >
              {{ tab.label }}
              <span v-if="tab.value === 'params' && queryEnabledCount" class="ms-like-tab-badge">{{ queryEnabledCount }}</span>
              <span v-if="tab.value === 'tests' && assertionEnabledCount" class="ms-like-tab-badge">{{ assertionEnabledCount }}</span>
            </button>
          </div>
        </div>

        <div class="api-case-drawer-body">
          <div v-if="activeTab === 'headers'" class="api-case-editor-panel">
            <div class="request-section ms-like-table-surface ms-like-param-table ms-like-param-table--header">
              <div class="ms-like-table-header ms-like-param-table-grid ms-like-param-table-grid--header">
                <div class="ms-like-drag-cell"></div>
                <div class="ms-like-checkbox-cell ms-like-checkbox-cell--header">
                  <el-checkbox :model-value="true" disabled />
                </div>
                <span class="ms-like-header-input-title">参数名称</span>
                <span>参数值</span>
                <span>描述</span>
                <span class="ms-like-action-header">操作</span>
              </div>
              <div
                v-for="(row, index) in requestConfig.headers"
                :key="`header-${index}`"
                :class="['ms-like-table-row', 'ms-like-param-table-grid', 'ms-like-param-table-grid--header', { 'is-dragging': isKeyValueRowDragging(requestConfig.headers, index) }]"
                @dragover.prevent
                @drop="handleKeyValueDrop(requestConfig.headers, index, $event)"
              >
                <div class="ms-like-drag-cell">
                  <button
                    type="button"
                    class="ms-like-drag-handle"
                    draggable="true"
                    aria-label="拖拽排序"
                    @dragstart="handleKeyValueDragStart(requestConfig.headers, index, $event)"
                    @dragend="handleKeyValueDragEnd"
                  >
                    <span v-for="dotIndex in 6" :key="`header-dot-${index}-${dotIndex}`" class="ms-like-drag-dot"></span>
                  </button>
                </div>
                <div class="ms-like-checkbox-cell">
                  <el-checkbox v-model="row.enabled" />
                </div>
                <div class="ms-like-name-field">
                  <el-input v-model="row.key" placeholder="参数名称" />
                </div>
                <el-input v-model="row.value" placeholder="参数值" />
                <el-input v-model="row.description" placeholder="描述" />
                <button type="button" class="ms-like-row-remove" @click="removeRow(requestConfig.headers, index)">删除</button>
              </div>
              <button type="button" class="ms-like-add-row" @click="addRow(requestConfig.headers)">+ 添加一行</button>
            </div>
          </div>

          <div v-else-if="activeTab === 'params'" class="api-case-editor-panel">
            <div class="request-section ms-like-table-surface ms-like-param-table ms-like-param-table--query">
              <div class="ms-like-table-header ms-like-param-table-grid ms-like-param-table-grid--query">
                <div class="ms-like-drag-cell"></div>
                <div class="ms-like-checkbox-cell ms-like-checkbox-cell--header">
                  <el-checkbox :model-value="true" disabled />
                </div>
                <span class="ms-like-header-input-title">参数名称</span>
                <span class="ms-like-type-header">类型</span>
                <span>参数值</span>
                <span class="ms-like-length-header">长度范围</span>
                <span>编码</span>
                <span>描述</span>
                <span class="ms-like-action-header">操作</span>
              </div>
              <div
                v-for="(row, index) in requestConfig.queryParams"
                :key="`param-${index}`"
                :class="['ms-like-table-row', 'ms-like-param-table-grid', 'ms-like-param-table-grid--query', { 'is-dragging': isKeyValueRowDragging(requestConfig.queryParams, index) }]"
                @dragover.prevent
                @drop="handleKeyValueDrop(requestConfig.queryParams, index, $event)"
              >
                <div class="ms-like-drag-cell">
                  <button
                    type="button"
                    class="ms-like-drag-handle"
                    draggable="true"
                    aria-label="拖拽排序"
                    @dragstart="handleKeyValueDragStart(requestConfig.queryParams, index, $event)"
                    @dragend="handleKeyValueDragEnd"
                  >
                    <span v-for="dotIndex in 6" :key="`query-dot-${index}-${dotIndex}`" class="ms-like-drag-dot"></span>
                  </button>
                </div>
                <div class="ms-like-checkbox-cell">
                  <el-checkbox v-model="row.enabled" />
                </div>
                <div class="ms-like-name-field">
                  <el-input v-model="row.key" placeholder="参数名称" />
                </div>
                <div class="ms-like-type-field">
                  <button
                    type="button"
                    :class="['ms-like-required-button', { active: row.required }]"
                    :title="row.required ? '必填' : '非必填'"
                    @click="row.required = !row.required"
                  >
                    *
                  </button>
                  <el-select v-model="row.paramType" placeholder="类型">
                    <el-option v-for="option in QUERY_PARAM_TYPE_OPTIONS" :key="option" :label="option" :value="option" />
                  </el-select>
                </div>
                <el-input v-model="row.value" placeholder="参数值 / {{variable}}" />
                <div class="ms-like-length-range-cell">
                  <el-input-number v-model="row.minLength" :min="0" :controls="false" placeholder="最小" />
                  <span>至</span>
                  <el-input-number v-model="row.maxLength" :min="0" :controls="false" placeholder="最大" />
                </div>
                <div class="ms-like-switch-cell ms-like-switch-cell--query">
                  <el-switch v-model="row.encode" size="small" />
                </div>
                <el-input v-model="row.description" placeholder="描述" />
                <button type="button" class="ms-like-row-remove" @click="removeRow(requestConfig.queryParams, index)">删除</button>
              </div>
              <button type="button" class="ms-like-add-row" @click="addRow(requestConfig.queryParams)">+ 添加一行</button>
            </div>
          </div>

          <div v-else-if="activeTab === 'body'" class="api-case-editor-panel">
            <div class="ms-like-body-type-row">
              <button
                v-for="mode in BODY_MODES"
                :key="mode.value"
                type="button"
                :class="['ms-like-body-chip', { active: requestConfig.body.type === mode.value }]"
                @click="setBodyType(mode.value)"
              >
                {{ mode.label }}
              </button>
            </div>

            <div class="ms-like-body-mode-shell">
              <div v-if="requestConfig.body.type === 'NONE'" class="ms-like-empty-body">
                请求没有 Body
              </div>

              <div
                v-else-if="requestConfig.body.type === 'FORM_DATA' || requestConfig.body.type === 'FORM_URLENCODED'"
                class="body-form-grid ms-like-table-surface ms-like-param-table ms-like-param-table--body-form"
              >
                <div class="ms-like-table-header ms-like-param-table-grid ms-like-param-table-grid--body-form">
                  <div class="ms-like-drag-cell"></div>
                  <div class="ms-like-checkbox-cell ms-like-checkbox-cell--header">
                    <el-checkbox :model-value="true" disabled />
                  </div>
                  <span class="ms-like-header-input-title">参数名称</span>
                  <span class="ms-like-type-header">类型</span>
                  <span>参数值</span>
                  <span class="ms-like-length-header">长度范围</span>
                  <span>描述</span>
                  <span class="ms-like-action-header">操作</span>
                </div>
                <div
                  v-for="(row, index) in requestConfig.body.formItems"
                  :key="`body-form-${index}`"
                  :class="['ms-like-table-row', 'ms-like-param-table-grid', 'ms-like-param-table-grid--body-form', { 'is-dragging': isKeyValueRowDragging(requestConfig.body.formItems, index) }]"
                  @dragover.prevent
                  @drop="handleKeyValueDrop(requestConfig.body.formItems, index, $event)"
                >
                  <div class="ms-like-drag-cell">
                    <button
                      type="button"
                      class="ms-like-drag-handle"
                      draggable="true"
                      aria-label="拖拽排序"
                      @dragstart="handleKeyValueDragStart(requestConfig.body.formItems, index, $event)"
                      @dragend="handleKeyValueDragEnd"
                    >
                      <span v-for="dotIndex in 6" :key="`body-form-dot-${index}-${dotIndex}`" class="ms-like-drag-dot"></span>
                    </button>
                  </div>
                  <div class="ms-like-checkbox-cell">
                    <el-checkbox v-model="row.enabled" />
                  </div>
                  <div class="ms-like-name-field">
                    <el-input v-model="row.key" placeholder="参数名称" />
                  </div>
                  <div class="ms-like-type-field">
                    <button
                      type="button"
                      :class="['ms-like-required-button', { active: row.required }]"
                      :title="row.required ? '必填' : '非必填'"
                      @click="row.required = !row.required"
                    >
                      *
                    </button>
                    <el-select v-model="row.paramType" placeholder="类型">
                      <el-option v-for="option in BODY_FORM_PARAM_TYPE_OPTIONS" :key="option" :label="option" :value="option" />
                    </el-select>
                  </div>
                  <div v-if="row.paramType === 'file'" class="api-case-body-form-file-cell">
                    <button type="button" class="api-case-soft-button" @click="pickBodyFormRowFile(row)">
                      {{ row.fileName ? '重新选择' : '选择文件' }}
                    </button>
                    <button type="button" class="api-case-soft-button" :disabled="!row.fileBase64" @click="clearBodyFormRowFile(row)">清空</button>
                    <span v-if="row.fileName" class="api-case-body-form-file-name">
                      {{ row.fileName }}<template v-if="formatBinaryFileSize(row.fileSize)"> · {{ formatBinaryFileSize(row.fileSize) }}</template>
                    </span>
                  </div>
                  <el-input v-else v-model="row.value" placeholder="参数值" />
                  <div class="ms-like-length-range-cell">
                    <el-input-number v-model="row.minLength" :min="0" :controls="false" placeholder="最小" />
                    <span>至</span>
                    <el-input-number v-model="row.maxLength" :min="0" :controls="false" placeholder="最大" />
                  </div>
                  <el-input v-model="row.description" placeholder="描述" />
                  <button type="button" class="ms-like-row-remove" @click="removeRow(requestConfig.body.formItems, index)">删除</button>
                </div>
                <button type="button" class="ms-like-add-row" @click="addRow(requestConfig.body.formItems)">+ 添加一行</button>
              </div>

              <ApiCodeEditor
                v-else-if="requestConfig.body.type === 'RAW_JSON' || requestConfig.body.type === 'RAW_XML' || requestConfig.body.type === 'RAW_TEXT'"
                v-model="bodyTextModel"
                :language="rawBodyLanguage"
                height="300px"
                placeholder="请输入请求体"
              />

              <div v-else class="request-section ms-like-form-panel api-case-binary-panel">
                <div class="ms-like-form-row">
                  <div class="ms-like-form-label">File</div>
                  <div class="ms-like-form-control api-case-binary-actions">
                    <button type="button" class="api-case-soft-button" @click="pickBinaryBodyFile">
                      {{ requestConfig.body.fileName ? '重新选择' : '选择文件' }}
                    </button>
                    <button
                      type="button"
                      class="api-case-soft-button"
                      :disabled="!requestConfig.body.binaryBase64"
                      @click="clearBinaryBodyFile"
                    >
                      清空
                    </button>
                    <input
                      ref="binaryFileInputRef"
                      class="api-case-binary-input"
                      type="file"
                      @change="handleBinaryBodyFileChange"
                    >
                  </div>
                </div>
                <div class="ms-like-form-row">
                  <div class="ms-like-form-label">已选文件</div>
                  <div class="api-case-binary-hint">
                    <template v-if="requestConfig.body.fileName">
                      <span class="api-case-binary-name">{{ requestConfig.body.fileName }}</span>
                      <span v-if="formatBinaryFileSize(requestConfig.body.fileSize)">
                        {{ formatBinaryFileSize(requestConfig.body.fileSize) }}
                      </span>
                      <span v-if="requestConfig.body.contentType">{{ requestConfig.body.contentType }}</span>
                    </template>
                    <template v-else>暂未选择文件</template>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'auth'" class="request-section ms-like-form-panel">
            <div class="ms-like-form-row">
              <div class="ms-like-form-label">认证方式</div>
              <el-select
                :model-value="requestConfig.authConfig.authType"
                class="ms-like-form-control"
                @update:model-value="(value: string | number | boolean | Record<string, unknown>) => setAuthType(String(value))"
              >
                <el-option label="No Auth" value="NONE" />
                <el-option label="Basic Auth" value="BASIC" />
                <el-option label="Digest Auth" value="DIGEST" />
              </el-select>
            </div>
            <template v-if="requestConfig.authConfig.authType === 'BASIC' && requestConfig.authConfig.basicAuth">
              <div class="ms-like-form-row">
                <div class="ms-like-form-label">用户名</div>
                <el-input
                  v-model="requestConfig.authConfig.basicAuth.userName"
                  class="ms-like-form-control api-case-auth-control"
                  placeholder="用户名"
                />
              </div>
              <div class="ms-like-form-row">
                <div class="ms-like-form-label">密码</div>
                <el-input
                  v-model="requestConfig.authConfig.basicAuth.password"
                  class="ms-like-form-control api-case-auth-control"
                  type="password"
                  show-password
                  placeholder="密码"
                />
              </div>
            </template>
            <template v-else-if="requestConfig.authConfig.authType === 'DIGEST' && requestConfig.authConfig.digestAuth">
              <div class="ms-like-form-row">
                <div class="ms-like-form-label">用户名</div>
                <el-input
                  v-model="requestConfig.authConfig.digestAuth.userName"
                  class="ms-like-form-control api-case-auth-control"
                  placeholder="用户名"
                />
              </div>
              <div class="ms-like-form-row">
                <div class="ms-like-form-label">密码</div>
                <el-input
                  v-model="requestConfig.authConfig.digestAuth.password"
                  class="ms-like-form-control api-case-auth-control"
                  type="password"
                  show-password
                  placeholder="密码"
                />
              </div>
            </template>
          </div>

          <ApiCaseAdvancedEditor
            v-else-if="activeTab === 'pre'"
            v-model="form.preProcessors"
            kind="processor"
            stage="pre"
            :latest-response-body="latestResponseBodyForExtraction"
          />

          <ApiCaseAdvancedEditor
            v-else-if="activeTab === 'post'"
            v-model="form.postProcessors"
            kind="processor"
            stage="post"
            :latest-response-body="latestResponseBodyForExtraction"
          />

          <ApiCaseAdvancedEditor
            v-else-if="activeTab === 'tests'"
            v-model="form.assertions"
            kind="assertion"
            :latest-response-body="latestResponseBodyForExtraction"
          />

          <div v-else class="request-section ms-like-form-panel api-case-settings-panel">
            <div class="ms-like-form-row">
              <div class="ms-like-form-label">接口名称</div>
              <el-input v-model="form.name" class="ms-like-form-control" :disabled="loadingDetail" placeholder="接口名称" />
            </div>
            <div class="ms-like-form-row">
              <div class="ms-like-form-label">模块 / 目录</div>
              <el-input v-model="form.directoryName" class="ms-like-form-control" :disabled="loadingDetail" placeholder="模块 / 目录" />
            </div>
            <div class="ms-like-form-row">
              <div class="ms-like-form-label">标签</div>
              <el-input v-model="form.tagsText" class="ms-like-form-control" :disabled="loadingDetail" placeholder="标签，逗号分隔" />
            </div>
            <div class="ms-like-form-row">
              <div class="ms-like-form-label">超时时间</div>
              <el-input-number
                v-model="timeoutModel"
                class="ms-like-form-control full-width"
                :disabled="loadingDetail"
                :min="1000"
                :step="1000"
              />
            </div>
            <div class="ms-like-form-row align-start">
              <div class="ms-like-form-label">描述</div>
              <el-input
                v-model="form.description"
                class="ms-like-form-control"
                type="textarea"
                :rows="3"
                :disabled="loadingDetail"
                placeholder="接口描述、调用约束或备注"
              />
            </div>
            <div class="ms-like-settings-hint">
              <span>写入空间 {{ workspaceLabel }}</span>
              <span>调试上下文 {{ environmentName }} / {{ variableSetName }}</span>
              <span>最后运行 {{ lastRunLabel }}</span>
            </div>
          </div>

          <p v-if="formError.message" class="api-case-dialog__error">{{ formError.message }}</p>
        </div>

        <div class="api-case-response-shell">
          <div class="api-case-response-header">
            <strong>响应内容</strong>
            <div v-if="hasResponseContent" class="api-case-response-metrics">
              <span v-if="responseStatusCode !== null">状态 {{ responseStatusCode }}</span>
              <span v-if="responseDuration !== null">耗时 {{ responseDuration }} ms</span>
              <span>大小 {{ responseSize }}</span>
            </div>
          </div>
          <div class="api-case-response-tabs">
            <button :class="{ active: responseTab === 'body' }" type="button" @click="responseTab = 'body'">Body</button>
            <button :class="{ active: responseTab === 'header' }" type="button" @click="responseTab = 'header'">Header</button>
            <button :class="{ active: responseTab === 'console' }" type="button" @click="responseTab = 'console'">控制台</button>
            <button :class="{ active: responseTab === 'actualRequest' }" type="button" @click="responseTab = 'actualRequest'">实际请求</button>
            <button :class="{ active: responseTab === 'assertions' }" type="button" @click="responseTab = 'assertions'">断言</button>
          </div>
          <div class="api-case-response-body">
            <div v-if="!hasResponseContent" class="api-case-response-empty">
              <div class="api-case-response-empty-card">
                <div class="api-case-response-empty-window">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div class="api-case-response-empty-text">点击 <span>发送</span> 获取响应内容</div>
              </div>
            </div>
            <ApiCodeEditor
              v-else-if="responseTab === 'body' && hasResponseBody"
              :model-value="responseBody"
              :language="responseBodyLanguage"
              read-only
              :show-format-button="false"
              fit-content
              :max-fit-content-height="420"
              height="160px"
            />
            <div v-else-if="responseTab === 'body'" class="api-case-response-empty">
              <div class="api-case-response-empty-card">
                <div class="api-case-response-empty-text">暂无响应 Body，错误详情请查看 <span>控制台</span></div>
              </div>
            </div>
            <ApiCodeEditor
              v-else-if="responseTab === 'header'"
              :model-value="responseHeaders"
              language="json"
              read-only
              :show-format-button="false"
              fit-content
              :max-fit-content-height="420"
              height="160px"
            />
            <ApiCodeEditor
              v-else-if="responseTab === 'console'"
              :model-value="responseConsole"
              language="api-console"
              read-only
              :show-format-button="false"
              fit-content
              :max-fit-content-height="420"
              height="160px"
            />
            <ApiCodeEditor
              v-else-if="responseTab === 'actualRequest'"
              :model-value="responseActualRequest"
              language="json"
              read-only
              :show-format-button="false"
              fit-content
              :max-fit-content-height="420"
              height="160px"
            />
            <div v-else-if="responseAssertionRows.length" class="api-case-response-assertions">
              <div class="api-case-response-assertion-head">
                <span>结果</span>
                <span>断言对象</span>
                <span>条件</span>
                <span>期望值</span>
                <span>实际值</span>
                <span>失败原因</span>
              </div>
              <div v-for="(row, index) in responseAssertionRows" :key="row.id || index" class="api-case-response-assertion-row">
                <span :class="['api-case-result-pill', row.success ? 'is-pass' : 'is-fail']">{{ row.success ? '通过' : '失败' }}</span>
                <span>{{ row.name || row.subject || row.type }}</span>
                <span>{{ row.condition || '-' }}</span>
                <span>{{ row.expectedValue ?? '-' }}</span>
                <span>{{ row.actualValue ?? '-' }}</span>
                <span>{{ row.message || '-' }}</span>
              </div>
            </div>
            <div v-else class="api-case-response-empty">暂无断言结果</div>
          </div>
        </div>
      </div>

      <div class="api-case-drawer-footer">
        <el-button class="api-case-drawer-cancel-button" :disabled="saving" @click="closeDrawer">取消</el-button>
        <el-button
          class="api-case-drawer-submit-button"
          type="primary"
          :disabled="!canSubmit"
          :loading="saving"
          @click="submit"
        >
          {{ submitLabel }}
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
:global(.api-case-drawer-modal) {
  background: rgba(15, 23, 42, 0.28);
}

.api-case-edit-drawer :deep(.el-drawer) {
  max-width: calc(100vw - 24px);
  overflow: hidden;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  border-radius: 16px 0 0 16px;
  box-shadow: -24px 0 56px rgba(15, 23, 42, 0.16);
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Inter, Arial, sans-serif;
}

.api-case-edit-drawer :deep(.el-drawer__body) {
  padding: 0;
  overflow: hidden;
}

.api-case-edit-drawer :deep(.el-button),
.api-case-edit-drawer :deep(.el-input__inner) {
  font-family: inherit;
}

.api-case-drawer-shell {
  display: flex;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.api-case-drawer-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
  background: #fff;
}

.api-case-drawer-header {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.api-case-drawer-title {
  overflow: hidden;
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-drawer-subtitle {
  overflow: hidden;
  color: #6b7280;
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-drawer-close {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: color 0.18s ease, background-color 0.18s ease;
}

.api-case-drawer-close:hover,
.api-case-drawer-close:focus-visible {
  background: #f3f4f6;
  color: #374151;
}

.api-case-drawer-close svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.api-case-drawer-scroll {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  padding: 20px 24px 24px;
  scrollbar-color: #cbd5e1 transparent;
  scrollbar-width: thin;
}

.api-case-drawer-summary-card {
  padding: 0;
}

.api-case-drawer-summary-main,
.api-case-drawer-summary-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.api-case-drawer-method-tag {
  display: inline-flex;
  min-width: 44px;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border: 1px solid currentColor;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}

.api-case-drawer-method-tag.request-method-get,
.api-case-drawer-method-tag.request-method-head {
  color: #15803d;
}

.api-case-drawer-method-tag.request-method-post {
  color: #ea580c;
}

.api-case-drawer-method-tag.request-method-put {
  color: #2563eb;
}

.api-case-drawer-method-tag.request-method-delete {
  color: #dc2626;
}

.api-case-drawer-method-tag.request-method-patch,
.api-case-drawer-method-tag.request-method-options {
  color: #7c3aed;
}

.api-case-drawer-method-tag.request-method-trace {
  color: #6b7280;
}

.api-case-drawer-summary-path {
  min-width: 0;
  color: #4b5563;
  font-size: 13px;
  line-height: 20px;
  word-break: break-all;
}

.api-case-drawer-name-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.api-case-drawer-name-input :deep(.el-input__wrapper),
.api-case-drawer-meta-field :deep(.el-select__wrapper),
.api-case-drawer-tags-field :deep(.el-select__wrapper),
.ms-like-form-control :deep(.el-input__wrapper),
.ms-like-form-control :deep(.el-textarea__inner) {
  min-height: 36px;
  border-radius: 8px;
  background: #fff;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.api-case-drawer-name-input :deep(.el-input__wrapper:hover),
.api-case-drawer-meta-field :deep(.el-select__wrapper:hover),
.api-case-drawer-tags-field :deep(.el-select__wrapper:hover),
.ms-like-form-control :deep(.el-input__wrapper:hover),
.ms-like-form-control :deep(.el-textarea__inner:hover) {
  box-shadow: inset 0 0 0 1px #9ca3af;
}

.api-case-drawer-name-input :deep(.el-input__wrapper.is-focus),
.api-case-drawer-meta-field :deep(.el-select__wrapper.is-focused),
.api-case-drawer-tags-field :deep(.el-select__wrapper.is-focused),
.ms-like-form-control :deep(.el-input__wrapper.is-focus),
.ms-like-form-control :deep(.el-textarea__inner:focus) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.16);
}

.api-case-drawer-tags-field :deep(.el-select__wrapper) {
  align-items: center;
  padding: 0 10px;
}

.api-case-drawer-tags-field :deep(.el-select__selection) {
  display: flex;
  min-height: 34px;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.api-case-drawer-tags-field :deep(.el-select__caret),
.api-case-drawer-tags-field :deep(.el-select__suffix) {
  display: none;
}

.api-case-drawer-tags-field :deep(.el-tag) {
  height: 24px;
  margin: 0;
  padding: 0 8px;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  background: #eff6ff;
  color: #2563eb;
  line-height: 22px;
  box-shadow: none;
}

.api-case-drawer-tags-field :deep(.el-tag .el-tag__content) {
  font-size: 12px;
  font-weight: 500;
  line-height: 22px;
}

.api-case-drawer-meta-row {
  display: grid;
  grid-template-columns: 140px 140px minmax(0, 1fr);
  gap: 12px;
}

.api-case-drawer-tabs,
.api-case-drawer-body {
  min-width: 0;
}

.api-case-drawer-tabs,
.api-case-drawer-body,
.api-case-response-shell {
  flex: 0 0 auto;
}

.ms-like-top-tabs {
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
  height: 40px;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  scrollbar-width: none;
}

.ms-like-top-tabs::-webkit-scrollbar {
  display: none;
}

.ms-like-top-tab {
  position: relative;
  display: inline-flex;
  height: 40px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
}

.ms-like-top-tab:hover {
  color: #111827;
}

.ms-like-top-tab.active {
  border-bottom-color: #2563eb;
  color: #2563eb;
  font-weight: 600;
}

.ms-like-tab-badge {
  display: inline-flex;
  min-width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  padding: 0 5px;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
}

.ms-like-form-panel {
  display: grid;
  gap: 0;
  overflow: hidden;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.ms-like-form-row {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  padding: 12px 18px;
  border-bottom: 1px solid #f3f4f6;
}

.ms-like-form-row.align-start {
  align-items: flex-start;
}

.ms-like-form-label {
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.ms-like-form-control {
  width: 100%;
}

.ms-like-form-control.full-width :deep(.el-input__wrapper) {
  min-height: 32px;
}

.ms-like-settings-hint {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 18px;
  border-top: 1px solid #f3f4f6;
  background: #f9fafb;
  color: #6b7280;
  font-size: 12px;
  line-height: 18px;
}

.api-case-settings-panel .ms-like-form-row {
  padding-top: 10px;
  padding-bottom: 10px;
}

.api-case-editor-panel {
  display: grid;
  gap: 10px;
  padding-top: 12px;
}

.api-case-table-toolbar {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.api-case-table-toolbar strong,
.api-case-advanced-title {
  color: #111827;
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
}

.api-case-soft-button {
  display: inline-flex;
  height: 30px;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.api-case-soft-button:hover {
  border-color: #93c5fd;
  background: #eff6ff;
  color: #1d4ed8;
}

.api-case-soft-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.api-case-soft-button:disabled:hover {
  border-color: #d1d5db;
  background: #fff;
  color: #374151;
}

.api-case-body-form-file-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  margin: 0 8px;
}

.api-case-body-form-file-name {
  overflow: hidden;
  color: #4b5563;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-kv-table {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.api-case-kv-table--query,
.api-case-kv-table--form {
  overflow-x: auto;
}

.api-case-kv-head,
.api-case-kv-row {
  display: grid;
  grid-template-columns: 56px minmax(132px, 1fr) minmax(160px, 1.2fr) minmax(140px, 1fr) 64px;
  align-items: center;
}

.api-case-kv-head--headers,
.api-case-kv-row--headers {
  grid-template-columns: 56px minmax(160px, 1fr) minmax(180px, 1.2fr) minmax(160px, 1fr) 64px;
}

.api-case-kv-head--query,
.api-case-kv-row--query {
  min-width: 980px;
  grid-template-columns: 56px minmax(132px, 1fr) 132px minmax(150px, 1.1fr) 172px 64px minmax(140px, 1fr) 64px;
}

.api-case-kv-head--form,
.api-case-kv-row--form {
  min-width: 880px;
  grid-template-columns: 56px minmax(132px, 1fr) 132px minmax(150px, 1.1fr) 172px minmax(140px, 1fr) 64px;
}

.api-case-kv-head {
  min-height: 36px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.api-case-kv-head span {
  padding: 0 10px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.api-case-kv-row {
  min-height: 44px;
  border-bottom: 1px solid #f3f4f6;
}

.api-case-kv-row:last-child {
  border-bottom: 0;
}

.api-case-kv-row > * {
  margin: 0 8px;
}

.api-case-kv-row :deep(.el-input__wrapper) {
  min-height: 30px;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.api-case-kv-row :deep(.el-select__wrapper) {
  min-height: 30px;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.api-case-type-field {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}

.api-case-required-button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: #9ca3af;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}

.api-case-required-button.active {
  border-color: #fed7aa;
  background: #fff7ed;
  color: #ea580c;
}

.api-case-length-range-cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}

.api-case-length-range-cell span {
  color: #9ca3af;
  font-size: 12px;
  text-align: center;
}

.api-case-length-range-cell :deep(.el-input-number) {
  width: 100%;
}

.api-case-length-range-cell :deep(.el-input-number .el-input__wrapper) {
  padding: 0 8px;
}

.api-case-length-range-cell :deep(.el-input-number .el-input__inner) {
  text-align: left;
}

.api-case-switch-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.request-section.ms-like-table-surface,
.request-section.ms-like-form-panel,
.request-section.body-form-grid {
  gap: 0;
}

.ms-like-table-surface {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.ms-like-param-table {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

.ms-like-param-table::-webkit-scrollbar {
  height: 8px;
}

.ms-like-param-table::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.72);
}

.ms-like-param-table::-webkit-scrollbar-track {
  background: transparent;
}

.ms-like-table-header,
.ms-like-table-row,
.ms-like-param-table-grid {
  display: grid;
  align-items: center;
}

.ms-like-table-header {
  box-sizing: border-box;
  height: 40px;
  min-height: 40px;
  padding-right: 0;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.ms-like-table-row {
  min-height: 44px;
  border-bottom: 1px solid #f3f4f6;
  background: #fff;
}

.ms-like-table-row:last-of-type {
  border-bottom: 0;
}

.ms-like-table-row:hover {
  background: #f9fafb;
}

.ms-like-table-row.is-dragging {
  opacity: 0.56;
}

.ms-like-param-table-grid--header {
  min-width: 940px;
  grid-template-columns: 24px 32px repeat(3, minmax(0, 1fr)) 80px;
}

.ms-like-param-table-grid--query {
  min-width: 1480px;
  grid-template-columns: 24px 32px minmax(240px, 1fr) 150px minmax(240px, 1fr) 200px 80px minmax(220px, 1fr) 90px;
}

.ms-like-param-table-grid--body-form {
  min-width: 1400px;
  grid-template-columns: 24px 32px 240px 150px 240px 200px minmax(220px, 1fr) 90px;
}

.ms-like-table-header span,
.ms-like-action-header {
  min-width: 0;
  padding: 0 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-like-drag-cell,
.ms-like-checkbox-cell,
.ms-like-name-field,
.ms-like-type-field,
.ms-like-switch-cell {
  display: flex;
  min-width: 0;
  align-items: center;
}

.ms-like-drag-cell,
.ms-like-checkbox-cell,
.ms-like-switch-cell {
  justify-content: center;
}

.ms-like-drag-handle {
  display: grid;
  width: 18px;
  height: 30px;
  grid-template-columns: repeat(2, 3px);
  align-content: center;
  justify-content: center;
  gap: 3px;
  border: 0;
  background: transparent;
  cursor: grab;
}

.ms-like-drag-handle:active {
  cursor: grabbing;
}

.ms-like-drag-dot {
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: #cbd5e1;
}

.ms-like-table-row > .el-input,
.ms-like-table-row > .el-select,
.ms-like-table-row > .ms-like-name-field,
.ms-like-table-row > .ms-like-type-field,
.ms-like-table-row > .ms-like-length-range-cell,
.ms-like-table-row > .ms-like-switch-cell {
  margin: 0 8px;
}

.ms-like-table-row :deep(.el-input__wrapper),
.ms-like-table-row :deep(.el-select__wrapper) {
  min-height: 30px;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.ms-like-type-field {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 6px;
}

.ms-like-required-button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: #9ca3af;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}

.ms-like-required-button.active {
  border-color: #fed7aa;
  background: #fff7ed;
  color: #ea580c;
}

.ms-like-length-range-cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}

.ms-like-length-range-cell span {
  color: #9ca3af;
  font-size: 12px;
  text-align: center;
}

.ms-like-length-range-cell :deep(.el-input-number) {
  width: 100%;
}

.ms-like-length-range-cell :deep(.el-input-number .el-input__wrapper) {
  padding: 0 8px;
}

.ms-like-length-range-cell :deep(.el-input-number .el-input__inner) {
  text-align: left;
}

.ms-like-row-remove {
  justify-self: center;
  border: 0;
  background: transparent;
  color: #c75450;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.ms-like-row-remove:hover {
  color: #b91c1c;
}

.ms-like-add-row {
  width: 100%;
  height: 38px;
  border: 0;
  border-top: 1px solid #f3f4f6;
  background: #fff;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.ms-like-add-row:hover {
  background: #eff6ff;
}

.api-case-text-danger {
  border: 0;
  background: transparent;
  color: #dc2626;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.api-case-text-danger:hover {
  color: #b91c1c;
}

.api-case-body-mode-row,
.ms-like-body-type-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.api-case-body-mode,
.ms-like-body-chip {
  height: 24px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
  line-height: 22px;
  cursor: pointer;
}

.api-case-body-mode:hover,
.ms-like-body-chip:hover {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
}

.api-case-body-mode.active,
.ms-like-body-chip.active {
  border-color: #93c5fd;
  background: #eff6ff;
  color: #2563eb;
}

.ms-like-body-mode-shell {
  display: flex;
  min-height: 300px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.ms-like-body-mode-shell > .ms-like-empty-body {
  display: flex;
  width: 100%;
  min-height: 300px;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  color: #9ca3af;
  font-size: 13px;
  font-weight: 500;
}

.ms-like-body-mode-shell > .api-case-kv-table,
.ms-like-body-mode-shell > .request-section,
.ms-like-body-mode-shell > .ms-monaco-editor {
  width: 100%;
  min-height: 300px;
  border: 0;
  border-radius: 0;
}

.api-case-binary-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-case-binary-input {
  display: none;
}

.api-case-binary-hint,
.api-case-advanced-empty {
  color: #6b7280;
  font-size: 12px;
  line-height: 18px;
}

.api-case-binary-hint {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 8px;
}

.api-case-binary-name {
  max-width: 320px;
  overflow: hidden;
  color: #374151;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-auth-control {
  width: min(100%, 450px);
}

.api-case-advanced-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 360px;
  gap: 12px;
  padding-top: 12px;
}

.api-case-advanced-list,
.api-case-advanced-detail {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.api-case-advanced-list {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 12px;
}

.api-case-advanced-detail {
  padding: 12px;
}

.api-case-response-shell {
  overflow: hidden;
  border-top: 1px solid #e5e7eb;
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  border-radius: 0;
  background: #fff;
}

.api-case-response-header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0;
  border-bottom: 0;
}

.api-case-response-header strong {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.api-case-response-metrics {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-case-response-metrics span {
  display: inline-flex;
  min-width: 48px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #667085;
  font-size: 12px;
  font-weight: 600;
}

.api-case-response-tabs {
  display: flex;
  align-items: center;
  gap: 0;
  height: 40px;
  padding: 0;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.api-case-response-tabs button {
  height: 40px;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.api-case-response-tabs button.active {
  border-bottom-color: #2563eb;
  color: #2563eb;
  font-weight: 600;
}

.api-case-response-body {
  min-height: 140px;
  padding: 8px 0 10px;
  background: #fff;
}

.api-case-response-empty {
  padding: 8px 0 10px;
}

.api-case-response-empty-card {
  display: grid;
  min-height: 96px;
  place-items: center;
  gap: 8px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #fff;
}

.api-case-response-empty-window {
  display: flex;
  width: 58px;
  height: 36px;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.api-case-response-empty-window span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #9ca3af;
}

.api-case-response-empty-text {
  color: #9ca3af;
  font-size: 13px;
  font-weight: 500;
}

.api-case-response-empty-text span {
  color: #2563eb;
  font-weight: 600;
}

.api-case-response-assertions {
  overflow: auto;
  background: #fff;
}

.api-case-response-assertion-head,
.api-case-response-assertion-row {
  display: grid;
  grid-template-columns: 76px minmax(120px, 1fr) 90px minmax(120px, 1fr) minmax(120px, 1fr) minmax(140px, 1fr);
  align-items: center;
  min-width: 820px;
}

.api-case-response-assertion-head {
  min-height: 36px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.api-case-response-assertion-head span,
.api-case-response-assertion-row span {
  min-width: 0;
  overflow: hidden;
  padding: 0 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-response-assertion-head span {
  color: #6b7280;
  font-size: 12px;
  font-weight: 700;
}

.api-case-response-assertion-row {
  min-height: 42px;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
  font-size: 12px;
}

.api-case-result-pill {
  display: inline-flex;
  width: fit-content;
  height: 22px;
  align-items: center;
  margin-left: 10px;
  padding: 0 8px !important;
  border-radius: 999px;
  font-weight: 700;
}

.api-case-result-pill.is-pass {
  background: #f0fdf4;
  color: #15803d;
}

.api-case-result-pill.is-fail {
  background: #fef2f2;
  color: #dc2626;
}

.api-case-drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
  background: #fff;
}

.api-case-drawer-debug-button,
.api-case-drawer-submit-button,
.api-case-drawer-cancel-button,
.api-case-inline-button {
  min-width: 76px;
  height: 36px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.api-case-edit-drawer :deep(.api-case-drawer-debug-button.el-button--primary),
.api-case-edit-drawer :deep(.api-case-drawer-submit-button.el-button--primary) {
  --el-button-bg-color: #2563eb;
  --el-button-border-color: #2563eb;
  --el-button-hover-bg-color: #1d4ed8;
  --el-button-hover-border-color: #1d4ed8;
  --el-button-active-bg-color: #1e40af;
  --el-button-active-border-color: #1e40af;
  --el-button-disabled-bg-color: #93c5fd;
  --el-button-disabled-border-color: #93c5fd;
  color: #fff;
}

.api-case-drawer-cancel-button,
.api-case-inline-button {
  --el-button-text-color: #111827;
  --el-button-border-color: #d1d5db;
  --el-button-bg-color: #fff;
  --el-button-hover-text-color: #111827;
  --el-button-hover-border-color: #9ca3af;
  --el-button-hover-bg-color: #f9fafb;
  color: #111827;
}

.api-case-dialog__hint,
.api-case-dialog__error-panel {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.api-case-dialog__hint {
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #6b7280;
}

.api-case-dialog__error-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.api-case-dialog__error-panel span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-dialog__error {
  margin: 8px 0 0;
  color: #dc2626;
  font-size: 13px;
}

@media (max-width: 960px) {
  .api-case-drawer-meta-row,
  .api-case-drawer-name-row,
  .ms-like-form-row {
    grid-template-columns: 1fr;
  }
}
</style>

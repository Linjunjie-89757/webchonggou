<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  CopyDocument,
  Delete,
  Plus,
  VideoCamera,
  VideoPlay,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  formatStepType,
  requiresInput,
  requiresLocator,
  webUiAutomationApi,
  WEB_UI_BROWSER_OPTIONS,
  WEB_UI_LOCATOR_OPTIONS,
  WEB_UI_SCREENSHOT_POLICY_OPTIONS,
  WEB_UI_STEP_TYPE_OPTIONS,
  WebUiStepTypeBadge,
  type SaveWebUiCasePayload,
  type WebUiBrowserType,
  type WebUiCaseDetail,
  type WebUiCaseStatus,
  type WebUiCaseStepItem,
  type WebUiLocatorType,
  type WebUiScreenshotPolicy,
  type WebUiStepType,
} from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

interface EditableStep {
  id?: number | null
  name: string
  type: WebUiStepType
  elementId: number | null
  elementName: string | null
  locatorType: WebUiLocatorType | null
  locatorValue: string
  inputValue: string
  timeoutMs: number | null
  continueOnFailure: boolean
  screenshotPolicy: WebUiScreenshotPolicy
  enabled: boolean
  sortOrder: number
}

interface CaseForm {
  name: string
  moduleName: string
  description: string
  baseUrl: string
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  status: WebUiCaseStatus
  steps: EditableStep[]
}

const props = withDefaults(
  defineProps<{
    workspaceCode: string
    workspaceReady?: boolean
  }>(),
  {
    workspaceReady: true,
  },
)

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const running = ref(false)
const localRunning = ref(false)
const errorMessage = ref('')
const selectedStepIndex = ref(0)
const form = ref<CaseForm>(createEmptyForm())

const caseId = computed(() => {
  const raw = Array.isArray(route.params.caseId) ? route.params.caseId[0] : route.params.caseId
  const numeric = Number(raw)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
})

const selectedStep = computed(() => form.value.steps[selectedStepIndex.value] || null)
const focusedStepId = computed(() => {
  const raw = Array.isArray(route.query.stepId) ? route.query.stepId[0] : route.query.stepId
  const numeric = Number(raw)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
})

function createEmptyForm(): CaseForm {
  return {
    name: '',
    moduleName: '',
    description: '',
    baseUrl: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    status: 'ENABLED',
    steps: [],
  }
}

function createStep(sortOrder = form.value.steps.length + 1): EditableStep {
  return {
    id: null,
    name: '',
    type: 'OPEN',
    elementId: null,
    elementName: null,
    locatorType: null,
    locatorValue: '',
    inputValue: '',
    timeoutMs: null,
    continueOnFailure: false,
    screenshotPolicy: 'NONE',
    enabled: true,
    sortOrder,
  }
}

function toEditableStep(item: WebUiCaseStepItem, index: number): EditableStep {
  return {
    id: item.id ?? null,
    name: item.name || '',
    type: item.type || 'OPEN',
    elementId: item.elementId ?? null,
    elementName: item.elementName || null,
    locatorType: item.locatorType || null,
    locatorValue: item.locatorValue || '',
    inputValue: item.inputValue || '',
    timeoutMs: item.timeoutMs ?? null,
    continueOnFailure: Boolean(item.continueOnFailure),
    screenshotPolicy: item.screenshotPolicy || 'NONE',
    enabled: item.enabled !== false,
    sortOrder: Number(item.sortOrder || index + 1),
  }
}

function fillForm(item: WebUiCaseDetail) {
  form.value = {
    name: item.name || '',
    moduleName: item.moduleName || '',
    description: item.description || '',
    baseUrl: item.baseUrl || '',
    browserType: item.browserType || 'CHROMIUM',
    headless: item.headless !== false,
    defaultTimeoutMs: Number(item.defaultTimeoutMs || 10000),
    status: item.status || 'ENABLED',
    steps: Array.isArray(item.steps) ? item.steps.map(toEditableStep) : [],
  }
  selectInitialStep()
}

function selectInitialStep() {
  const stepId = focusedStepId.value
  if (stepId) {
    const index = form.value.steps.findIndex(step => step.id === stepId)
    if (index >= 0) {
      selectedStepIndex.value = index
      return
    }
  }
  selectedStepIndex.value = form.value.steps.length ? Math.min(selectedStepIndex.value, form.value.steps.length - 1) : 0
}

async function loadDetail() {
  if (!props.workspaceReady || !caseId.value) {
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const caseDetail = await webUiAutomationApi.getCaseDetail(props.workspaceCode, caseId.value)
    fillForm(caseDetail)
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function buildPayload(): SaveWebUiCasePayload {
  return {
    workspaceCode: props.workspaceCode,
    name: form.value.name.trim(),
    moduleName: form.value.moduleName.trim() || null,
    description: form.value.description.trim() || null,
    baseUrl: form.value.baseUrl.trim() || null,
    browserType: form.value.browserType,
    headless: form.value.headless,
    defaultTimeoutMs: Number(form.value.defaultTimeoutMs || 10000),
    status: form.value.status,
    steps: form.value.steps.map((step, index) => ({
      id: step.id ?? null,
      name: step.name.trim() || null,
      type: step.type,
      elementId: step.elementId ?? null,
      elementName: step.elementName || null,
      locatorType: step.locatorType,
      locatorValue: step.locatorValue.trim() || null,
      inputValue: step.inputValue.trim() || null,
      timeoutMs: step.timeoutMs ?? null,
      continueOnFailure: step.continueOnFailure,
      screenshotPolicy: step.screenshotPolicy,
      enabled: step.enabled,
      sortOrder: index + 1,
    })),
  }
}

function validateBeforeSave() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写用例名称')
    return false
  }
  if (!form.value.steps.length) {
    ElMessage.warning('请至少添加一个步骤')
    return false
  }

  const invalidStepIndex = form.value.steps.findIndex((step) => {
    if (requiresLocator(step.type) && (!step.locatorType || !step.locatorValue.trim())) {
      return true
    }
    if (requiresInput(step.type) && !step.inputValue.trim()) {
      return true
    }
    return false
  })
  if (invalidStepIndex >= 0) {
    selectedStepIndex.value = invalidStepIndex
    ElMessage.warning(`第 ${invalidStepIndex + 1} 步缺少必要配置`)
    return false
  }

  return true
}

async function saveCase() {
  if (!caseId.value || !validateBeforeSave()) {
    return
  }

  saving.value = true
  try {
    const saved = await webUiAutomationApi.updateCase(props.workspaceCode, caseId.value, buildPayload())
    fillForm(saved)
    ElMessage.success('Web UI 用例已保存')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function runCase(localRunner: boolean) {
  if (!caseId.value) {
    return
  }

  const loadingRef = localRunner ? localRunning : running
  loadingRef.value = true
  try {
    const result = localRunner
      ? (await webUiAutomationApi.createLocalRunnerRun(props.workspaceCode, caseId.value, {})).run
      : await webUiAutomationApi.runCase(props.workspaceCode, caseId.value, {})
    void result
    ElMessage.success(localRunner ? '已创建本地运行任务' : '调试运行完成')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loadingRef.value = false
  }
}

function backToList() {
  void router.push({ path: '/automation/web/cases', query: { workspace: props.workspaceCode } })
}

function addStep() {
  form.value.steps.push(createStep())
  selectedStepIndex.value = form.value.steps.length - 1
  reorderSteps()
}

function copySelectedStep() {
  const step = selectedStep.value
  if (!step) {
    return
  }
  form.value.steps.splice(selectedStepIndex.value + 1, 0, {
    ...step,
    id: null,
    name: step.name ? `${step.name}副本` : '',
  })
  selectedStepIndex.value += 1
  reorderSteps()
}

async function removeSelectedStep() {
  if (!selectedStep.value) {
    return
  }
  try {
    await ElMessageBox.confirm('删除当前步骤后需要保存才会生效，确认删除？', '删除步骤', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  form.value.steps.splice(selectedStepIndex.value, 1)
  selectedStepIndex.value = Math.max(0, Math.min(selectedStepIndex.value, form.value.steps.length - 1))
  reorderSteps()
}

function reorderSteps() {
  form.value.steps.forEach((step, index) => {
    step.sortOrder = index + 1
  })
}

function handleStepTypeChange(step: EditableStep) {
  if (!requiresLocator(step.type)) {
    step.elementId = null
    step.elementName = null
    step.locatorType = null
    step.locatorValue = ''
  } else if (!step.locatorType) {
    step.locatorType = 'CSS'
  }
  if (!requiresInput(step.type)) {
    step.inputValue = ''
  }
}

function getStepActionConfigTitle(type: WebUiStepType) {
  if (type === 'OPEN') return '页面地址'
  if (type === 'FILL') return '输入配置'
  if (type === 'SELECT') return '下拉选择'
  if (type === 'FILE_UPLOAD') return '上传配置'
  if (type === 'PRESS_KEY') return '按键配置'
  if (type === 'ASSERT_TEXT') return '文本断言'
  if (type === 'ASSERT_URL') return 'URL 断言'
  if (type === 'ASSERT_TITLE') return '标题断言'
  if (type === 'ASSERT_ATTRIBUTE') return '属性断言'
  if (type === 'ASSERT_COUNT') return '数量断言'
  return '动作配置'
}

function getStepInputLabel(type: WebUiStepType) {
  if (type === 'OPEN') return '页面地址'
  if (type === 'FILL') return '输入文本'
  if (type === 'SELECT') return '选项值或标签'
  if (type === 'ASSERT_TEXT') return '期望文本'
  if (type === 'ASSERT_URL') return 'URL 关键字'
  if (type === 'ASSERT_TITLE') return '标题关键字'
  if (type === 'ASSERT_ATTRIBUTE') return '属性与期望值'
  if (type === 'ASSERT_COUNT') return '数量表达式'
  if (type === 'PRESS_KEY') return '按键'
  if (type === 'FILE_UPLOAD') return '文件路径'
  return '输入/目标'
}

function getStepInputPlaceholder(type: WebUiStepType) {
  if (type === 'OPEN') return '输入相对路径或完整 URL'
  if (type === 'FILL') return '输入要填充的文本内容'
  if (type === 'SELECT') return '输入 option 的值或可见文本'
  if (type === 'FILE_UPLOAD') return '输入本机文件路径'
  if (type === 'PRESS_KEY') return '例如 Enter、Escape、Control+A'
  if (type === 'ASSERT_TEXT') return '输入元素应包含的文本'
  if (type === 'ASSERT_URL') return '输入当前 URL 应包含的关键字'
  if (type === 'ASSERT_TITLE') return '输入页面标题应包含的关键字'
  if (type === 'ASSERT_ATTRIBUTE') return '格式：属性=期望值，例如 href=/home'
  if (type === 'ASSERT_COUNT') return '例如 =1、>0、<3'
  return '输入当前步骤需要的目标值'
}

function shouldUseTextarea(type: WebUiStepType) {
  return ['FILL', 'ASSERT_TEXT'].includes(type)
}

function showRecordingPlaceholder() {
  ElMessage.info('录制会由 Local Runner 打开真实浏览器完成。当前页面先预留录制控制台入口，后续接入录制会话协议。')
}

function showStepFeaturePlaceholder(featureName: string) {
  ElMessage.info(`${featureName}需要后端步骤字段和 Local Runner 执行逻辑配套，当前先预留配置入口。`)
}

onMounted(() => {
  void loadDetail()
})

watch(
  () => [props.workspaceReady, props.workspaceCode, caseId.value, route.query.stepId] as const,
  () => {
    void loadDetail()
  },
)
</script>

<template>
  <div class="web-ui-case-detail">
    <div class="web-ui-case-detail__toolbar">
      <div class="web-ui-case-detail__title">
        <AppButton :icon="ArrowLeft" @click="backToList">返回列表</AppButton>
        <h2>{{ form.name || 'Web UI 用例详情' }}</h2>
      </div>
      <div class="web-ui-case-detail__actions">
        <AppButton :icon="VideoCamera" @click="showRecordingPlaceholder">开始录制</AppButton>
        <AppButton :loading="localRunning" :disabled="saving || running" @click="runCase(true)">本地运行</AppButton>
        <AppButton :loading="running" :disabled="saving || localRunning" @click="runCase(false)">调试运行</AppButton>
        <AppButton type="primary" :loading="saving" :disabled="loading || running || localRunning" @click="saveCase">保存</AppButton>
      </div>
    </div>

    <AppLoadingState v-if="loading" title="正在加载 Web UI 用例" description="正在读取基础信息、步骤和最近一次执行记录。" />
    <AppEmptyState v-else-if="errorMessage" title="用例加载失败" :description="errorMessage">
      <template #actions>
        <AppButton @click="loadDetail">重新加载</AppButton>
        <AppButton type="primary" @click="backToList">返回列表</AppButton>
      </template>
    </AppEmptyState>

    <div v-else class="web-ui-case-detail__body">
      <aside class="web-ui-case-detail__steps" aria-label="步骤列表">
        <div class="web-ui-case-detail__panel-header">
          <div>
            <h3>步骤列表</h3>
            <p>共 {{ form.steps.length }} 步</p>
          </div>
          <AppButton type="primary" :icon="Plus" @click="addStep">新增</AppButton>
        </div>
        <div v-if="form.steps.length" class="web-ui-step-list">
          <button
            v-for="(step, index) in form.steps"
            :key="`${step.id || 'new'}-${index}`"
            type="button"
            class="web-ui-step-list__item"
            :class="{ 'is-active': selectedStepIndex === index, 'is-disabled': !step.enabled }"
            @click="selectedStepIndex = index"
          >
            <span class="web-ui-step-list__order">{{ index + 1 }}</span>
            <span class="web-ui-step-list__content">
              <strong>{{ step.name || formatStepType(step.type) }}</strong>
              <small>{{ step.locatorValue || step.inputValue || '暂无定位或输入' }}</small>
            </span>
            <WebUiStepTypeBadge :type="step.type" />
          </button>
        </div>
        <AppEmptyState v-else title="还没有步骤" description="新增第一步后即可配置打开页面、点击、输入和断言。" />
      </aside>

      <main class="web-ui-case-detail__editor">
        <section class="web-ui-case-detail__section web-ui-case-detail__section--step">
          <div class="web-ui-case-detail__section-title">
            <div>
              <h3>当前步骤</h3>
              <p v-if="selectedStep">第 {{ selectedStepIndex + 1 }} 步 · {{ WEB_UI_STEP_TYPE_OPTIONS.find(item => item.value === selectedStep?.type)?.description }}</p>
            </div>
            <div class="web-ui-case-detail__step-actions">
              <AppButton :icon="CopyDocument" :disabled="!selectedStep" @click="copySelectedStep">复制</AppButton>
              <AppButton :icon="Delete" :disabled="!selectedStep" @click="removeSelectedStep">删除</AppButton>
            </div>
          </div>

          <AppEmptyState v-if="!selectedStep" title="请选择步骤" description="左侧新增或选择一个步骤后，在这里编辑动作、定位器和断言目标。" />
          <div v-else class="web-ui-step-editor">
            <section class="web-ui-step-config">
              <h4>基础信息</h4>
              <div class="web-ui-step-config__grid">
                <el-form-item label="步骤名称">
                  <el-input v-model="selectedStep.name" maxlength="80" clearable />
                </el-form-item>
                <el-form-item label="步骤类型">
                  <el-select v-model="selectedStep.type" @change="handleStepTypeChange(selectedStep)">
                    <el-option v-for="item in WEB_UI_STEP_TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                </el-form-item>
              </div>
            </section>

            <section v-if="requiresLocator(selectedStep.type)" class="web-ui-step-config">
              <h4>元素定位</h4>
              <el-form-item label="定位方式">
                <el-radio-group v-model="selectedStep.locatorType" class="web-ui-locator-radio">
                  <el-radio
                    v-for="item in WEB_UI_LOCATOR_OPTIONS"
                    :key="item.value"
                    :label="item.value"
                  >
                    {{ item.label }}
                  </el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="定位值">
                <el-input
                  v-model="selectedStep.locatorValue"
                  placeholder="输入 CSS、文本、角色、XPath 等定位值"
                  clearable
                />
              </el-form-item>
            </section>

            <section v-if="requiresInput(selectedStep.type)" class="web-ui-step-config">
              <h4>{{ getStepActionConfigTitle(selectedStep.type) }}</h4>
              <el-form-item :label="getStepInputLabel(selectedStep.type)">
                <el-input
                  v-model="selectedStep.inputValue"
                  :type="shouldUseTextarea(selectedStep.type) ? 'textarea' : 'text'"
                  :rows="shouldUseTextarea(selectedStep.type) ? 3 : undefined"
                  :placeholder="getStepInputPlaceholder(selectedStep.type)"
                  clearable
                />
              </el-form-item>
            </section>

            <section class="web-ui-step-config">
              <h4>前置 / 后置处理</h4>
              <div class="web-ui-step-config__grid">
                <el-form-item label="前置等待(ms)">
                  <el-input-number :model-value="0" :min="0" :step="500" controls-position="right" disabled />
                </el-form-item>
                <el-form-item label="后置等待(ms)">
                  <el-input-number :model-value="0" :min="0" :step="500" controls-position="right" disabled />
                </el-form-item>
              </div>
              <div class="web-ui-step-config__action-row">
                <span>提取变量</span>
                <AppButton @click="showStepFeaturePlaceholder('提取变量')">添加提取变量</AppButton>
                <small>可从页面元素中提取值存入运行时变量，供后续步骤使用</small>
              </div>
            </section>

            <section class="web-ui-step-config">
              <h4>高级配置</h4>
              <div class="web-ui-step-config__grid">
                <el-form-item label="超时时间(ms)">
                  <el-input-number v-model="selectedStep.timeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" placeholder="默认" />
                </el-form-item>
                <el-form-item label="失败后继续">
                  <el-switch v-model="selectedStep.continueOnFailure" />
                </el-form-item>
                <el-form-item label="重试次数">
                  <el-input-number :model-value="0" :min="0" :max="5" controls-position="right" disabled />
                </el-form-item>
                <el-form-item label="截图策略">
                  <el-select v-model="selectedStep.screenshotPolicy">
                    <el-option v-for="item in WEB_UI_SCREENSHOT_POLICY_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                </el-form-item>
                <el-form-item label="启用步骤">
                  <el-switch v-model="selectedStep.enabled" />
                </el-form-item>
              </div>
            </section>
          </div>
        </section>
      </main>

      <aside class="web-ui-case-detail__inspector" aria-label="运行与录制">
        <section class="web-ui-case-detail__section">
          <h3>运行设置</h3>
          <div class="web-ui-run-settings">
            <el-form-item label="基础地址">
              <el-input v-model="form.baseUrl" placeholder="环境默认地址或完整 URL" clearable />
            </el-form-item>
            <el-form-item label="浏览器">
              <el-select v-model="form.browserType">
                <el-option v-for="item in WEB_UI_BROWSER_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="默认超时">
              <el-input-number v-model="form.defaultTimeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" />
            </el-form-item>
            <el-form-item label="运行模式">
              <el-switch v-model="form.headless" active-text="无头" inactive-text="有界面" />
            </el-form-item>
          </div>
        </section>

        <section class="web-ui-case-detail__section">
          <h3>录制控制台</h3>
          <div class="web-ui-recording-placeholder">
            <el-icon><VideoPlay /></el-icon>
            <strong>Local Runner 真实浏览器录制</strong>
            <p>后续点击开始录制后，由 Local Runner 在本机打开浏览器并实时回传操作步骤、截图和候选断言。</p>
            <AppButton :icon="VideoCamera" @click="showRecordingPlaceholder">预留入口</AppButton>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.web-ui-case-detail,
.web-ui-case-detail__body,
.web-ui-case-detail__editor,
.web-ui-case-detail__steps,
.web-ui-case-detail__inspector {
  min-width: 0;
  min-height: 0;
}

.web-ui-case-detail {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--app-space-4);
}

.web-ui-case-detail__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.web-ui-case-detail__title,
.web-ui-case-detail__actions,
.web-ui-case-detail__section-title,
.web-ui-case-detail__step-actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.web-ui-case-detail__title {
  min-width: 0;
}

.web-ui-case-detail__title h2,
.web-ui-case-detail__section h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-lg);
}

.web-ui-case-detail__title h2 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-case-detail__title p,
.web-ui-case-detail__section-title p,
.web-ui-case-detail__panel-header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-case-detail__actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.web-ui-case-detail__body {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(200px, 240px) minmax(360px, 1fr) minmax(240px, 280px);
  gap: var(--app-space-4);
}

.web-ui-case-detail__steps,
.web-ui-case-detail__inspector,
.web-ui-case-detail__section {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-case-detail__steps,
.web-ui-case-detail__inspector {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
}

.web-ui-case-detail__editor {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.web-ui-case-detail__section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
  padding: var(--app-space-4);
}

.web-ui-case-detail__section--step {
  flex: 1;
}

.web-ui-case-detail__section-title,
.web-ui-case-detail__panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-case-detail__panel-header :deep(.app-button) {
  flex-shrink: 0;
}

.web-ui-step-list {
  display: grid;
  gap: var(--app-space-2);
  overflow: auto;
}

.web-ui-step-list__item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: var(--app-space-2);
  align-items: center;
  width: 100%;
  padding: var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-main);
  cursor: pointer;
  text-align: left;
}

.web-ui-step-list__item:hover,
.web-ui-step-list__item.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.web-ui-step-list__item.is-disabled {
  opacity: 0.68;
}

.web-ui-step-list__order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.web-ui-step-list__content {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.web-ui-step-list__content strong,
.web-ui-step-list__content small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-step-list__content strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.web-ui-step-list__content small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-step-editor {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
}

.web-ui-step-config {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding-bottom: var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.web-ui-step-config:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.web-ui-step-config h4 {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
}

.web-ui-step-config h4::before {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--app-primary);
  content: '';
}

.web-ui-step-config__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-2) var(--app-space-4);
}

.web-ui-step-config :deep(.el-form-item) {
  display: block;
  margin-bottom: 0;
}

.web-ui-step-config :deep(.el-form-item__label) {
  display: flex;
  height: auto;
  justify-content: flex-start;
  margin-bottom: var(--app-space-1);
  color: var(--app-text-secondary);
  line-height: var(--app-line-height-xs);
}

.web-ui-step-config :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.web-ui-step-config :deep(.el-select),
.web-ui-step-config :deep(.el-input-number) {
  width: 100%;
}

.web-ui-step-config__action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-step-config__action-row span {
  color: var(--app-text-primary);
  font-weight: 500;
}

.web-ui-step-config__action-row small {
  color: var(--app-text-muted);
  line-height: var(--app-line-height-sm);
}

.web-ui-locator-radio {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2) var(--app-space-4);
}

.web-ui-locator-radio :deep(.el-radio) {
  margin-right: 0;
}

.web-ui-run-settings {
  display: grid;
  gap: var(--app-space-1);
}

.web-ui-run-settings :deep(.el-form-item) {
  display: block;
  margin-bottom: var(--app-space-2);
}

.web-ui-run-settings :deep(.el-form-item__label) {
  display: flex;
  height: auto;
  justify-content: flex-start;
  margin-bottom: var(--app-space-1);
  color: var(--app-text-secondary);
  line-height: var(--app-line-height-xs);
}

.web-ui-run-settings :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.web-ui-run-settings :deep(.el-select),
.web-ui-run-settings :deep(.el-input-number) {
  width: 100%;
}

.web-ui-recording-placeholder {
  display: grid;
  justify-items: start;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-recording-placeholder .el-icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: var(--app-radius-md);
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-size: 18px;
}

.web-ui-recording-placeholder strong {
  color: var(--app-text-primary);
}

.web-ui-recording-placeholder p {
  margin: 0;
  line-height: var(--app-line-height-md);
}

@media (max-width: 1100px) {
  .web-ui-case-detail__body {
    grid-template-columns: 240px minmax(0, 1fr);
  }

  .web-ui-case-detail__inspector {
    grid-column: 1 / -1;
  }
}

@media (max-width: 900px) {
  .web-ui-case-detail__toolbar,
  .web-ui-case-detail__title {
    align-items: stretch;
    flex-direction: column;
  }

  .web-ui-case-detail__actions {
    justify-content: flex-start;
  }

  .web-ui-case-detail__body,
  .web-ui-step-config__grid {
    grid-template-columns: 1fr;
  }
}
</style>

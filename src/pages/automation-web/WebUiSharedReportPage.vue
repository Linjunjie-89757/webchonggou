<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  formatBrowserType,
  formatDurationMs,
  formatWebUiDateTime,
  webUiAutomationApi,
  WebUiRunStatusBadge,
  type WebUiRunStepResult,
  type WebUiSharedReport,
} from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const route = useRoute()

const loading = ref(false)
const errorMessage = ref('')
const report = ref<WebUiSharedReport | null>(null)
let requestSeq = 0

const token = computed(() => {
  const value = route.query.token
  return Array.isArray(value) ? value[0] || '' : value || ''
})

const runDetail = computed(() => report.value?.run ?? null)
const batchDetail = computed(() => report.value?.batch ?? null)
const failedSteps = computed(() => runDetail.value?.steps.filter(step => step.status === 'FAILED') ?? [])
const contextVariables = computed(() => Object.entries(runDetail.value?.context?.variables ?? {}))
const batchSuccessRate = computed(() => {
  const summary = batchDetail.value?.summary
  if (!summary || summary.totalCases <= 0) {
    return '0%'
  }
  return `${Math.round((summary.successCases / summary.totalCases) * 100)}%`
})

function formatStepLocator(row: WebUiRunStepResult) {
  if (!row.locatorType) {
    return '-'
  }
  return `${row.locatorType}: ${row.locatorValue || '-'}`
}

function formatStepInput(row: WebUiRunStepResult) {
  return row.inputValueSnapshot || '-'
}

async function copyCurrentUrl() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    ElMessage.success('公开报告链接已复制')
  } catch {
    ElMessage.warning('当前浏览器不允许自动复制，请手动复制地址栏链接')
  }
}

async function loadSharedReport() {
  const currentToken = token.value
  const requestId = ++requestSeq
  if (!currentToken) {
    report.value = null
    errorMessage.value = '公开报告链接缺少 token'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const result = await webUiAutomationApi.getSharedReport(currentToken)
    if (requestId === requestSeq && token.value === currentToken) {
      report.value = result
    }
  } catch (error) {
    if (requestId === requestSeq && token.value === currentToken) {
      report.value = null
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestId === requestSeq && token.value === currentToken) {
      loading.value = false
    }
  }
}

watch(token, () => {
  void loadSharedReport()
}, { immediate: true })
</script>

<template>
  <main class="web-ui-shared-report">
    <header class="web-ui-shared-report__header">
      <div>
        <span>Web UI 自动化公开报告</span>
        <h1>{{ runDetail?.summary.caseName || batchDetail?.summary.batchName || '报告分享' }}</h1>
        <p>
          {{ report?.expiresAt ? `有效期至 ${formatWebUiDateTime(report.expiresAt)}` : '永久有效' }}
        </p>
      </div>
      <AppButton :icon="CopyDocument" @click="copyCurrentUrl">复制链接</AppButton>
    </header>

    <AppLoadingState v-if="loading" text="正在加载公开报告..." />
    <AppEmptyState
      v-else-if="errorMessage"
      title="公开报告不可访问"
      :description="errorMessage"
    />

    <template v-else-if="runDetail">
      <section class="web-ui-shared-summary">
        <div>
          <span>结果</span>
          <WebUiRunStatusBadge :status="runDetail.summary.status" />
        </div>
        <div>
          <span>浏览器</span>
          <strong>{{ formatBrowserType(runDetail.summary.browserType) }}</strong>
        </div>
        <div>
          <span>耗时</span>
          <strong>{{ formatDurationMs(runDetail.summary.durationMs) }}</strong>
        </div>
        <div>
          <span>步骤</span>
          <strong>{{ runDetail.summary.passedSteps }} 通过 / {{ runDetail.summary.failedSteps }} 失败 / {{ runDetail.summary.skippedSteps }} 跳过</strong>
        </div>
      </section>

      <section class="web-ui-shared-panel">
        <header>
          <strong>执行上下文</strong>
          <span>变量来自执行快照，敏感值已脱敏</span>
        </header>
        <dl>
          <div>
            <dt>Base URL</dt>
            <dd>{{ runDetail.context?.environment?.baseUrl || runDetail.summary.baseUrl || '-' }}</dd>
          </div>
          <div>
            <dt>环境</dt>
            <dd>{{ runDetail.context?.environment?.name || runDetail.summary.environmentName || '-' }}</dd>
          </div>
          <div>
            <dt>变量集</dt>
            <dd>{{ runDetail.context?.variableSetName || '-' }}</dd>
          </div>
          <div>
            <dt>开始时间</dt>
            <dd>{{ formatWebUiDateTime(runDetail.summary.startedAt) }}</dd>
          </div>
        </dl>
        <div v-if="contextVariables.length" class="web-ui-shared-vars">
          <span v-for="[name, value] in contextVariables" :key="name">{{ name }}={{ value || '空值' }}</span>
        </div>
      </section>

      <section v-if="failedSteps.length" class="web-ui-shared-panel web-ui-shared-panel--danger">
        <header>
          <strong>失败证据</strong>
          <span>{{ failedSteps.length }} 个失败步骤</span>
        </header>
        <article v-for="step in failedSteps" :key="step.id" class="web-ui-shared-failure">
          <strong>第 {{ step.sortOrder }} 步：{{ step.stepName }}</strong>
          <span>{{ step.errorMessage || '-' }}</span>
          <el-link v-if="step.screenshotUrl" type="primary" :href="step.screenshotUrl" target="_blank">打开截图</el-link>
        </article>
      </section>

      <section class="web-ui-shared-panel">
        <header>
          <strong>步骤明细</strong>
          <span>{{ runDetail.steps.length }} 步</span>
        </header>
        <el-table :data="runDetail.steps" border row-key="id" empty-text="暂无步骤结果">
          <el-table-column label="#" width="64" align="center" prop="sortOrder" />
          <el-table-column label="状态" width="96">
            <template #default="{ row }">
              <WebUiRunStatusBadge :status="row.status" step />
            </template>
          </el-table-column>
          <el-table-column prop="stepName" label="步骤名称" min-width="180" show-overflow-tooltip />
          <el-table-column label="定位器" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">{{ formatStepLocator(row) }}</template>
          </el-table-column>
          <el-table-column label="输入/目标" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ formatStepInput(row) }}</template>
          </el-table-column>
          <el-table-column prop="errorMessage" label="错误信息" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">{{ row.errorMessage || '-' }}</template>
          </el-table-column>
          <el-table-column label="证据" width="96">
            <template #default="{ row }">
              <el-link v-if="row.screenshotUrl" type="primary" :href="row.screenshotUrl" target="_blank">截图</el-link>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </template>

    <template v-else-if="batchDetail">
      <section class="web-ui-shared-summary">
        <div>
          <span>结果</span>
          <WebUiRunStatusBadge :status="batchDetail.summary.status" />
        </div>
        <div>
          <span>成功率</span>
          <strong>{{ batchSuccessRate }}</strong>
        </div>
        <div>
          <span>用例结果</span>
          <strong>{{ batchDetail.summary.successCases }} 成功 / {{ batchDetail.summary.failedCases }} 失败 / {{ batchDetail.summary.totalCases }} 总数</strong>
        </div>
        <div>
          <span>耗时</span>
          <strong>{{ formatDurationMs(batchDetail.summary.durationMs) }}</strong>
        </div>
      </section>

      <section class="web-ui-shared-panel">
        <header>
          <strong>批次运行列表</strong>
          <span>{{ batchDetail.runs.length }} 条运行记录</span>
        </header>
        <el-table :data="batchDetail.runs" border row-key="id" empty-text="暂无运行记录">
          <el-table-column prop="caseName" label="用例名称" min-width="220" show-overflow-tooltip />
          <el-table-column label="结果" width="96">
            <template #default="{ row }">
              <WebUiRunStatusBadge :status="row.status" />
            </template>
          </el-table-column>
          <el-table-column label="步骤" width="150">
            <template #default="{ row }">{{ row.passedSteps }} / {{ row.failedSteps }} / {{ row.skippedSteps }}</template>
          </el-table-column>
          <el-table-column label="耗时" width="120">
            <template #default="{ row }">{{ formatDurationMs(row.durationMs) }}</template>
          </el-table-column>
          <el-table-column prop="failureSummary" label="失败摘要" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">{{ row.failureSummary || '-' }}</template>
          </el-table-column>
        </el-table>
      </section>
    </template>
  </main>
</template>

<style scoped>
.web-ui-shared-report {
  min-height: 100vh;
  padding: 32px;
  background: #f5f7fb;
  color: var(--app-text-primary);
}

.web-ui-shared-report__header {
  display: flex;
  max-width: 1180px;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
  margin: 0 auto var(--app-space-5);
}

.web-ui-shared-report__header div {
  display: grid;
  gap: var(--app-space-2);
}

.web-ui-shared-report__header span,
.web-ui-shared-report__header p {
  margin: 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-shared-report__header h1 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 24px;
  font-weight: 700;
}

.web-ui-shared-summary,
.web-ui-shared-panel {
  max-width: 1180px;
  margin: 0 auto var(--app-space-4);
}

.web-ui-shared-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.web-ui-shared-summary > div,
.web-ui-shared-panel {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-shared-summary > div {
  display: grid;
  gap: var(--app-space-1);
  padding: var(--app-space-3);
}

.web-ui-shared-summary span,
.web-ui-shared-panel header span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-shared-summary strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.web-ui-shared-panel {
  display: grid;
  gap: var(--app-space-3);
  padding: var(--app-space-4);
}

.web-ui-shared-panel--danger {
  border-color: #fecaca;
  background: #fff7f7;
}

.web-ui-shared-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-shared-panel dl {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-3);
  margin: 0;
}

.web-ui-shared-panel dt {
  margin-bottom: var(--app-space-1);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-shared-panel dd {
  overflow-wrap: anywhere;
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.web-ui-shared-vars {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.web-ui-shared-vars span {
  overflow-wrap: anywhere;
  padding: 2px var(--app-space-2);
  border: 1px solid #bfdbfe;
  border-radius: var(--app-radius-sm);
  background: #eff6ff;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
}

.web-ui-shared-failure {
  display: grid;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-shared-failure span {
  overflow-wrap: anywhere;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 900px) {
  .web-ui-shared-report {
    padding: 20px;
  }

  .web-ui-shared-report__header {
    flex-direction: column;
  }

  .web-ui-shared-summary,
  .web-ui-shared-panel dl {
    grid-template-columns: 1fr;
  }
}
</style>

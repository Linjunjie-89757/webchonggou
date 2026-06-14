<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Edit, Filter, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  CaseExecutionStatusBadge,
  CasePriorityBadge,
  CaseReviewStatusBadge,
  caseApi,
  caseExecutionStatusOptions,
  formatCaseDateTime,
  getCaseDirectoryText,
  loadCaseExecutionContext,
  type CaseDetail,
  type CaseExecutionContext,
  type CaseSummaryItem,
  type RunCasePayload,
} from '@/entities/case'
import {
  DefectPriorityBadge,
  DefectSeverityBadge,
  DefectStatusBadge,
  defectApi,
  formatDefectDateTime,
  type DefectSummaryItem,
} from '@/entities/defect'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')
const detail = ref<CaseDetail | null>(null)
const contextState = ref<CaseExecutionContext | null>(null)
const executionCases = ref<CaseSummaryItem[]>([])
const activeTab = ref('detail')
const sidebarKeyword = ref('')
const sidebarExecutionStatus = ref('')
const actualResult = ref('')
const executionNote = ref('')
const autoNext = ref(true)
const submittingStatus = ref('')
const relatedDefects = ref<DefectSummaryItem[]>([])
const defectsLoading = ref(false)
const defectsErrorMessage = ref('')
let detailRequestSeq = 0
let defectsRequestSeq = 0

const currentCaseId = computed(() => {
  const rawId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  const parsed = Number(rawId)
  return Number.isFinite(parsed) ? parsed : null
})

const routeWorkspaceCode = computed(() => {
  const workspace = Array.isArray(route.query.workspace) ? route.query.workspace[0] : route.query.workspace
  return workspace || 'ALL'
})

const effectiveWorkspaceCode = computed(() => detail.value?.workspaceCode || contextState.value?.workspaceCode || routeWorkspaceCode.value)

const sidebarStatusOptions = computed(() => [
  { label: '全部状态', value: '' },
  ...caseExecutionStatusOptions,
])

const visibleExecutionCases = computed(() => {
  const keyword = sidebarKeyword.value.trim().toLowerCase()
  return executionCases.value.filter((item) => {
    const matchesKeyword = !keyword
      || item.caseNo.toLowerCase().includes(keyword)
      || item.title.toLowerCase().includes(keyword)
    const matchesStatus = !sidebarExecutionStatus.value || item.executionStatus === sidebarExecutionStatus.value
    return matchesKeyword && matchesStatus
  })
})

const currentVisibleIndex = computed(() => visibleExecutionCases.value.findIndex(item => item.id === currentCaseId.value))
const activeCaseDisplayIndex = computed(() => (currentVisibleIndex.value >= 0 ? currentVisibleIndex.value + 1 : 0))
const canMovePrevious = computed(() => currentVisibleIndex.value > 0)
const canMoveNext = computed(() => currentVisibleIndex.value >= 0 && currentVisibleIndex.value < visibleExecutionCases.value.length - 1)

const pageTitle = computed(() => {
  if (!detail.value) {
    return '用例执行'
  }
  return `[${detail.value.caseNo}] ${detail.value.title}`
})

const modulePath = computed(() => {
  if (!detail.value) {
    return '-'
  }
  const segments = [detail.value.workspaceName || detail.value.workspaceCode]
  const directory = getCaseDirectoryText(detail.value)
  if (directory && directory !== '空间根目录') {
    segments.push(directory)
  }
  return segments.join(' / ')
})

const historyRows = computed(() => {
  if (!detail.value?.executedAt && !detail.value?.executorName && !detail.value?.executionComment && !detail.value?.executionNote) {
    return []
  }

  return [{
    status: detail.value.executionStatus || 'NOT_RUN',
    executorName: detail.value.executorName || '-',
    executedAt: formatCaseDateTime(detail.value.executedAt),
    comment: detail.value.executionComment || detail.value.executionNote || '-',
  }]
})

function displayText(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

function syncExecutionInputs(row: CaseDetail) {
  actualResult.value = row.executionComment || ''
  executionNote.value = row.executionNote || ''
}

function updateExecutionCollection(row: CaseDetail) {
  const summary = row as CaseSummaryItem
  const index = executionCases.value.findIndex(item => item.id === row.id)
  if (index >= 0) {
    executionCases.value = executionCases.value.map(item => (item.id === row.id ? { ...item, ...summary } : item))
    return
  }
  executionCases.value = [summary]
}

function buildFallbackQueue(row: CaseDetail) {
  if (executionCases.value.length) {
    return
  }
  executionCases.value = [row as CaseSummaryItem]
}

async function loadRelatedDefects(row: CaseDetail) {
  const requestSeq = ++defectsRequestSeq
  defectsLoading.value = true
  defectsErrorMessage.value = ''
  try {
    const page = await defectApi.getDefects(row.workspaceCode || effectiveWorkspaceCode.value, {
      pageNo: 1,
      pageSize: 100,
    })
    if (requestSeq === defectsRequestSeq) {
      relatedDefects.value = page.items.filter(item => item.relatedCaseId === row.id)
    }
  } catch (error) {
    if (requestSeq === defectsRequestSeq) {
      defectsErrorMessage.value = getRequestErrorMessage(error)
      relatedDefects.value = []
    }
  } finally {
    if (requestSeq === defectsRequestSeq) {
      defectsLoading.value = false
    }
  }
}

async function loadCaseDetail(caseId: number) {
  const requestSeq = ++detailRequestSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const row = await caseApi.getCaseDetail(caseId, effectiveWorkspaceCode.value)
    if (requestSeq !== detailRequestSeq) {
      return
    }
    detail.value = row
    syncExecutionInputs(row)
    updateExecutionCollection(row)
    buildFallbackQueue(row)
    void loadRelatedDefects(row)
  } catch (error) {
    if (requestSeq === detailRequestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === detailRequestSeq) {
      loading.value = false
    }
  }
}

function bootstrapContext() {
  const savedContext = loadCaseExecutionContext()
  if (savedContext && savedContext.items.some(item => item.id === currentCaseId.value)) {
    contextState.value = savedContext
    executionCases.value = savedContext.items
  }
}

function navigateToCase(caseId: number) {
  if (caseId === currentCaseId.value) {
    return
  }
  void router.replace({
    name: 'case-execution',
    params: { id: caseId },
    query: {
      ...route.query,
      workspace: effectiveWorkspaceCode.value,
    },
  })
}

function moveCase(offset: -1 | 1) {
  const nextRow = visibleExecutionCases.value[currentVisibleIndex.value + offset]
  if (nextRow) {
    navigateToCase(nextRow.id)
  }
}

function goBackToCaseManagement() {
  const query = contextState.value?.returnQuery
  void router.push({
    name: 'cases',
    query: query && Object.keys(query).length ? query : { workspace: effectiveWorkspaceCode.value },
  })
}

function openCaseEdit() {
  if (!detail.value) {
    return
  }
  void router.push({
    name: 'cases',
    query: {
      workspace: detail.value.workspaceCode || effectiveWorkspaceCode.value,
    },
  })
  ElMessage.info('请回到用例管理列表中编辑当前用例')
}

function handleAddDefect() {
  activeTab.value = 'bugs'
  ElMessage.info('执行页新增/关联缺陷将在后续目标包接入')
}

async function submitExecution(status: string) {
  if (!detail.value || !currentCaseId.value || submittingStatus.value) {
    return
  }

  submittingStatus.value = status
  try {
    const payload: RunCasePayload = {
      executionStatus: status,
      executionComment: actualResult.value.trim(),
      executionNote: executionNote.value.trim(),
    }
    const row = await caseApi.runCase(currentCaseId.value, effectiveWorkspaceCode.value, payload)
    detail.value = row
    syncExecutionInputs(row)
    updateExecutionCollection(row)
    ElMessage.success('执行结果已更新')
    if (autoNext.value && canMoveNext.value) {
      moveCase(1)
      return
    }
    if (autoNext.value && !canMoveNext.value) {
      ElMessage.info('已经是最后一条用例')
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    submittingStatus.value = ''
  }
}

watch(
  currentCaseId,
  (caseId) => {
    if (caseId !== null) {
      void loadCaseDetail(caseId)
    }
  },
)

watch(
  visibleExecutionCases,
  (rows) => {
    if (!rows.length || currentVisibleIndex.value >= 0 || !rows[0]) {
      return
    }
    navigateToCase(rows[0].id)
  },
)

onMounted(() => {
  bootstrapContext()
  if (currentCaseId.value !== null) {
    void loadCaseDetail(currentCaseId.value)
  }
})
</script>

<template>
  <section class="case-execution-page">
    <aside class="case-execution-page__sidebar">
      <header class="case-execution-page__sidebar-header">
        <div class="case-execution-page__source">
          <span>执行队列</span>
          <strong>{{ contextState?.sourceLabel || '当前用例' }}</strong>
        </div>
        <div class="case-execution-page__sidebar-tools">
          <el-input
            v-model="sidebarKeyword"
            clearable
            size="small"
            placeholder="搜索编号或名称"
            :prefix-icon="Search"
          />
          <el-select
            v-model="sidebarExecutionStatus"
            size="small"
            class="case-execution-page__status-select"
            placeholder="状态"
          >
            <el-option
              v-for="item in sidebarStatusOptions"
              :key="item.value || 'ALL'"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-icon class="case-execution-page__filter-icon"><Filter /></el-icon>
        </div>
      </header>

      <div class="case-execution-page__queue">
        <button
          v-for="item in visibleExecutionCases"
          :key="item.id"
          type="button"
          class="case-execution-page__queue-item"
          :class="{ 'is-active': item.id === currentCaseId }"
          @click="navigateToCase(item.id)"
        >
          <div class="case-execution-page__queue-top">
            <span>{{ item.caseNo }}</span>
            <CaseExecutionStatusBadge :status="item.executionStatus || 'NOT_RUN'" />
          </div>
          <p>{{ item.title }}</p>
        </button>
        <AppEmptyState
          v-if="!visibleExecutionCases.length"
          title="暂无匹配用例"
          description="调整搜索或状态筛选后再查看。"
        />
      </div>

      <footer class="case-execution-page__sidebar-footer">
        <span>共 {{ executionCases.length }} 条</span>
        <span>{{ activeCaseDisplayIndex }}/{{ visibleExecutionCases.length || 0 }}</span>
      </footer>
    </aside>

    <main class="case-execution-page__main">
      <div class="case-execution-page__backbar">
        <el-button text :icon="ArrowLeft" @click="goBackToCaseManagement">返回用例管理</el-button>
      </div>

      <AppLoadingState v-if="loading && !detail" text="正在加载执行用例..." />

      <AppEmptyState v-else-if="errorMessage && !detail" title="执行用例加载失败" :description="errorMessage">
        <template #actions>
          <AppButton @click="currentCaseId !== null && loadCaseDetail(currentCaseId)">重试</AppButton>
        </template>
      </AppEmptyState>

      <template v-else-if="detail">
        <header class="case-execution-page__header">
          <div class="case-execution-page__title-block">
            <CaseExecutionStatusBadge :status="detail.executionStatus || 'NOT_RUN'" />
            <h1>{{ pageTitle }}</h1>
          </div>
          <AppButton :icon="Edit" @click="openCaseEdit">编辑</AppButton>
        </header>

        <div v-if="errorMessage" class="case-execution-page__inline-error">
          {{ errorMessage }}
          <AppButton size="small" @click="loadCaseDetail(detail.id)">重试</AppButton>
        </div>

        <section class="case-execution-page__body">
          <el-tabs v-model="activeTab" class="case-execution-page__tabs">
            <el-tab-pane label="基本信息" name="basic">
              <div class="case-execution-page__meta-grid">
                <section class="case-execution-page__meta-item">
                  <span>所属模块</span>
                  <strong>{{ modulePath }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>优先级</span>
                  <strong><CasePriorityBadge :priority="detail.priority" /></strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>用例来源</span>
                  <strong>{{ displayText(detail.sourceType) }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>评审状态</span>
                  <strong><CaseReviewStatusBadge :status="detail.reviewStatus" /></strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>评审人</span>
                  <strong>{{ displayText(detail.reviewedByName) }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>评审时间</span>
                  <strong>{{ formatCaseDateTime(detail.reviewedAt) }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>执行人</span>
                  <strong>{{ displayText(detail.executorName) }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>执行时间</span>
                  <strong>{{ formatCaseDateTime(detail.executedAt) }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>创建人</span>
                  <strong>{{ displayText(detail.createdByName) }}</strong>
                </section>
                <section class="case-execution-page__meta-item">
                  <span>更新时间</span>
                  <strong>{{ formatCaseDateTime(detail.updatedAt) }}</strong>
                </section>
              </div>
            </el-tab-pane>

            <el-tab-pane label="详情" name="detail">
              <div class="case-execution-page__detail-stack">
                <div class="case-execution-page__detail-row">
                  <section class="case-execution-page__detail-column">
                    <span>前置条件</span>
                    <div>{{ displayText(detail.precondition) }}</div>
                  </section>
                  <section class="case-execution-page__detail-column">
                    <span>测试步骤</span>
                    <div>{{ displayText(detail.steps) }}</div>
                  </section>
                  <section class="case-execution-page__detail-column">
                    <span>预期结果</span>
                    <div>{{ displayText(detail.expectedResult) }}</div>
                  </section>
                  <section class="case-execution-page__detail-column">
                    <span>实际结果</span>
                    <el-input
                      v-model="actualResult"
                      type="textarea"
                      :rows="8"
                      resize="vertical"
                      placeholder="请输入实际结果"
                    />
                  </section>
                </div>
                <section class="case-execution-page__note">
                  <span>备注</span>
                  <el-input
                    v-model="executionNote"
                    type="textarea"
                    :rows="4"
                    resize="none"
                    placeholder="请输入备注"
                  />
                </section>
              </div>
            </el-tab-pane>

            <el-tab-pane :label="`缺陷列表（${relatedDefects.length}）`" name="bugs">
              <section class="case-execution-page__bugs" v-loading="defectsLoading">
                <div v-if="defectsErrorMessage" class="case-execution-page__inline-error">
                  {{ defectsErrorMessage }}
                  <AppButton size="small" @click="loadRelatedDefects(detail)">重试</AppButton>
                </div>
                <div v-if="relatedDefects.length" class="case-execution-page__bug-table">
                  <div class="case-execution-page__bug-header">
                    <span>缺陷编号</span>
                    <span>标题</span>
                    <span>优先级</span>
                    <span>严重级别</span>
                    <span>状态</span>
                    <span>处理人</span>
                    <span>更新时间</span>
                  </div>
                  <div
                    v-for="item in relatedDefects"
                    :key="item.id"
                    class="case-execution-page__bug-row"
                  >
                    <span class="case-execution-page__bug-code">{{ item.bugNo }}</span>
                    <span class="case-execution-page__bug-title">{{ item.title }}</span>
                    <span><DefectPriorityBadge :priority="item.priority" /></span>
                    <span><DefectSeverityBadge :severity="item.severity" /></span>
                    <span><DefectStatusBadge :status="item.status" /></span>
                    <span>{{ item.assigneeName || '-' }}</span>
                    <span>{{ formatDefectDateTime(item.updatedAt) }}</span>
                  </div>
                </div>
                <AppEmptyState
                  v-else-if="!defectsLoading && !defectsErrorMessage"
                  title="暂无关联缺陷"
                  description="新增和关联缺陷会在后续目标包接入。"
                />
              </section>
            </el-tab-pane>

            <el-tab-pane label="执行历史" name="history">
              <section class="case-execution-page__history">
                <div v-if="historyRows.length" class="case-execution-page__history-list">
                  <article
                    v-for="item in historyRows"
                    :key="`${item.status}-${item.executedAt}`"
                    class="case-execution-page__history-item"
                  >
                    <div>
                      <CaseExecutionStatusBadge :status="item.status" />
                      <span>{{ item.executedAt }}</span>
                    </div>
                    <p>执行人：{{ item.executorName }}</p>
                    <p>{{ item.comment }}</p>
                  </article>
                </div>
                <AppEmptyState
                  v-else
                  title="暂无执行历史"
                  description="当前接口未返回完整历史列表，先展示最近一次执行信息。"
                />
              </section>
            </el-tab-pane>
          </el-tabs>
        </section>

        <footer class="case-execution-page__footer">
          <div class="case-execution-page__footer-nav">
            <AppButton :disabled="!canMovePrevious" @click="moveCase(-1)">
              <el-icon><ArrowLeft /></el-icon>
              上一条
            </AppButton>
            <span>{{ activeCaseDisplayIndex }}/{{ visibleExecutionCases.length || 0 }}</span>
            <AppButton :disabled="!canMoveNext" @click="moveCase(1)">
              下一条
              <el-icon><ArrowRight /></el-icon>
            </AppButton>
            <label class="case-execution-page__auto-next">
              <span>自动下一条</span>
              <el-switch v-model="autoNext" />
            </label>
          </div>
          <div class="case-execution-page__footer-actions">
            <AppButton @click="handleAddDefect">添加缺陷</AppButton>
            <AppButton
              type="danger"
              plain
              :loading="submittingStatus === 'FAILED'"
              @click="submitExecution('FAILED')"
            >
              失败
            </AppButton>
            <AppButton
              type="primary"
              plain
              :loading="submittingStatus === 'BLOCKED'"
              @click="submitExecution('BLOCKED')"
            >
              阻塞
            </AppButton>
            <AppButton
              type="success"
              :loading="submittingStatus === 'PASSED'"
              @click="submitExecution('PASSED')"
            >
              通过
            </AppButton>
          </div>
        </footer>
      </template>
    </main>
  </section>
</template>

<style scoped>
.case-execution-page {
  display: grid;
  min-height: calc(100dvh - 64px - var(--app-space-6) * 2);
  grid-template-columns: 284px minmax(0, 1fr);
  gap: var(--app-space-4);
}

.case-execution-page__sidebar,
.case-execution-page__main {
  min-height: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
}

.case-execution-page__sidebar {
  display: flex;
  overflow: hidden;
  flex-direction: column;
}

.case-execution-page__sidebar-header {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.case-execution-page__source {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-1);
}

.case-execution-page__source span,
.case-execution-page__detail-column > span,
.case-execution-page__note > span,
.case-execution-page__meta-item span {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.case-execution-page__source strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
}

.case-execution-page__sidebar-tools {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px 24px;
  align-items: center;
  gap: var(--app-space-2);
}

.case-execution-page__filter-icon {
  color: var(--app-text-subtle);
}

.case-execution-page__queue {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--app-space-2);
  overflow: auto;
  padding: var(--app-space-3);
}

.case-execution-page__queue-item {
  width: 100%;
  border: 1px solid transparent;
  border-radius: var(--app-radius-md);
  background: transparent;
  cursor: pointer;
  padding: var(--app-space-3);
  text-align: left;
}

.case-execution-page__queue-item:hover {
  background: var(--app-bg-subtle);
}

.case-execution-page__queue-item.is-active {
  border-color: #bfdbfe;
  background: var(--app-primary-soft);
}

.case-execution-page__queue-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
}

.case-execution-page__queue-top > span {
  color: var(--app-primary);
  font-size: var(--app-font-size-xs);
}

.case-execution-page__queue-item p {
  margin: var(--app-space-2) 0 0;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
}

.case-execution-page__sidebar-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--app-space-3) var(--app-space-4);
  border-top: 1px solid var(--app-border-soft);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.case-execution-page__main {
  display: flex;
  overflow: hidden;
  flex-direction: column;
}

.case-execution-page__backbar {
  padding: var(--app-space-3) var(--app-space-4) 0;
}

.case-execution-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  padding: var(--app-space-3) var(--app-space-5) var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.case-execution-page__title-block {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-3);
}

.case-execution-page__title-block h1 {
  overflow: hidden;
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
  line-height: 28px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-execution-page__body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 0 var(--app-space-5) calc(76px + var(--app-space-5));
}

.case-execution-page__tabs :deep(.el-tabs__header) {
  margin-bottom: var(--app-space-4);
}

.case-execution-page__meta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.case-execution-page__meta-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.case-execution-page__meta-item strong {
  min-height: 24px;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 22px;
  overflow-wrap: anywhere;
}

.case-execution-page__detail-stack {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.case-execution-page__detail-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.case-execution-page__detail-column,
.case-execution-page__note,
.case-execution-page__bugs,
.case-execution-page__history {
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.case-execution-page__detail-column,
.case-execution-page__note {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
}

.case-execution-page__detail-column > div {
  min-height: 172px;
  overflow: auto;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.case-execution-page__bugs,
.case-execution-page__history {
  min-height: 280px;
  padding: var(--app-space-4);
}

.case-execution-page__bug-table {
  overflow: auto;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.case-execution-page__bug-header,
.case-execution-page__bug-row {
  display: grid;
  min-width: 980px;
  grid-template-columns: 148px minmax(260px, 1fr) 92px 108px 120px 120px 148px;
  align-items: center;
  gap: var(--app-space-3);
  padding: 0 var(--app-space-4);
}

.case-execution-page__bug-header {
  min-height: 44px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.case-execution-page__bug-row {
  min-height: 52px;
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
}

.case-execution-page__bug-row:last-child {
  border-bottom: 0;
}

.case-execution-page__bug-code {
  color: var(--app-primary);
}

.case-execution-page__bug-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-execution-page__history-list {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.case-execution-page__history-item {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.case-execution-page__history-item > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.case-execution-page__history-item p {
  margin: 0;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
}

.case-execution-page__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  min-height: 72px;
  padding: var(--app-space-3) var(--app-space-5);
  border-top: 1px solid var(--app-border);
  background: rgba(255, 255, 255, 0.96);
}

.case-execution-page__footer-nav,
.case-execution-page__footer-actions,
.case-execution-page__auto-next {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.case-execution-page__footer-nav > span {
  min-width: 48px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  text-align: center;
}

.case-execution-page__auto-next {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.case-execution-page__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin: var(--app-space-3) var(--app-space-5);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 1180px) {
  .case-execution-page {
    grid-template-columns: 240px minmax(0, 1fr);
  }

  .case-execution-page__detail-row,
  .case-execution-page__meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .case-execution-page {
    grid-template-columns: 1fr;
  }

  .case-execution-page__sidebar {
    min-height: 320px;
  }

  .case-execution-page__footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

<script setup lang="ts">
import { ArrowLeft, Download, Edit } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  DefectPriorityBadge,
  DefectSeverityBadge,
  DefectStatusBadge,
  defectApi,
  formatDefectDateTime,
  formatDefectTags,
  type DefectAttachment,
  type DefectComment,
  type DefectDetail,
} from '@/entities/defect'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

type DetailTab = 'detail' | 'basic' | 'case' | 'comment' | 'attachment' | 'history'
type DefectActivityRecord = Record<string, unknown>
type DefectCaseSummary = {
  id?: number | null
  caseNo?: string | null
  title?: string | null
  workspaceName?: string | null
  caseType?: string | null
}

const route = useRoute()
const router = useRouter()

const detail = ref<DefectDetail | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const activeTab = ref<DetailTab>('detail')
const attachmentDownloadingId = ref<number | null>(null)

const tabs: Array<{ key: DetailTab; label: string }> = [
  { key: 'detail', label: '详情' },
  { key: 'basic', label: '基础' },
  { key: 'case', label: '用例' },
  { key: 'comment', label: '评论' },
  { key: 'attachment', label: '附件' },
  { key: 'history', label: '历史' },
]

const defectId = computed(() => {
  const rawId = route.params.id
  const id = Array.isArray(rawId) ? Number(rawId[0]) : Number(rawId)
  return Number.isFinite(id) ? id : null
})

const workspaceCode = computed(() => {
  const rawWorkspace = route.query.workspace
  const code = Array.isArray(rawWorkspace) ? rawWorkspace[0] : rawWorkspace
  return code || detail.value?.workspaceCode || 'ALL'
})

const attachmentCount = computed(() => getAttachments(detail.value).length)
const commentCount = computed(() => (Array.isArray(detail.value?.comments) ? detail.value.comments.length : 0))
const activityCount = computed(() => (Array.isArray(detail.value?.activities) ? detail.value.activities.length : 0))
const caseRows = computed(() => getCaseRows(detail.value))

function normalizeTab(value: unknown): DetailTab {
  const tab = Array.isArray(value) ? value[0] : value
  return tabs.some(item => item.key === tab) ? tab as DetailTab : 'detail'
}

function displayText(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

function displayRichText(value: string | null | undefined) {
  const text = displayText(value)
  if (text === '-' || !/[<>]/.test(text)) {
    return text
  }

  const normalized = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')

  if (typeof DOMParser === 'undefined') {
    return normalized.replace(/<[^>]+>/g, '').trim() || '-'
  }

  const doc = new DOMParser().parseFromString(normalized, 'text/html')
  return doc.body.textContent?.trim() || '-'
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function getCaseRows(value: DefectDetail | null): DefectCaseSummary[] {
  if (!value) {
    return []
  }

  const context = readRecord(value.sourceContext)
  const caseSummary = readRecord(context?.caseSummary)
  if (caseSummary) {
    return [{
      id: typeof caseSummary.id === 'number' ? caseSummary.id : value.relatedCaseId,
      caseNo: typeof caseSummary.caseNo === 'string' ? caseSummary.caseNo : null,
      title: typeof caseSummary.title === 'string' ? caseSummary.title : null,
      workspaceName: typeof caseSummary.workspaceName === 'string' ? caseSummary.workspaceName : value.workspaceName,
      caseType: typeof caseSummary.caseType === 'string' ? caseSummary.caseType : null,
    }]
  }

  if (value.relatedCaseId) {
    return [{
      id: value.relatedCaseId,
      caseNo: `#${value.relatedCaseId}`,
      title: null,
      workspaceName: value.workspaceName,
      caseType: null,
    }]
  }

  return []
}

function getAttachments(value: DefectDetail | null): DefectAttachment[] {
  return Array.isArray(value?.attachments) ? value.attachments : []
}

function getActivities(value: DefectDetail | null): DefectActivityRecord[] {
  return Array.isArray(value?.activities) ? value.activities as DefectActivityRecord[] : []
}

function getComments(value: DefectDetail | null): DefectComment[] {
  return Array.isArray(value?.comments) ? value.comments : []
}

function formatFileSize(value: number | null | undefined) {
  if (!value || value <= 0) {
    return '-'
  }
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function readActivityString(activity: DefectActivityRecord, keys: string[]) {
  for (const key of keys) {
    const value = activity[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
    if (typeof value === 'number') {
      return String(value)
    }
  }
  return ''
}

function getActivityKey(activity: DefectActivityRecord, index: number) {
  return readActivityString(activity, ['id', 'activityId', 'createdAt', 'occurredAt']) || `activity-${index}`
}

function getActivityTitle(activity: DefectActivityRecord) {
  return readActivityString(activity, ['title', 'type', 'action']) || '缺陷记录'
}

function getActivityDetail(activity: DefectActivityRecord) {
  return readActivityString(activity, ['detail', 'content', 'comment', 'description', 'message']) || '-'
}

function getActivityActor(activity: DefectActivityRecord) {
  return readActivityString(activity, ['operatorName', 'actorName', 'createdByName', 'userName']) || '系统记录'
}

function getActivityTime(activity: DefectActivityRecord) {
  return formatDefectDateTime(readActivityString(activity, ['occurredAt', 'createdAt', 'updatedAt']))
}

function getAvatarText(value: string | null | undefined) {
  const text = displayText(value)
  return text === '-' ? '?' : text.trim().slice(0, 1).toUpperCase()
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName || 'attachment'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

async function loadDetail() {
  if (!defectId.value) {
    errorMessage.value = '缺陷不存在或链接参数无效。'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    detail.value = await defectApi.getDefectDetail(workspaceCode.value, defectId.value)
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function downloadAttachment(attachment: DefectAttachment) {
  if (!defectId.value || attachmentDownloadingId.value) {
    return
  }

  attachmentDownloadingId.value = attachment.id
  try {
    const blob = await defectApi.downloadDefectAttachment(workspaceCode.value, defectId.value, attachment.id)
    triggerBlobDownload(blob, attachment.fileName)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    attachmentDownloadingId.value = null
  }
}

function goBack() {
  const code = detail.value?.workspaceCode || workspaceCode.value
  void router.push({
    path: '/bugs',
    query: code ? { workspace: code } : undefined,
  })
}

function openEdit() {
  if (!detail.value) {
    return
  }

  void router.push({
    path: `/bugs/${detail.value.id}/edit`,
    query: detail.value.workspaceCode ? { workspace: detail.value.workspaceCode } : undefined,
  })
}

function switchTab(tab: DetailTab) {
  activeTab.value = tab
  void router.replace({
    query: {
      ...route.query,
      tab,
    },
  })
}

watch(
  () => route.query.tab,
  value => {
    activeTab.value = normalizeTab(value)
  },
  { immediate: true },
)

watch(
  () => [route.params.id, route.query.workspace],
  () => {
    void loadDetail()
  },
)

onMounted(() => {
  activeTab.value = normalizeTab(route.query.tab)
  void loadDetail()
})
</script>

<template>
  <section class="defect-detail-page">
    <div class="defect-detail-page__shell">
      <header class="defect-detail-page__header">
        <div class="defect-detail-page__backbar">
          <el-button text :icon="ArrowLeft" class="defect-detail-page__back-button" @click="goBack">
            返回缺陷管理
          </el-button>
        </div>
        <div class="defect-detail-page__titlebar">
          <div class="defect-detail-page__title-main">
            <div class="defect-detail-page__object-line">
              <DefectPriorityBadge v-if="detail" :priority="detail.priority" />
              <span>{{ displayText(detail?.bugNo) }}</span>
              <DefectStatusBadge v-if="detail" :status="detail.status" />
            </div>
            <h1>{{ displayText(detail?.title || '缺陷详情') }}</h1>
            <p>{{ displayText(detail?.workspaceName || detail?.workspaceCode) }}</p>
          </div>

          <div class="defect-detail-page__actions">
            <AppButton v-if="detail" :icon="Edit" @click="openEdit">编辑</AppButton>
          </div>
        </div>
      </header>

      <nav class="defect-detail-page__tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          :class="{ 'is-active': activeTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <main class="defect-detail-page__content">
        <AppLoadingState v-if="loading" title="正在加载缺陷详情" description="请稍候，系统正在读取最新缺陷信息。" />
        <div v-else-if="errorMessage" class="defect-detail-page__error">
          <span>{{ errorMessage }}</span>
          <AppButton size="small" @click="loadDetail">重试</AppButton>
        </div>

        <template v-else-if="detail">
          <section v-show="activeTab === 'detail'" class="defect-detail-page__pane">
            <div class="defect-detail-page__section">
              <div class="defect-detail-page__section-header">
                <h2>缺陷标题</h2>
              </div>
              <p class="defect-detail-page__title-text">{{ displayText(detail.title) }}</p>
            </div>

            <div class="defect-detail-page__section">
              <div class="defect-detail-page__section-header">
                <h2>缺陷描述</h2>
              </div>
              <p class="defect-detail-page__text">{{ displayRichText(detail.description) }}</p>
            </div>
          </section>

          <section v-show="activeTab === 'basic'" class="defect-detail-page__pane">
            <dl class="defect-detail-page__meta">
              <div>
                <dt>状态</dt>
                <dd><DefectStatusBadge :status="detail.status" /></dd>
              </div>
              <div>
                <dt>标签</dt>
                <dd>{{ formatDefectTags(detail.tags) }}</dd>
              </div>
              <div>
                <dt>优先级</dt>
                <dd><DefectPriorityBadge :priority="detail.priority" /></dd>
              </div>
              <div>
                <dt>严重级别</dt>
                <dd><DefectSeverityBadge :severity="detail.severity" /></dd>
              </div>
              <div>
                <dt>处理人</dt>
                <dd>{{ displayText(detail.assigneeName) }}</dd>
              </div>
              <div>
                <dt>创建人</dt>
                <dd>{{ displayText(detail.reporterName) }}</dd>
              </div>
              <div>
                <dt>工作空间</dt>
                <dd>{{ displayText(detail.workspaceName || detail.workspaceCode) }}</dd>
              </div>
              <div>
                <dt>创建时间</dt>
                <dd>{{ formatDefectDateTime(detail.createdAt) }}</dd>
              </div>
            </dl>
          </section>

          <section v-show="activeTab === 'case'" class="defect-detail-page__pane">
            <el-table v-if="caseRows.length" :data="caseRows" class="defect-detail-page__case-table">
              <el-table-column prop="caseNo" label="用例编号" min-width="150">
                <template #default="{ row }">
                  <el-button text type="primary" class="defect-detail-page__text-button">
                    {{ displayText(row.caseNo || row.id) }}
                  </el-button>
                </template>
              </el-table-column>
              <el-table-column prop="title" label="用例名称" min-width="260" show-overflow-tooltip />
              <el-table-column prop="workspaceName" label="所属项目" min-width="160" show-overflow-tooltip />
              <el-table-column prop="caseType" label="用例类型" width="120">
                <template #default="{ row }">
                  {{ displayText(row.caseType || '功能用例') }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="120" fixed="right">
                <template #default>
                  <el-button text type="primary" class="defect-detail-page__text-button">查看</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无关联用例" :image-size="72" />
          </section>

          <section v-show="activeTab === 'comment'" class="defect-detail-page__pane">
            <div class="defect-detail-page__section">
              <div class="defect-detail-page__section-header">
                <h2>评论</h2>
                <span>{{ commentCount }} 条评论</span>
              </div>
              <div v-if="getComments(detail).length" class="defect-detail-page__comment-list">
                <article v-for="comment in getComments(detail)" :key="comment.id" class="defect-detail-page__comment">
                  <span class="defect-detail-page__avatar">{{ getAvatarText(comment.commenterName) }}</span>
                  <div>
                    <div class="defect-detail-page__comment-top">
                      <strong>{{ displayText(comment.commenterName) }}</strong>
                      <time>{{ formatDefectDateTime(comment.createdAt) }}</time>
                    </div>
                    <p>{{ displayText(comment.content) }}</p>
                  </div>
                </article>
              </div>
              <AppEmptyState v-else title="暂无评论" description="当前缺陷还没有评论记录。" />
            </div>
          </section>

          <section v-show="activeTab === 'attachment'" class="defect-detail-page__pane">
            <div class="defect-detail-page__section">
              <div class="defect-detail-page__section-header">
                <h2>附件</h2>
                <span>{{ attachmentCount }} 个附件</span>
              </div>
              <div v-if="getAttachments(detail).length" class="defect-detail-page__file-list">
                <article v-for="attachment in getAttachments(detail)" :key="attachment.id" class="defect-detail-page__file">
                  <div class="defect-detail-page__file-icon">FILE</div>
                  <div class="defect-detail-page__file-main">
                    <strong>{{ attachment.fileName }}</strong>
                    <span>{{ formatFileSize(attachment.fileSize) }} / {{ displayText(attachment.uploadedByName) }} / {{ formatDefectDateTime(attachment.createdAt) }}</span>
                  </div>
                  <el-button
                    text
                    type="primary"
                    :icon="Download"
                    :loading="attachmentDownloadingId === attachment.id"
                    @click="downloadAttachment(attachment)"
                  >
                    下载
                  </el-button>
                </article>
              </div>
              <AppEmptyState v-else title="暂无附件" description="当前缺陷还没有附件。" />
            </div>
          </section>

          <section v-show="activeTab === 'history'" class="defect-detail-page__pane">
            <div class="defect-detail-page__section">
              <div class="defect-detail-page__section-header">
                <h2>历史</h2>
                <span>{{ activityCount }} 条记录</span>
              </div>
              <div v-if="getActivities(detail).length" class="defect-detail-page__timeline">
                <article
                  v-for="(activity, index) in getActivities(detail)"
                  :key="getActivityKey(activity, index)"
                  class="defect-detail-page__timeline-item"
                >
                  <span />
                  <div>
                    <strong>{{ getActivityTitle(activity) }}</strong>
                    <small>{{ getActivityActor(activity) }} / {{ getActivityDetail(activity) }}</small>
                  </div>
                  <time>{{ getActivityTime(activity) }}</time>
                </article>
              </div>
              <AppEmptyState v-else title="暂无历史" description="当前缺陷还没有更多流转或操作记录。" />
            </div>
          </section>
        </template>
      </main>
    </div>
  </section>
</template>

<style scoped>
.defect-detail-page {
  display: flex;
  height: 100%;
  min-height: 0;
  padding: var(--app-space-6);
  overflow: auto;
  background: var(--app-bg-page);
}

.defect-detail-page__shell {
  display: grid;
  width: 100%;
  max-width: 1440px;
  min-height: 0;
  margin: 0 auto;
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.defect-detail-page__header {
  display: grid;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.defect-detail-page__backbar {
  display: flex;
  padding: var(--app-space-4) var(--app-space-6) 0;
}

.defect-detail-page__back-button {
  padding: 0;
  color: var(--app-primary);
  font-size: 13px;
  font-weight: 600;
}

.defect-detail-page__titlebar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
  padding: var(--app-space-4) var(--app-space-6) var(--app-space-5);
}

.defect-detail-page__title-main {
  min-width: 0;
}

.defect-detail-page__object-line {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  margin-bottom: var(--app-space-2);
}

.defect-detail-page__object-line span {
  color: var(--app-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.defect-detail-page__titlebar h1 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 22px;
  font-weight: 700;
  line-height: 30px;
}

.defect-detail-page__titlebar p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-page__actions {
  display: flex;
  flex: 0 0 auto;
  gap: var(--app-space-2);
}

.defect-detail-page__tabs {
  display: flex;
  gap: var(--app-space-5);
  min-height: 44px;
  padding: 0 var(--app-space-6);
  border-bottom: 1px solid var(--app-border);
}

.defect-detail-page__tabs button {
  position: relative;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 500;
}

.defect-detail-page__tabs button.is-active {
  color: var(--app-primary);
  font-weight: 600;
}

.defect-detail-page__tabs button.is-active::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 999px 999px 0 0;
  background: var(--app-primary);
  content: '';
}

.defect-detail-page__content {
  min-height: 0;
  overflow: auto;
  padding: var(--app-space-5) var(--app-space-6);
  background: var(--app-bg-panel);
}

.defect-detail-page__pane {
  display: grid;
  gap: var(--app-space-5);
}

.defect-detail-page__section {
  display: grid;
  gap: var(--app-space-3);
}

.defect-detail-page__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding-bottom: var(--app-space-1);
  border-bottom: 1px solid var(--app-border-soft);
}

.defect-detail-page__section-header h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.defect-detail-page__section-header span {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
}

.defect-detail-page__title-text,
.defect-detail-page__text {
  margin: 0;
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 24px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.defect-detail-page__title-text {
  color: var(--app-text-primary);
  font-weight: 600;
}

.defect-detail-page__meta {
  display: grid;
  overflow: hidden;
  margin: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
}

.defect-detail-page__meta div {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  min-height: 44px;
  border-bottom: 1px solid var(--app-border-soft);
}

.defect-detail-page__meta div:last-child {
  border-bottom: 0;
}

.defect-detail-page__meta dt,
.defect-detail-page__meta dd {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 11px var(--app-space-4);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
}

.defect-detail-page__meta dt {
  background: var(--app-bg-subtle);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.defect-detail-page__meta dd {
  color: var(--app-text-main);
}

.defect-detail-page__case-table {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
}

.defect-detail-page__case-table :deep(.el-table__header th.el-table__cell) {
  height: 40px;
  background: var(--app-bg-subtle);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.defect-detail-page__case-table :deep(.el-table__row) {
  height: 48px;
}

.defect-detail-page__text-button {
  height: 28px;
  margin-left: 0;
  padding: 0;
  font-size: 13px;
}

.defect-detail-page__comment-list,
.defect-detail-page__file-list,
.defect-detail-page__timeline {
  display: grid;
  gap: var(--app-space-3);
}

.defect-detail-page__comment {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: var(--app-space-3);
  padding: var(--app-space-3) var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-subtle);
}

.defect-detail-page__avatar {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.defect-detail-page__comment-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.defect-detail-page__comment strong,
.defect-detail-page__file strong,
.defect-detail-page__timeline-item strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.defect-detail-page__comment time,
.defect-detail-page__file span,
.defect-detail-page__timeline-item time,
.defect-detail-page__timeline-item small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-page__comment p {
  margin: var(--app-space-2) 0 0;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
  white-space: pre-wrap;
}

.defect-detail-page__file {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
}

.defect-detail-page__file-icon {
  display: inline-flex;
  width: 42px;
  height: 48px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-subtle);
  color: var(--app-text-muted);
  font-size: 10px;
  font-weight: 700;
}

.defect-detail-page__file-main {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: var(--app-space-1);
}

.defect-detail-page__file-main strong,
.defect-detail-page__file-main span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-detail-page__timeline-item {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  gap: var(--app-space-3);
  padding: var(--app-space-3) var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.defect-detail-page__timeline-item > span {
  width: 11px;
  height: 11px;
  margin-top: 4px;
  border: 2px solid var(--app-primary);
  border-radius: 999px;
  background: var(--app-bg-panel);
}

.defect-detail-page__timeline-item div {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
}

.defect-detail-page__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 720px) {
  .defect-detail-page {
    padding: var(--app-space-3);
  }

  .defect-detail-page__titlebar {
    flex-direction: column;
  }

  .defect-detail-page__tabs {
    overflow-x: auto;
  }

  .defect-detail-page__meta div,
  .defect-detail-page__timeline-item {
    grid-template-columns: 1fr;
  }

  .defect-detail-page__file {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

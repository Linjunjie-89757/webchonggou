<script setup lang="ts">
import { computed, ref, watch } from 'vue'

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
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

type DefectActivityRecord = Record<string, unknown>

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    defectId?: number | null
    workspaceCode?: string
  }>(),
  {
    defectId: null,
    workspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const detail = ref<DefectDetail | null>(null)
const comments = ref<DefectComment[]>([])
const loading = ref(false)
const errorMessage = ref('')
const commentsLoading = ref(false)
const commentsErrorMessage = ref('')
const commentDraft = ref('')
const commentSubmitting = ref(false)
const commentSubmitError = ref('')
const activeTab = ref<'basic' | 'detail' | 'comment' | 'history'>('basic')
let detailRequestSeq = 0
let commentsRequestSeq = 0

const detailTabs = [
  { key: 'basic', label: '基础信息' },
  { key: 'detail', label: '详情' },
  { key: 'comment', label: '评论' },
  { key: 'history', label: '历史' },
] as const

const activityCount = computed(() => {
  if (!Array.isArray(detail.value?.activities)) {
    return 0
  }

  return detail.value.activities.length
})

function closeDrawer() {
  emit('update:modelValue', false)
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

function getAttachments(value: DefectDetail | null): DefectAttachment[] {
  return Array.isArray(value?.attachments) ? value.attachments : []
}

function getActivities(value: DefectDetail | null): DefectActivityRecord[] {
  return Array.isArray(value?.activities) ? (value.activities as DefectActivityRecord[]) : []
}

function getAttachmentTypeLabel(attachment: DefectAttachment) {
  const fileName = attachment.fileName || ''
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() : ''
  return ext || 'FILE'
}

function getAttachmentTypeTone(attachment: DefectAttachment) {
  const label = getAttachmentTypeLabel(attachment)
  if (['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'BMP', 'SVG'].includes(label)) {
    return 'image'
  }
  if (label === 'PDF') {
    return 'pdf'
  }
  if (['DOC', 'DOCX'].includes(label)) {
    return 'doc'
  }
  if (['XLS', 'XLSX', 'CSV'].includes(label)) {
    return 'xls'
  }
  if (['ZIP', 'RAR', '7Z'].includes(label)) {
    return 'zip'
  }
  return 'neutral'
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

function getActivityTime(activity: DefectActivityRecord) {
  return formatDefectDateTime(readActivityString(activity, ['occurredAt', 'createdAt', 'updatedAt']))
}

async function loadDetail() {
  if (!props.defectId) {
    return
  }

  const requestSeq = ++detailRequestSeq
  loading.value = true
  errorMessage.value = ''
  detail.value = null
  try {
    const nextDetail = await defectApi.getDefectDetail(props.workspaceCode, props.defectId)
    if (requestSeq === detailRequestSeq) {
      detail.value = nextDetail
      comments.value = Array.isArray(nextDetail.comments) ? nextDetail.comments : comments.value
    }
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

async function loadComments() {
  if (!props.defectId) {
    return
  }

  const requestSeq = ++commentsRequestSeq
  commentsLoading.value = true
  commentsErrorMessage.value = ''
  try {
    const nextComments = await defectApi.getDefectComments(props.workspaceCode, props.defectId)
    if (requestSeq === commentsRequestSeq) {
      comments.value = nextComments
    }
  } catch (error) {
    if (requestSeq === commentsRequestSeq) {
      commentsErrorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === commentsRequestSeq) {
      commentsLoading.value = false
    }
  }
}

async function submitComment() {
  if (!props.defectId || commentSubmitting.value) {
    return
  }

  const content = commentDraft.value.trim()
  if (!content) {
    commentSubmitError.value = '请输入评论内容'
    return
  }

  commentSubmitting.value = true
  commentSubmitError.value = ''
  try {
    const nextComment = await defectApi.addDefectComment(props.workspaceCode, props.defectId, { content })
    comments.value = [...comments.value, nextComment]
    commentDraft.value = ''
    void loadDetail()
  } catch (error) {
    commentSubmitError.value = getRequestErrorMessage(error)
  } finally {
    commentSubmitting.value = false
  }
}

watch(
  () => [props.modelValue, props.defectId, props.workspaceCode] as const,
  ([visible]) => {
    if (visible) {
      activeTab.value = 'basic'
      commentDraft.value = ''
      commentSubmitError.value = ''
      void loadDetail()
      void loadComments()
    }
  },
  { immediate: true },
)
</script>

<template>
  <AppDrawer
    :model-value="modelValue"
    :with-header="false"
    size="850px"
    drawer-class="defect-detail-drawer-host"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="defect-detail-drawer">
      <header class="defect-detail-drawer__topbar">
        <div class="defect-detail-drawer__title-wrap">
          <div class="defect-detail-drawer__object-line">
            <DefectPriorityBadge v-if="detail" :priority="detail.priority" />
            <span class="defect-detail-drawer__code">{{ displayText(detail?.bugNo) }}</span>
            <strong class="defect-detail-drawer__title">{{ displayText(detail?.title || '缺陷详情') }}</strong>
            <DefectStatusBadge v-if="detail" :status="detail.status" />
          </div>
          <p class="defect-detail-drawer__subtitle">
            {{ displayText(detail?.workspaceName || detail?.workspaceCode || detail?.sourceType || '缺陷详情') }}
          </p>
        </div>

        <button class="defect-detail-drawer__close" type="button" aria-label="关闭" @click="closeDrawer">×</button>
      </header>

      <nav v-if="detail" class="defect-detail-drawer__tabs" aria-label="缺陷详情分区">
        <button
          v-for="tab in detailTabs"
          :key="tab.key"
          type="button"
          class="defect-detail-drawer__tab"
          :class="{ 'is-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div class="defect-detail-drawer__content">
        <AppLoadingState v-if="loading && !detail" text="正在加载缺陷详情..." />

        <AppEmptyState v-else-if="errorMessage && !detail" title="缺陷详情加载失败" :description="errorMessage">
          <template #actions>
            <AppButton @click="loadDetail">重试</AppButton>
          </template>
        </AppEmptyState>

        <template v-else-if="detail">
          <div v-if="errorMessage" class="defect-detail-drawer__inline-error">
            {{ errorMessage }}
            <AppButton size="small" @click="loadDetail">重试</AppButton>
          </div>

          <section v-show="activeTab === 'basic'" class="defect-detail-drawer__pane">
            <div class="defect-detail-drawer__section defect-detail-drawer__section--hero">
              <div class="defect-detail-drawer__section-header">
                <h4>基础信息</h4>
                <span>缺陷流转的核心字段</span>
              </div>
              <dl class="defect-detail-drawer__meta">
                <div class="defect-detail-drawer__meta-row">
                  <dt>所属空间</dt>
                  <dd>{{ displayText(detail.workspaceName || detail.workspaceCode) }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>处理人</dt>
                  <dd>{{ displayText(detail.assigneeName) }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>报告人</dt>
                  <dd>{{ displayText(detail.reporterName) }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>关联用例</dt>
                  <dd>{{ displayText(detail.relatedCaseId || detail.relatedCaseCount) }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>创建时间</dt>
                  <dd>{{ formatDefectDateTime(detail.createdAt) }}</dd>
                </div>
                <div class="defect-detail-drawer__meta-row">
                  <dt>更新时间</dt>
                  <dd>{{ formatDefectDateTime(detail.updatedAt) }}</dd>
                </div>
              </dl>
            </div>

            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>状态标签</h4>
                <span>状态、优先级、严重级别</span>
              </div>
              <div class="defect-detail-drawer__badges">
                <DefectStatusBadge :status="detail.status" />
                <DefectPriorityBadge :priority="detail.priority" />
                <DefectSeverityBadge :severity="detail.severity" />
              </div>
            </div>
          </section>

          <section v-show="activeTab === 'detail'" class="defect-detail-drawer__pane">
            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>标签</h4>
                <span>用于快速归类和筛选</span>
              </div>
              <p class="defect-detail-drawer__text is-compact">{{ formatDefectTags(detail.tags) }}</p>
            </div>

            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>缺陷描述</h4>
                <span>复现现象、影响范围和补充信息</span>
              </div>
              <p class="defect-detail-drawer__text">{{ displayRichText(detail.description) }}</p>
            </div>

            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>附件</h4>
                <span>{{ getAttachments(detail).length }} 个附件</span>
              </div>
              <div v-if="getAttachments(detail).length" class="defect-detail-drawer__list">
                <div
                  v-for="attachment in getAttachments(detail)"
                  :key="attachment.id"
                  class="defect-detail-drawer__attachment-row"
                >
                  <span
                    class="defect-detail-drawer__attachment-icon"
                    :data-tone="getAttachmentTypeTone(attachment)"
                  >
                    {{ getAttachmentTypeLabel(attachment) }}
                  </span>
                  <span class="defect-detail-drawer__attachment-main">
                    <strong>{{ displayText(attachment.fileName) }}</strong>
                    <small>
                      {{ formatFileSize(attachment.fileSize) }}
                      · {{ displayText(attachment.uploadedByName) }}
                      · {{ formatDefectDateTime(attachment.createdAt) }}
                    </small>
                  </span>
                </div>
              </div>
              <p v-else class="defect-detail-drawer__muted">暂无附件</p>
            </div>
          </section>

          <section v-show="activeTab === 'comment'" class="defect-detail-drawer__pane">
            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>评论</h4>
                <span>{{ comments.length }} 条评论</span>
              </div>
              <AppLoadingState v-if="commentsLoading && !comments.length" text="正在加载评论..." />

              <div v-else-if="commentsErrorMessage && !comments.length" class="defect-detail-drawer__inline-error">
                <span>{{ commentsErrorMessage }}</span>
                <AppButton size="small" @click="loadComments">重试</AppButton>
              </div>

              <div v-else-if="comments.length" class="defect-detail-drawer__list">
                <div v-for="comment in comments" :key="comment.id" class="defect-detail-drawer__list-item">
                  <div class="defect-detail-drawer__comment-top">
                    <strong>{{ displayText(comment.commenterName) }}</strong>
                    <span>{{ formatDefectDateTime(comment.createdAt) }}</span>
                  </div>
                  <p>{{ displayText(comment.content) }}</p>
                </div>
              </div>

              <p v-else class="defect-detail-drawer__muted">暂无评论</p>
            </div>
            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>发表评论</h4>
                <span>仅支持纯文本评论</span>
              </div>
              <div class="defect-detail-drawer__comment-editor">
                <el-input
                  v-model="commentDraft"
                  type="textarea"
                  :rows="4"
                  maxlength="500"
                  show-word-limit
                  placeholder="输入评论内容"
                  :disabled="commentSubmitting"
                />
                <p v-if="commentSubmitError" class="defect-detail-drawer__form-error">
                  {{ commentSubmitError }}
                </p>
                <div class="defect-detail-drawer__comment-actions">
                  <AppButton
                    type="primary"
                    :loading="commentSubmitting"
                    :disabled="!commentDraft.trim() || commentSubmitting"
                    @click="submitComment"
                  >
                    提交评论
                  </AppButton>
                </div>
              </div>
            </div>
          </section>

          <section v-show="activeTab === 'history'" class="defect-detail-drawer__pane">
            <div class="defect-detail-drawer__section">
              <div class="defect-detail-drawer__section-header">
                <h4>历史</h4>
                <span>{{ activityCount }} 条记录</span>
              </div>
              <div v-if="getActivities(detail).length" class="defect-detail-drawer__timeline">
                <div
                  v-for="(activity, index) in getActivities(detail)"
                  :key="getActivityKey(activity, index)"
                  class="defect-detail-drawer__timeline-item"
                >
                  <span class="defect-detail-drawer__timeline-dot" />
                  <span class="defect-detail-drawer__timeline-main">
                    <strong>{{ getActivityTitle(activity) }}</strong>
                    <small>{{ getActivityDetail(activity) }}</small>
                  </span>
                  <time>{{ getActivityTime(activity) }}</time>
                </div>
              </div>
              <p v-else class="defect-detail-drawer__muted">暂无变更历史</p>
            </div>
          </section>
        </template>
      </div>
    </div>
  </AppDrawer>
</template>

<style scoped>
.defect-detail-drawer {
  display: flex;
  height: 100%;
  flex-direction: column;
  min-height: 0;
  background: var(--app-bg-panel);
}

:global(.defect-detail-drawer-host .el-drawer__body) {
  min-height: 0;
  padding: 0;
}

.defect-detail-drawer__topbar {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  min-height: 72px;
  padding: var(--app-space-5) var(--app-space-6) var(--app-space-3);
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__title-wrap {
  min-width: 0;
  flex: 1;
}

.defect-detail-drawer__object-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
  white-space: nowrap;
}

.defect-detail-drawer__code {
  flex: 0 0 auto;
  color: var(--app-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: var(--app-line-height-sm);
}

.defect-detail-drawer__title {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  font-weight: 600;
  line-height: var(--app-line-height-lg);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-detail-drawer__subtitle {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-drawer__close {
  display: inline-flex;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  transition: background-color 160ms ease, color 160ms ease;
}

.defect-detail-drawer__close:hover,
.defect-detail-drawer__close:focus-visible {
  background: var(--app-primary-soft);
  color: var(--app-primary);
  outline: none;
}

.defect-detail-drawer__tabs {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-5);
  min-height: 44px;
  padding: 0 var(--app-space-6);
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__tab {
  position: relative;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 44px;
  white-space: nowrap;
  transition: color 160ms ease;
}

.defect-detail-drawer__tab:hover,
.defect-detail-drawer__tab:focus-visible {
  color: var(--app-primary);
  outline: none;
}

.defect-detail-drawer__tab.is-active {
  color: var(--app-primary);
  font-weight: 600;
}

.defect-detail-drawer__tab.is-active::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 999px 999px 0 0;
  background: var(--app-primary);
  content: '';
}

.defect-detail-drawer__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: var(--app-space-5) var(--app-space-6);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__pane {
  display: grid;
  gap: var(--app-space-5);
}

.defect-detail-drawer__badges {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.defect-detail-drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-5);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__section--hero {
  background: var(--app-bg-panel);
}

.defect-detail-drawer__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.defect-detail-drawer__section-header h4 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.defect-detail-drawer__section-header span {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-drawer__meta {
  display: grid;
  grid-template-columns: 1fr;
  overflow: hidden;
  margin: 0;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__meta-row {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  min-height: 42px;
  min-width: 0;
  align-items: center;
  border-bottom: 1px solid var(--app-border-soft);
}

.defect-detail-drawer__meta-row:last-child {
  border-bottom: 0;
}

.defect-detail-drawer__meta dt {
  height: 100%;
  margin: 0;
  padding: 11px var(--app-space-4);
  background: var(--app-bg-subtle);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: 20px;
}

.defect-detail-drawer__meta dd {
  margin: 0;
  padding: 11px var(--app-space-4);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__text {
  margin: 0;
  max-height: 340px;
  overflow: auto;
  padding: var(--app-space-4);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 24px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__text.is-compact {
  max-height: 120px;
}

.defect-detail-drawer__list {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.defect-detail-drawer__list-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
  padding: var(--app-space-4);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__list-item strong {
  min-width: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  overflow-wrap: anywhere;
}

.defect-detail-drawer__comment-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.defect-detail-drawer__comment-top span {
  flex: 0 0 auto;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-drawer__list-item p {
  margin: 0;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__comment-editor {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
}

.defect-detail-drawer__comment-actions {
  display: flex;
  justify-content: flex-end;
}

.defect-detail-drawer__form-error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
}

.defect-detail-drawer__list-item span,
.defect-detail-drawer__muted {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  overflow-wrap: anywhere;
}

.defect-detail-drawer__attachment-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.defect-detail-drawer__attachment-icon {
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
  line-height: 1;
  text-transform: uppercase;
}

.defect-detail-drawer__attachment-icon[data-tone='pdf'] {
  border-color: #fecaca;
  background: #fef2f2;
  color: var(--app-danger);
}

.defect-detail-drawer__attachment-icon[data-tone='doc'] {
  border-color: #bfdbfe;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.defect-detail-drawer__attachment-icon[data-tone='xls'] {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
  color: var(--app-success);
}

.defect-detail-drawer__attachment-icon[data-tone='image'] {
  border-color: #ddd6fe;
  background: var(--app-purple-soft);
  color: var(--app-purple);
}

.defect-detail-drawer__attachment-icon[data-tone='zip'] {
  border-color: #fed7aa;
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.defect-detail-drawer__attachment-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--app-space-1);
}

.defect-detail-drawer__attachment-main strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-detail-drawer__attachment-main small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-drawer__timeline {
  display: flex;
  flex-direction: column;
}

.defect-detail-drawer__timeline-item {
  position: relative;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  gap: var(--app-space-3);
  padding: 0 0 var(--app-space-4);
}

.defect-detail-drawer__timeline-item:not(:last-child)::before {
  position: absolute;
  top: 16px;
  bottom: 0;
  left: 5px;
  width: 1px;
  background: var(--app-border);
  content: '';
}

.defect-detail-drawer__timeline-dot {
  position: relative;
  z-index: 1;
  width: 11px;
  height: 11px;
  margin-top: 4px;
  border: 2px solid var(--app-primary);
  border-radius: 999px;
  background: var(--app-bg-panel);
}

.defect-detail-drawer__timeline-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-1);
}

.defect-detail-drawer__timeline-main strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: 20px;
}

.defect-detail-drawer__timeline-main small,
.defect-detail-drawer__timeline-item time {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.defect-detail-drawer__timeline-item time {
  white-space: nowrap;
}

.defect-detail-drawer__muted {
  margin: 0;
  padding: var(--app-space-4);
  border: 1px dashed var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  text-align: center;
}

.defect-detail-drawer__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 720px) {
  .defect-detail-drawer__topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .defect-detail-drawer__close {
    position: absolute;
    top: var(--app-space-3);
    right: var(--app-space-3);
  }

  .defect-detail-drawer__tabs {
    gap: var(--app-space-4);
    overflow-x: auto;
  }

  .defect-detail-drawer__badges {
    justify-content: flex-start;
  }

  .defect-detail-drawer__meta {
    grid-template-columns: 1fr;
  }

  .defect-detail-drawer__meta-row,
  .defect-detail-drawer__timeline-item {
    grid-template-columns: 1fr;
  }
}
</style>

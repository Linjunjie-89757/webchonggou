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
let detailRequestSeq = 0
let commentsRequestSeq = 0

const drawerTitle = computed(() => {
  if (detail.value?.bugNo) {
    return `缺陷详情 · ${detail.value.bugNo}`
  }

  return '缺陷详情'
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
  comments.value = []
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

watch(
  () => [props.modelValue, props.defectId, props.workspaceCode] as const,
  ([visible]) => {
    if (visible) {
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
    :title="drawerTitle"
    size="620px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="defect-detail-drawer">
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

        <header class="defect-detail-drawer__summary">
          <div>
            <span class="defect-detail-drawer__code">{{ displayText(detail.bugNo) }}</span>
            <h3>{{ displayText(detail.title) }}</h3>
            <p>{{ displayText(detail.sourceType) }}</p>
          </div>
          <div class="defect-detail-drawer__badges">
            <DefectStatusBadge :status="detail.status" />
            <DefectPriorityBadge :priority="detail.priority" />
            <DefectSeverityBadge :severity="detail.severity" />
          </div>
        </header>

        <section class="defect-detail-drawer__section">
          <h4>基础信息</h4>
          <dl class="defect-detail-drawer__meta">
            <div>
              <dt>所属空间</dt>
              <dd>{{ displayText(detail.workspaceName || detail.workspaceCode) }}</dd>
            </div>
            <div>
              <dt>处理人</dt>
              <dd>{{ displayText(detail.assigneeName) }}</dd>
            </div>
            <div>
              <dt>报告人</dt>
              <dd>{{ displayText(detail.reporterName) }}</dd>
            </div>
            <div>
              <dt>关联用例</dt>
              <dd>{{ displayText(detail.relatedCaseId || detail.relatedCaseCount) }}</dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd>{{ formatDefectDateTime(detail.createdAt) }}</dd>
            </div>
            <div>
              <dt>更新时间</dt>
              <dd>{{ formatDefectDateTime(detail.updatedAt) }}</dd>
            </div>
          </dl>
        </section>

        <section class="defect-detail-drawer__section">
          <h4>标签</h4>
          <p class="defect-detail-drawer__text is-compact">{{ formatDefectTags(detail.tags) }}</p>
        </section>

        <section class="defect-detail-drawer__section">
          <h4>缺陷描述</h4>
          <p class="defect-detail-drawer__text">{{ displayText(detail.description) }}</p>
        </section>

        <section class="defect-detail-drawer__section">
          <h4>附件</h4>
          <div v-if="getAttachments(detail).length" class="defect-detail-drawer__list">
            <div
              v-for="attachment in getAttachments(detail)"
              :key="attachment.id"
              class="defect-detail-drawer__list-item"
            >
              <strong>{{ displayText(attachment.fileName) }}</strong>
              <span>
                {{ formatFileSize(attachment.fileSize) }}
                · {{ displayText(attachment.uploadedByName) }}
                · {{ formatDefectDateTime(attachment.createdAt) }}
              </span>
            </div>
          </div>
          <p v-else class="defect-detail-drawer__muted">暂无附件</p>
        </section>

        <section class="defect-detail-drawer__section">
          <h4>评论</h4>
          <AppLoadingState v-if="commentsLoading && !comments.length" text="正在加载评论..." />

          <div v-else-if="commentsErrorMessage && !comments.length" class="defect-detail-drawer__inline-error">
            <span>{{ commentsErrorMessage }}</span>
            <AppButton size="small" @click="loadComments">重试</AppButton>
          </div>

          <div v-else-if="comments.length" class="defect-detail-drawer__list">
            <div v-for="comment in comments" :key="comment.id" class="defect-detail-drawer__list-item">
              <strong>{{ displayText(comment.commenterName) }}</strong>
              <p>{{ displayText(comment.content) }}</p>
              <span>{{ formatDefectDateTime(comment.createdAt) }}</span>
            </div>
          </div>

          <p v-else class="defect-detail-drawer__muted">暂无评论</p>
        </section>
      </template>
    </div>

    <template #footer>
      <AppButton @click="closeDrawer">关闭</AppButton>
    </template>
  </AppDrawer>
</template>

<style scoped>
.defect-detail-drawer {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.defect-detail-drawer__summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
  padding-bottom: var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.defect-detail-drawer__summary h3 {
  margin: var(--app-space-1) 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
  line-height: 26px;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__summary p {
  margin: 0;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-sm);
}

.defect-detail-drawer__code {
  color: var(--app-text-muted);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
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
  gap: var(--app-space-2);
  padding-bottom: var(--app-space-3);
  border-bottom: 1px solid var(--app-border-soft);
}

.defect-detail-drawer__section:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.defect-detail-drawer__section h4 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.defect-detail-drawer__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
  margin: 0;
}

.defect-detail-drawer__meta div {
  min-width: 0;
}

.defect-detail-drawer__meta dt {
  margin-bottom: var(--app-space-1);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
}

.defect-detail-drawer__meta dd {
  margin: 0;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__text {
  margin: 0;
  max-height: 340px;
  overflow: auto;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
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
  gap: var(--app-space-1);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.defect-detail-drawer__list-item strong {
  min-width: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  overflow-wrap: anywhere;
}

.defect-detail-drawer__list-item p {
  margin: 0;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.defect-detail-drawer__list-item span,
.defect-detail-drawer__muted {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  overflow-wrap: anywhere;
}

.defect-detail-drawer__muted {
  margin: 0;
  padding: var(--app-space-3);
  border: 1px dashed var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
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
  .defect-detail-drawer__summary {
    flex-direction: column;
  }

  .defect-detail-drawer__badges {
    justify-content: flex-start;
  }

  .defect-detail-drawer__meta {
    grid-template-columns: 1fr;
  }
}
</style>

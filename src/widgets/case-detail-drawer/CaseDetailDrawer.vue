<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  CaseExecutionStatusBadge,
  type CaseDetail,
  CasePriorityBadge,
  CaseReviewStatusBadge,
  caseApi,
  formatCaseDateTime,
  getCaseDirectoryText,
} from '@/entities/case'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    caseId?: number | null
    workspaceCode?: string
  }>(),
  {
    caseId: null,
    workspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const detail = ref<CaseDetail | null>(null)
const loading = ref(false)
const errorMessage = ref('')
let detailRequestSeq = 0

const drawerTitle = computed(() => {
  if (detail.value?.caseNo) {
    return `用例详情 · ${detail.value.caseNo}`
  }

  return '用例详情'
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

async function loadDetail() {
  if (!props.caseId) {
    return
  }

  const requestSeq = ++detailRequestSeq
  loading.value = true
  errorMessage.value = ''
  detail.value = null
  try {
    const nextDetail = await caseApi.getCaseDetail(props.caseId, props.workspaceCode)
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

watch(
  () => [props.modelValue, props.caseId, props.workspaceCode] as const,
  ([visible]) => {
    if (visible) {
      void loadDetail()
    }
  },
  { immediate: true },
)
</script>

<template>
  <AppDrawer :model-value="modelValue" :title="drawerTitle" size="600px" @update:model-value="emit('update:modelValue', $event)">
    <div class="case-detail-drawer">
      <AppLoadingState v-if="loading && !detail" text="正在加载用例详情..." />

      <AppEmptyState v-else-if="errorMessage && !detail" title="用例详情加载失败" :description="errorMessage">
        <template #actions>
          <AppButton @click="loadDetail">重试</AppButton>
        </template>
      </AppEmptyState>

      <template v-else-if="detail">
        <div v-if="errorMessage" class="case-detail-drawer__inline-error">
          {{ errorMessage }}
          <AppButton size="small" @click="loadDetail">重试</AppButton>
        </div>

        <header class="case-detail-drawer__summary">
          <div>
            <span class="case-detail-drawer__code">{{ detail.caseNo }}</span>
            <h3>{{ detail.title }}</h3>
            <p>{{ detail.caseType }} · {{ detail.sourceType }}</p>
          </div>
          <div class="case-detail-drawer__badges">
            <CasePriorityBadge :priority="detail.priority" />
            <CaseReviewStatusBadge :status="detail.reviewStatus" />
            <CaseExecutionStatusBadge :status="detail.executionStatus" />
          </div>
        </header>

        <section class="case-detail-drawer__section">
          <h4>基础信息</h4>
          <dl class="case-detail-drawer__meta">
            <div>
              <dt>所属空间</dt>
              <dd>{{ displayText(detail.workspaceName || detail.workspaceCode) }}</dd>
            </div>
            <div>
              <dt>所属模块</dt>
              <dd>{{ getCaseDirectoryText(detail) }}</dd>
            </div>
            <div>
              <dt>负责人</dt>
              <dd>{{ displayText(detail.ownerName) }}</dd>
            </div>
            <div>
              <dt>执行人</dt>
              <dd>{{ displayText(detail.executorName) }}</dd>
            </div>
            <div>
              <dt>创建人</dt>
              <dd>{{ displayText(detail.createdByName) }}</dd>
            </div>
            <div>
              <dt>更新时间</dt>
              <dd>{{ formatCaseDateTime(detail.updatedAt) }}</dd>
            </div>
          </dl>
        </section>

        <section class="case-detail-drawer__section">
          <h4>前置条件</h4>
          <p class="case-detail-drawer__text">{{ displayText(detail.precondition) }}</p>
        </section>

        <section class="case-detail-drawer__section">
          <h4>测试步骤</h4>
          <p class="case-detail-drawer__text">{{ displayText(detail.steps) }}</p>
        </section>

        <section class="case-detail-drawer__section">
          <h4>预期结果</h4>
          <p class="case-detail-drawer__text">{{ displayText(detail.expectedResult) }}</p>
        </section>

        <section class="case-detail-drawer__section">
          <h4>执行记录</h4>
          <dl class="case-detail-drawer__meta">
            <div>
              <dt>执行时间</dt>
              <dd>{{ formatCaseDateTime(detail.executedAt) }}</dd>
            </div>
            <div>
              <dt>执行备注</dt>
              <dd>{{ displayText(detail.executionComment || detail.executionNote) }}</dd>
            </div>
          </dl>
        </section>
      </template>
    </div>

    <template #footer>
      <AppButton @click="closeDrawer">关闭</AppButton>
    </template>
  </AppDrawer>
</template>

<style scoped>
.case-detail-drawer {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.case-detail-drawer__summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
  padding-bottom: var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.case-detail-drawer__summary h3 {
  margin: var(--app-space-1) 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
  line-height: 26px;
  overflow-wrap: anywhere;
}

.case-detail-drawer__summary p {
  margin: 0;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-sm);
}

.case-detail-drawer__code {
  color: var(--app-text-muted);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
}

.case-detail-drawer__badges {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.case-detail-drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.case-detail-drawer__section h4 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.case-detail-drawer__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
  margin: 0;
}

.case-detail-drawer__meta div {
  min-width: 0;
}

.case-detail-drawer__meta dt {
  margin-bottom: var(--app-space-1);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
}

.case-detail-drawer__meta dd {
  margin: 0;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
  overflow-wrap: anywhere;
}

.case-detail-drawer__text {
  margin: 0;
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

.case-detail-drawer__inline-error {
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
  .case-detail-drawer__summary {
    flex-direction: column;
  }

  .case-detail-drawer__badges {
    justify-content: flex-start;
  }

  .case-detail-drawer__meta {
    grid-template-columns: 1fr;
  }
}
</style>

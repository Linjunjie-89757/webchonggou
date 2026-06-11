<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  ApiRunResultBadge,
  apiAutomationApi,
  formatApiDateTime,
  formatApiDuration,
  formatApiSize,
  type ApiRunHistoryItem,
} from '@/entities/api-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    workspaceCode?: string
    caseId?: number | null
    caseName?: string | null
  }>(),
  {
    workspaceCode: 'ALL',
    caseId: null,
    caseName: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const histories = ref<ApiRunHistoryItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const total = ref(0)
let requestSeq = 0

const drawerTitle = computed(() => {
  if (props.caseName) {
    return `执行历史 · ${props.caseName}`
  }

  return '执行历史'
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

async function loadHistory() {
  if (!props.caseId) {
    histories.value = []
    total.value = 0
    return
  }

  const currentSeq = ++requestSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await apiAutomationApi.getCaseRunHistory(props.workspaceCode, props.caseId)
    if (currentSeq === requestSeq) {
      histories.value = page.items
      total.value = page.total
    }
  } catch (error) {
    if (currentSeq === requestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (currentSeq === requestSeq) {
      loading.value = false
    }
  }
}

watch(
  () => [props.modelValue, props.workspaceCode, props.caseId] as const,
  ([visible]) => {
    if (visible) {
      void loadHistory()
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
    <div class="api-run-history-drawer">
      <AppLoadingState v-if="loading && histories.length === 0" text="正在读取执行历史..." />

      <AppEmptyState
        v-else-if="errorMessage && histories.length === 0"
        title="执行历史读取失败"
        :description="errorMessage"
      >
        <template #actions>
          <AppButton @click="loadHistory">重试</AppButton>
        </template>
      </AppEmptyState>

      <AppEmptyState
        v-else-if="histories.length === 0"
        title="暂无执行历史"
        description="当前接口用例还没有执行记录。"
      />

      <template v-else>
        <div v-if="errorMessage" class="api-run-history-drawer__inline-error">
          <span>{{ errorMessage }}</span>
          <AppButton size="small" @click="loadHistory">重试</AppButton>
        </div>

        <header class="api-run-history-drawer__summary">
          <strong>共 {{ total }} 条</strong>
          <AppButton size="small" :loading="loading" @click="loadHistory">刷新</AppButton>
        </header>

        <div class="api-run-history-drawer__list">
          <article v-for="item in histories" :key="item.id" class="api-run-history-drawer__item">
            <header>
              <ApiRunResultBadge :result="item.result" />
              <span>{{ formatApiDateTime(item.createdAt) }}</span>
            </header>
            <dl>
              <div>
                <dt>状态码</dt>
                <dd>{{ displayText(item.statusCode) }}</dd>
              </div>
              <div>
                <dt>耗时</dt>
                <dd>{{ formatApiDuration(item.durationMs) }}</dd>
              </div>
              <div>
                <dt>响应大小</dt>
                <dd>{{ formatApiSize(item.responseSize) }}</dd>
              </div>
              <div>
                <dt>执行人</dt>
                <dd>{{ displayText(item.operator) }}</dd>
              </div>
              <div>
                <dt>环境</dt>
                <dd>{{ displayText(item.environmentName) }}</dd>
              </div>
              <div>
                <dt>报告</dt>
                <dd>{{ displayText(item.reportId) }}</dd>
              </div>
            </dl>
            <p v-if="item.failureSummary">{{ item.failureSummary }}</p>
          </article>
        </div>
      </template>
    </div>

    <template #footer>
      <AppButton @click="closeDrawer">关闭</AppButton>
    </template>
  </AppDrawer>
</template>

<style scoped>
.api-run-history-drawer {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
}

.api-run-history-drawer__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.api-run-history-drawer__summary strong {
  color: var(--app-text-primary);
}

.api-run-history-drawer__list {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.api-run-history-drawer__item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.api-run-history-drawer__item header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.api-run-history-drawer__item header span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-run-history-drawer__item dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2) var(--app-space-3);
  margin: 0;
}

.api-run-history-drawer__item dt {
  margin-bottom: var(--app-space-1);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
}

.api-run-history-drawer__item dd {
  margin: 0;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
  overflow-wrap: anywhere;
}

.api-run-history-drawer__item p {
  margin: 0;
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
  line-height: 22px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.api-run-history-drawer__inline-error {
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
  .api-run-history-drawer__item dl {
    grid-template-columns: 1fr;
  }
}
</style>

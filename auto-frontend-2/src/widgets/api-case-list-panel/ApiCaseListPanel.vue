<script setup lang="ts">
import { ref, watch } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'

import {
  ApiMethodBadge,
  apiAutomationApi,
  ApiRunResultBadge,
  formatApiDateTime,
  formatApiTags,
  type ApiDefinitionCaseItem,
  type ApiDefinitionItem,
} from '@/entities/api-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    definition: ApiDefinitionItem | null
    keyword?: string
  }>(),
  {
    workspaceCode: 'ALL',
    keyword: '',
  },
)

const emit = defineEmits<{
  loaded: [items: ApiDefinitionCaseItem[]]
}>()

const cases = ref<ApiDefinitionCaseItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(0)
let loadRequestSeq = 0

async function loadCases(options: { keepPage?: boolean } = {}) {
  if (!props.definition) {
    cases.value = []
    total.value = 0
    totalPages.value = 0
    emit('loaded', [])
    return
  }

  if (!options.keepPage) {
    pageNo.value = 1
  }
  const requestSeq = ++loadRequestSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await apiAutomationApi.getCases(props.workspaceCode, {
      definitionId: props.definition.id,
      keyword: props.keyword,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    })
    if (requestSeq === loadRequestSeq) {
      cases.value = page.items
      total.value = page.total
      totalPages.value = page.totalPages
      emit('loaded', cases.value)
    }
  } catch (error) {
    if (requestSeq === loadRequestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === loadRequestSeq) {
      loading.value = false
    }
  }
}

function handlePageChange(value: number) {
  pageNo.value = value
  void loadCases({ keepPage: true })
}

function handlePageSizeChange(value: number) {
  pageSize.value = value
  pageNo.value = 1
  void loadCases({ keepPage: true })
}

watch(
  () => [props.workspaceCode, props.definition?.id, props.keyword],
  () => {
    void loadCases()
  },
  { immediate: true },
)

defineExpose({
  reload: loadCases,
})
</script>

<template>
  <section class="api-case-list-panel">
    <header class="api-case-list-panel__header">
      <div>
        <strong>接口用例</strong>
        <span v-if="definition">{{ definition.name }} · 共 {{ total }} 条</span>
        <span v-else>请选择接口定义</span>
      </div>
      <AppButton :icon="RefreshRight" :loading="loading" :disabled="!definition" @click="loadCases">刷新</AppButton>
    </header>

    <AppEmptyState
      v-if="!definition"
      title="未选择接口定义"
      description="点击上方接口定义后查看关联接口用例。"
    />
    <AppLoadingState v-else-if="loading && cases.length === 0" text="正在读取接口用例" />
    <AppEmptyState
      v-else-if="errorMessage && cases.length === 0"
      title="接口用例读取失败"
      :description="errorMessage"
      action-text="重试"
      @action="loadCases"
    />
    <AppEmptyState
      v-else-if="cases.length === 0"
      title="暂无接口用例"
      description="当前接口定义下没有匹配的接口用例。"
    />
    <div v-else class="api-case-list-panel__table-wrap">
      <el-table class="api-case-list-panel__table" :data="cases" size="small" row-key="id">
        <el-table-column label="方法" width="92">
          <template #default="{ row }">
            <ApiMethodBadge :method="row.method" />
          </template>
        </el-table-column>
        <el-table-column label="用例名称" min-width="220">
          <template #default="{ row }">
            <div class="api-case-list-panel__name">
              <strong>{{ row.name }}</strong>
              <span>{{ row.path }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="最近结果" width="112">
          <template #default="{ row }">
            <ApiRunResultBadge :result="row.lastRunResult" />
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="150">
          <template #default="{ row }">
            <span class="api-case-list-panel__muted">{{ formatApiDateTime(row.updatedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="150">
          <template #default="{ row }">
            <span class="api-case-list-panel__muted">{{ formatApiTags(row.tags) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default>
            <div class="api-case-list-panel__actions">
              <AppButton disabled>编辑</AppButton>
              <AppButton disabled>运行</AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="errorMessage" class="api-case-list-panel__inline-error">{{ errorMessage }}</p>
      <footer v-if="cases.length || total > 0" class="api-case-list-panel__pagination">
        <span>共 {{ total }} 条 / {{ totalPages }} 页</span>
        <el-pagination
          background
          layout="sizes, prev, pager, next"
          :current-page="pageNo"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="total"
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </footer>
    </div>
  </section>
</template>

<style scoped>
.api-case-list-panel {
  min-width: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.api-case-list-panel__header {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: 0 var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.api-case-list-panel__header div {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: var(--app-space-2);
}

.api-case-list-panel__header strong {
  flex: 0 0 auto;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
}

.api-case-list-panel__header span {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-list-panel__table-wrap {
  min-width: 0;
  overflow: auto;
}

.api-case-list-panel__table {
  min-width: 760px;
}

.api-case-list-panel__name {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.api-case-list-panel__name strong,
.api-case-list-panel__name span,
.api-case-list-panel__muted {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-list-panel__name strong {
  color: var(--app-text-primary);
}

.api-case-list-panel__name span,
.api-case-list-panel__muted {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
}

.api-case-list-panel__actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-1);
}

.api-case-list-panel__actions :deep(.el-button) {
  padding-right: var(--app-space-2);
  padding-left: var(--app-space-2);
}

.api-case-list-panel__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.api-case-list-panel__inline-error {
  margin: 0;
  padding: var(--app-space-2) var(--app-space-4);
  border-top: 1px solid var(--app-border-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
}

.api-case-list-panel__pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-3) var(--app-space-4);
  border-top: 1px solid var(--app-border-soft);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
}
</style>

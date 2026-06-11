<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'

import {
  ApiMethodBadge,
  apiAutomationApi,
  ApiRunResultBadge,
  formatApiDateTime,
  formatApiTags,
  matchesApiDefinitionClientFilter,
  type ApiAutomationClientFilter,
  type ApiDefinitionItem,
  type ApiDefinitionModuleItem,
} from '@/entities/api-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    filter: ApiAutomationClientFilter
    selectedModuleId?: number | null
    modules?: ApiDefinitionModuleItem[]
    selectedDefinitionId?: number | null
  }>(),
  {
    workspaceCode: 'ALL',
    selectedModuleId: null,
    modules: () => [],
    selectedDefinitionId: null,
  },
)

const emit = defineEmits<{
  loaded: [items: ApiDefinitionItem[]]
  select: [item: ApiDefinitionItem | null]
}>()

const definitions = ref<ApiDefinitionItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
let loadRequestSeq = 0

const selectedModuleName = computed(() => findModuleName(props.modules, props.selectedModuleId))

const visibleDefinitions = computed(() => {
  const moduleName = selectedModuleName.value

  return definitions.value.filter((item) => {
    const matchesModule = !moduleName || item.directoryName === moduleName || item.directoryName?.endsWith(`/${moduleName}`)
    return matchesModule && matchesApiDefinitionClientFilter(item, props.filter)
  })
})

function findModuleName(modules: ApiDefinitionModuleItem[], id?: number | null): string {
  if (!id) {
    return ''
  }

  for (const item of modules) {
    if (item.id === id) {
      return item.fullPath || item.name
    }
    const child = findModuleName(item.children, id)
    if (child) {
      return child
    }
  }

  return ''
}

function selectDefinition(item: ApiDefinitionItem) {
  emit('select', item)
}

async function loadDefinitions() {
  const requestSeq = ++loadRequestSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await apiAutomationApi.getDefinitions(props.workspaceCode)
    if (requestSeq === loadRequestSeq) {
      definitions.value = page.items
      emit('loaded', definitions.value)
      const current = definitions.value.find((item) => item.id === props.selectedDefinitionId)
      emit('select', current || definitions.value[0] || null)
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

watch(
  () => props.workspaceCode,
  () => {
    emit('select', null)
    void loadDefinitions()
  },
)

watch(
  visibleDefinitions,
  (items) => {
    if (items.length === 0) {
      emit('select', null)
      return
    }

    if (!items.some((item) => item.id === props.selectedDefinitionId)) {
      emit('select', items[0])
    }
  },
)

onMounted(() => {
  void loadDefinitions()
})

defineExpose({
  reload: loadDefinitions,
})
</script>

<template>
  <section class="api-definition-list-panel">
    <header class="api-definition-list-panel__header">
      <div>
        <strong>接口定义</strong>
        <span>共 {{ visibleDefinitions.length }} 条</span>
      </div>
      <AppButton :icon="RefreshRight" :loading="loading" @click="loadDefinitions">刷新</AppButton>
    </header>

    <AppLoadingState v-if="loading && definitions.length === 0" text="正在读取接口定义" />
    <AppEmptyState
      v-else-if="errorMessage && definitions.length === 0"
      title="接口定义读取失败"
      :description="errorMessage"
      action-text="重试"
      @action="loadDefinitions"
    />
    <AppEmptyState
      v-else-if="visibleDefinitions.length === 0"
      title="暂无接口定义"
      description="当前工作空间或筛选条件下没有接口定义。"
    />
    <div v-else class="api-definition-list-panel__table-wrap">
      <el-table
        class="api-definition-list-panel__table"
        :data="visibleDefinitions"
        size="small"
        row-key="id"
        highlight-current-row
        :current-row-key="selectedDefinitionId"
        @row-click="selectDefinition"
      >
        <el-table-column label="方法" width="92">
          <template #default="{ row }">
            <ApiMethodBadge :method="row.method" />
          </template>
        </el-table-column>
        <el-table-column label="接口名称" min-width="220">
          <template #default="{ row }">
            <div class="api-definition-list-panel__name">
              <strong>{{ row.name }}</strong>
              <span>{{ row.path }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="模块" min-width="150">
          <template #default="{ row }">
            <span class="api-definition-list-panel__muted">{{ row.directoryName || '未分组' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最近结果" width="112">
          <template #default="{ row }">
            <ApiRunResultBadge :result="row.lastRunResult" />
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="150">
          <template #default="{ row }">
            <span class="api-definition-list-panel__muted">{{ formatApiDateTime(row.updatedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="150">
          <template #default="{ row }">
            <span class="api-definition-list-panel__muted">{{ formatApiTags(row.tags) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default>
            <div class="api-definition-list-panel__actions">
              <AppButton disabled>编辑</AppButton>
              <AppButton disabled>调试</AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="errorMessage" class="api-definition-list-panel__inline-error">{{ errorMessage }}</p>
    </div>
  </section>
</template>

<style scoped>
.api-definition-list-panel {
  min-width: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.api-definition-list-panel__header {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: 0 var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.api-definition-list-panel__header div {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: var(--app-space-2);
}

.api-definition-list-panel__header strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
}

.api-definition-list-panel__header span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-definition-list-panel__table-wrap {
  min-width: 0;
  overflow: auto;
}

.api-definition-list-panel__table {
  min-width: 980px;
}

.api-definition-list-panel__name {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.api-definition-list-panel__name strong,
.api-definition-list-panel__name span,
.api-definition-list-panel__muted {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-list-panel__name strong {
  color: var(--app-text-primary);
}

.api-definition-list-panel__name span,
.api-definition-list-panel__muted {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
}

.api-definition-list-panel__actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-1);
}

.api-definition-list-panel__actions :deep(.el-button) {
  padding-right: var(--app-space-2);
  padding-left: var(--app-space-2);
}

.api-definition-list-panel__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.api-definition-list-panel__inline-error {
  margin: 0;
  padding: var(--app-space-2) var(--app-space-4);
  border-top: 1px solid var(--app-border-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
}
</style>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'

import {
  apiAutomationApi,
  buildApiAutomationStats,
  type ApiAutomationClientFilter,
  type ApiDefinitionCaseItem,
  type ApiDefinitionItem,
  type ApiDefinitionModuleItem,
} from '@/entities/api-automation'
import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import { ApiAutomationSummaryPanel } from '@/widgets/api-automation-summary-panel'
import { ApiCaseListPanel } from '@/widgets/api-case-list-panel'
import { ApiDefinitionListPanel } from '@/widgets/api-definition-list-panel'
import { ApiDefinitionTree } from '@/widgets/api-definition-tree'

const workspaceCode = ref('ALL')
const workspaceSelectorCode = ref('ALL')
const workspaces = ref<WorkspaceItem[]>([])
const workspaceLoading = ref(false)
const workspaceReady = ref(false)
const workspaceErrorMessage = ref('')
const modules = ref<ApiDefinitionModuleItem[]>([])
const modulesLoading = ref(false)
const modulesErrorMessage = ref('')
const definitions = ref<ApiDefinitionItem[]>([])
const cases = ref<ApiDefinitionCaseItem[]>([])
const selectedNodeId = ref('root')
const selectedModuleId = ref<number | null>(null)
const selectedDefinition = ref<ApiDefinitionItem | null>(null)
const filter = ref<ApiAutomationClientFilter>({
  keyword: '',
})

const workspaceOptions = computed(() => {
  const options = workspaces.value.map((item) => ({
    label: item.workspaceName || item.workspaceCode,
    value: item.workspaceCode,
  }))

  if (!options.some((item) => item.value === 'ALL')) {
    options.unshift({ label: '全部空间', value: 'ALL' })
  }

  return options
})

const stats = computed(() => buildApiAutomationStats(definitions.value, cases.value, flattenModules(modules.value)))

function flattenModules(items: ApiDefinitionModuleItem[]): ApiDefinitionModuleItem[] {
  return items.flatMap((item) => [item, ...flattenModules(item.children)])
}

function resolveDefaultWorkspaceCode(items: WorkspaceItem[]) {
  const selected = items.find((item) => item.current || item.isCurrent || item.default || item.isDefault)
  return selected?.workspaceCode || items[0]?.workspaceCode || 'ALL'
}

async function loadWorkspaces() {
  workspaceLoading.value = true
  workspaceReady.value = false
  workspaceErrorMessage.value = ''
  try {
    const items = await workspaceApi.getSwitchableWorkspaces()
    workspaces.value = items
    workspaceCode.value = resolveDefaultWorkspaceCode(items)
    workspaceSelectorCode.value = workspaceCode.value
  } catch (error) {
    workspaceCode.value = 'ALL'
    workspaceSelectorCode.value = 'ALL'
    workspaceErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    workspaceLoading.value = false
    workspaceReady.value = true
  }
}

async function loadModules() {
  modulesLoading.value = true
  modulesErrorMessage.value = ''
  try {
    modules.value = await apiAutomationApi.getDefinitionModules(workspaceCode.value)
  } catch (error) {
    modulesErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    modulesLoading.value = false
  }
}

function handleWorkspaceChange(value: string) {
  workspaceCode.value = value
  selectedNodeId.value = 'root'
  selectedModuleId.value = null
  selectedDefinition.value = null
  definitions.value = []
  cases.value = []
  void loadModules()
}

function handleModuleSelect(payload: { nodeId: string; moduleId: number | null }) {
  selectedNodeId.value = payload.nodeId
  selectedModuleId.value = payload.moduleId
}

function resetFilters() {
  filter.value = {
    keyword: '',
  }
}

onMounted(() => {
  void (async () => {
    await loadWorkspaces()
    await loadModules()
  })()
})
</script>

<template>
  <AppPage
    title="接口自动化"
    description="先接入接口模块、接口定义和接口用例读取闭环，后续再补齐编辑、调试和场景编排。"
  >
    <template #actions>
      <div class="api-automation-page__workspace-select">
        <span class="api-automation-page__workspace-label">工作空间</span>
        <el-select
          v-model="workspaceSelectorCode"
          class="api-automation-page__workspace-control"
          :disabled="workspaceLoading"
          :loading="workspaceLoading"
          size="default"
          @change="handleWorkspaceChange"
        >
          <el-option
            v-for="item in workspaceOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <span v-if="workspaceErrorMessage" class="api-automation-page__workspace-error">
          {{ workspaceErrorMessage }}
        </span>
      </div>
    </template>

    <div class="api-automation-page">
      <div class="api-automation-page__toolbar">
        <el-input
          v-model="filter.keyword"
          class="api-automation-page__search"
          clearable
          :prefix-icon="Search"
          placeholder="搜索接口名称 / 路径 / 标签"
        />
        <el-button @click="resetFilters">重置</el-button>
      </div>

      <ApiAutomationSummaryPanel :stats="stats" :loading="modulesLoading" />

      <div v-if="workspaceReady" class="api-automation-page__content">
        <ApiDefinitionTree
          :modules="modules"
          :loading="modulesLoading"
          :error-message="modulesErrorMessage"
          :selected-node-id="selectedNodeId"
          :total-count="definitions.length"
          @select="handleModuleSelect"
          @retry="loadModules"
        />
        <div class="api-automation-page__main">
          <ApiDefinitionListPanel
            :workspace-code="workspaceCode"
            :filter="filter"
            :modules="modules"
            :selected-module-id="selectedModuleId"
            :selected-definition-id="selectedDefinition?.id"
            @loaded="definitions = $event"
            @select="selectedDefinition = $event"
          />
          <ApiCaseListPanel
            :workspace-code="workspaceCode"
            :definition="selectedDefinition"
            :keyword="filter.keyword"
            @loaded="cases = $event"
          />
        </div>
      </div>
    </div>
  </AppPage>
</template>

<style scoped>
.api-automation-page {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-4);
}

.api-automation-page__workspace-select {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
}

.api-automation-page__workspace-label {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.api-automation-page__workspace-control {
  width: 192px;
}

.api-automation-page__workspace-error {
  max-width: 180px;
  overflow: hidden;
  padding: 2px var(--app-space-2);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-sm);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-automation-page__toolbar {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.api-automation-page__search {
  width: min(420px, 100%);
}

.api-automation-page__content {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: var(--app-space-4);
}

.api-automation-page__main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--app-space-4);
}

@media (max-width: 980px) {
  .api-automation-page__content {
    flex-direction: column;
  }
}

@media (max-width: 720px) {
  .api-automation-page__workspace-select,
  .api-automation-page__toolbar {
    width: 100%;
    flex-wrap: wrap;
  }

  .api-automation-page__workspace-control {
    width: min(240px, 100%);
  }

  .api-automation-page__search {
    width: 100%;
  }
}
</style>

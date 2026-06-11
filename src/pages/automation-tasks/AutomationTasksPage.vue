<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import type {
  AutomationTaskClientFilter,
  AutomationTaskEngineType,
  AutomationTaskSummaryItem,
} from '@/entities/automation-task'
import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import { AutomationTaskFilterPanel } from '@/widgets/automation-task-filter-panel'
import { AutomationTaskListPanel } from '@/widgets/automation-task-list-panel'
import { AutomationTaskSummaryPanel } from '@/widgets/automation-task-summary-panel'

const route = useRoute()
const workspaceCode = ref('ALL')
const workspaceSelectorCode = ref('ALL')
const workspaces = ref<WorkspaceItem[]>([])
const workspaceLoading = ref(false)
const workspaceErrorMessage = ref('')
const currentTasks = ref<AutomationTaskSummaryItem[]>([])
const filter = ref<AutomationTaskClientFilter>({
  keyword: '',
  status: '',
})

const engineType = computed<AutomationTaskEngineType>(() => {
  return route.name === 'automation-app' ? 'APP' : 'WEB'
})

const pageTitle = computed(() => (engineType.value === 'APP' ? 'APP 自动化' : 'Web UI 自动化'))
const pageDescription = computed(() => (
  engineType.value === 'APP'
    ? '按工作空间查看 APP 自动化任务；当前阶段先接入真实任务读取闭环。'
    : '按工作空间查看 Web UI 自动化任务；当前阶段先接入真实任务读取闭环。'
))

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

function resolveDefaultWorkspaceCode(items: WorkspaceItem[]) {
  const selected = items.find((item) => item.current || item.isCurrent || item.default || item.isDefault)
  return selected?.workspaceCode || items[0]?.workspaceCode || 'ALL'
}

async function loadWorkspaces() {
  workspaceLoading.value = true
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
  }
}

function handleWorkspaceChange(value: string) {
  workspaceCode.value = value
}

function resetFilters() {
  filter.value = {
    keyword: '',
    status: '',
  }
}

onMounted(() => {
  void loadWorkspaces()
})
</script>

<template>
  <AppPage :title="pageTitle" :description="pageDescription" fill>
    <template #actions>
      <div class="automation-tasks-workspace-select">
        <span class="automation-tasks-workspace-select__label">工作空间</span>
        <el-select
          v-model="workspaceSelectorCode"
          class="automation-tasks-workspace-select__control"
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
        <span v-if="workspaceErrorMessage" class="automation-tasks-workspace-select__error">
          {{ workspaceErrorMessage }}
        </span>
      </div>
    </template>

    <div class="automation-tasks-page">
      <AutomationTaskFilterPanel v-model="filter" @reset="resetFilters" />
      <AutomationTaskSummaryPanel :items="currentTasks" />
      <AutomationTaskListPanel
        :workspace-code="workspaceCode"
        :engine-type="engineType"
        :filter="filter"
        @loaded="currentTasks = $event"
      />
    </div>
  </AppPage>
</template>

<style scoped>
.automation-tasks-page {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-4);
}

.automation-tasks-workspace-select {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
}

.automation-tasks-workspace-select__label {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.automation-tasks-workspace-select__control {
  width: 192px;
}

.automation-tasks-workspace-select__error {
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

@media (max-width: 720px) {
  .automation-tasks-workspace-select {
    width: 100%;
    flex-wrap: wrap;
  }

  .automation-tasks-workspace-select__control {
    width: min(240px, 100%);
  }
}
</style>

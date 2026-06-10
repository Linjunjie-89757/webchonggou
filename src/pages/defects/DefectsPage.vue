<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { defectApi, type DefectClientFilter, type DefectStatistics, type DefectSummaryItem } from '@/entities/defect'
import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import { DefectFilterPanel } from '@/widgets/defect-filter-panel'
import { DefectListPanel } from '@/widgets/defect-list-panel'
import { DefectSummaryPanel } from '@/widgets/defect-summary-panel'

const workspaceCode = ref('ALL')
const workspaceSelectorCode = ref('ALL')
const workspaces = ref<WorkspaceItem[]>([])
const workspaceLoading = ref(false)
const workspaceErrorMessage = ref('')
const statistics = ref<DefectStatistics | null>(null)
const statisticsLoading = ref(false)
const statisticsErrorMessage = ref('')
const currentDefects = ref<DefectSummaryItem[]>([])
const filter = ref<DefectClientFilter>({
  keyword: '',
  status: '',
  priority: '',
  severity: '',
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

async function loadStatistics() {
  statisticsLoading.value = true
  statisticsErrorMessage.value = ''
  try {
    statistics.value = await defectApi.getDefectStatistics(workspaceCode.value)
  } catch (error) {
    statisticsErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    statisticsLoading.value = false
  }
}

function handleWorkspaceChange(value: string) {
  workspaceCode.value = value
  void loadStatistics()
}

function resetFilters() {
  filter.value = {
    keyword: '',
    status: '',
    priority: '',
    severity: '',
  }
}

onMounted(() => {
  void (async () => {
    await loadWorkspaces()
    await loadStatistics()
  })()
})
</script>

<template>
  <AppPage
    title="缺陷管理"
    description="按工作空间查看缺陷、统计状态和基础筛选；当前阶段先接入真实读取闭环。"
  >
    <template #actions>
      <div class="defects-workspace-select">
        <span class="defects-workspace-select__label">工作空间</span>
        <el-select
          v-model="workspaceSelectorCode"
          class="defects-workspace-select__control"
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
        <span v-if="workspaceErrorMessage" class="defects-workspace-select__error">
          {{ workspaceErrorMessage }}
        </span>
      </div>
    </template>

    <div class="defects-page">
      <DefectFilterPanel v-model="filter" @reset="resetFilters" />
      <DefectSummaryPanel
        :statistics="statistics"
        :loading="statisticsLoading"
        :error-message="statisticsErrorMessage"
        @retry="loadStatistics"
      />
      <DefectListPanel
        :workspace-code="workspaceCode"
        :filter="filter"
        @loaded="currentDefects = $event"
      />
    </div>
  </AppPage>
</template>

<style scoped>
.defects-page {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-4);
}

.defects-workspace-select {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
}

.defects-workspace-select__label {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.defects-workspace-select__control {
  width: 192px;
}

.defects-workspace-select__error {
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
  .defects-workspace-select {
    width: 100%;
    flex-wrap: wrap;
  }

  .defects-workspace-select__control {
    width: min(240px, 100%);
  }
}
</style>

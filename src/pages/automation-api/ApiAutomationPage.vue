<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import type {
  ApiDefinitionCaseItem,
  ApiDefinitionItem,
  ApiDefinitionModuleItem,
} from '@/entities/api-automation'
import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import { ApiInterfaceWorkspace } from '@/widgets/api-interface-workspace'

const workspaceCode = ref('ALL')
const workspaceSelectorCode = ref('ALL')
const workspaces = ref<WorkspaceItem[]>([])
const workspaceLoading = ref(false)
const workspaceReady = ref(false)
const workspaceErrorMessage = ref('')

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

function handleWorkspaceChange(value: string) {
  workspaceCode.value = value
}

function handleWorkspaceDataLoaded(
  _payload: { definitions: ApiDefinitionItem[]; modules: ApiDefinitionModuleItem[]; cases: ApiDefinitionCaseItem[] },
) {}

onMounted(() => {
  void loadWorkspaces()
})
</script>

<template>
  <AppPage
    title="接口自动化"
    description="先接入接口模块、接口定义和接口用例读取闭环，后续再补齐编辑、调试和场景编排。"
    fill
  >
    <div class="api-automation-page">
      <div class="api-automation-page__header">
        <div>
          <h1>接口自动化</h1>
        </div>
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
      </div>
      <ApiInterfaceWorkspace
        :workspace-code="workspaceCode"
        :workspace-ready="workspaceReady"
        @loaded="handleWorkspaceDataLoaded"
      />
    </div>
  </AppPage>
</template>

<style scoped>
.api-automation-page {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--app-space-3);
}

.api-automation-page__header {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.api-automation-page__header h1 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 20px;
  font-weight: 800;
  line-height: 28px;
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

@media (max-width: 720px) {
  .api-automation-page__header,
  .api-automation-page__workspace-select {
    width: 100%;
    flex-wrap: wrap;
  }

  .api-automation-page__workspace-control {
    width: min(240px, 100%);
  }
}
</style>

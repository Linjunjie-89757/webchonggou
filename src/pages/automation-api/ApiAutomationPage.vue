<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import type {
  ApiDefinitionCaseItem,
  ApiDefinitionItem,
  ApiDefinitionModuleItem,
} from '@/entities/api-automation'
import { useWorkspaceContext, workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import { ApiInterfaceWorkspace } from '@/widgets/api-interface-workspace'

const workspaceCode = ref('ALL')
const workspaces = ref<WorkspaceItem[]>([])
const workspaceReady = ref(false)
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()

function isKnownWorkspaceCode(workspaceCode: string, items: WorkspaceItem[]) {
  return workspaceCode === 'ALL' || items.some(item => item.workspaceCode === workspaceCode)
}

function resolveDefaultWorkspaceCode(items: WorkspaceItem[]) {
  if (selectedWorkspaceCode.value && isKnownWorkspaceCode(selectedWorkspaceCode.value, items)) {
    return selectedWorkspaceCode.value
  }

  const selected = items.find((item) => item.current || item.isCurrent || item.default || item.isDefault)
  return selected?.workspaceCode || items[0]?.workspaceCode || 'ALL'
}

async function loadWorkspaces() {
  workspaceReady.value = false
  try {
    const items = await workspaceApi.getSwitchableWorkspaces()
    workspaces.value = items
    workspaceCode.value = resolveDefaultWorkspaceCode(items)
    setSelectedWorkspaceCode(workspaceCode.value)
  } catch {
    workspaceCode.value = 'ALL'
  } finally {
    workspaceReady.value = true
  }
}

function handleWorkspaceDataLoaded(
  _payload: { definitions: ApiDefinitionItem[]; modules: ApiDefinitionModuleItem[]; cases: ApiDefinitionCaseItem[] },
) {}

onMounted(() => {
  void loadWorkspaces()
})

watch(selectedWorkspaceCode, (value) => {
  if (!workspaceReady.value || !value || value === workspaceCode.value || !isKnownWorkspaceCode(value, workspaces.value)) {
    return
  }

  workspaceCode.value = value
})
</script>

<template>
  <AppPage
    title="接口自动化"
    description="先接入接口模块、接口定义和接口用例读取闭环，后续再补齐编辑、调试和场景编排。"
    fill
  >
    <div class="api-automation-page">
      <ApiInterfaceWorkspace
        :workspace-code="workspaceCode"
        :workspace-ready="workspaceReady"
        :workspaces="workspaces"
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
}
</style>

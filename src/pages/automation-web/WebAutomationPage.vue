<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { useWorkspaceContext, workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import { WebUiCaseWorkspace } from '@/widgets/web-ui-case-workspace'

const workspaceCode = ref('ALL')
const workspaces = ref<WorkspaceItem[]>([])
const workspaceReady = ref(false)
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()

function isKnownWorkspaceCode(workspaceCode: string, items: WorkspaceItem[]) {
  return workspaceCode === 'ALL' || items.some(item => item.workspaceCode === workspaceCode)
}

function firstWritableWorkspaceCode(items: WorkspaceItem[]) {
  return items.find(item => item.workspaceCode !== 'ALL' && !item.allScope)?.workspaceCode || 'ALL'
}

function resolveDefaultWorkspaceCode(items: WorkspaceItem[]) {
  if (
    selectedWorkspaceCode.value
    && selectedWorkspaceCode.value !== 'ALL'
    && isKnownWorkspaceCode(selectedWorkspaceCode.value, items)
  ) {
    return selectedWorkspaceCode.value
  }

  const selected = items.find((item) =>
    item.workspaceCode !== 'ALL'
    && !item.allScope
    && (item.current || item.isCurrent || item.default || item.isDefault)
  )
  return selected?.workspaceCode || firstWritableWorkspaceCode(items)
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

onMounted(() => {
  void loadWorkspaces()
})

watch(selectedWorkspaceCode, (value) => {
  if (!workspaceReady.value || !value || value === workspaceCode.value || !isKnownWorkspaceCode(value, workspaces.value)) {
    return
  }

  workspaceCode.value = value === 'ALL' ? firstWritableWorkspaceCode(workspaces.value) : value
})
</script>

<template>
  <AppPage
    title="Web UI 自动化"
    description="管理 Web UI 自动化用例、步骤和环境配置基础资产。"
    fill
  >
    <div class="web-automation-page">
      <WebUiCaseWorkspace
        :workspace-code="workspaceCode"
        :workspace-ready="workspaceReady"
        :workspaces="workspaces"
      />
    </div>
  </AppPage>
</template>

<style scoped>
.web-automation-page {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}
</style>

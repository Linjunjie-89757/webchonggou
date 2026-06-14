<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  caseApi,
  type CaseClientFilter,
  type CaseDirectoryWorkspace,
  type CaseSummaryItem,
} from '@/entities/case'
import { workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppPage from '@/shared/ui/app-page/AppPage.vue'
import CaseDirectoryTree from '@/widgets/case-directory-tree/CaseDirectoryTree.vue'
import CaseFilterPanel from '@/widgets/case-filter-panel/CaseFilterPanel.vue'
import CaseListPanel from '@/widgets/case-list-panel/CaseListPanel.vue'

const workspaceCode = ref('ALL')
const workspaces = ref<WorkspaceItem[]>([])
const workspaceLoading = ref(false)
const workspaceErrorMessage = ref('')
const workspaceSelectorCode = ref('ALL')
const selectedNodeId = ref('root')
const selectedDirectoryId = ref<number | null>(null)
const directories = ref<CaseDirectoryWorkspace[]>([])
const directoriesLoading = ref(false)
const directoriesErrorMessage = ref('')
const currentPageCases = ref<CaseSummaryItem[]>([])
const caseListRef = ref<InstanceType<typeof CaseListPanel> | null>(null)
const moduleDialogVisible = ref(false)
const moduleDialogMode = ref<'create' | 'rename'>('create')
const moduleSaving = ref(false)
const activeDirectoryNode = ref<{
  nodeId: string
  workspaceCode: string
  directoryId: number | null
  label: string
  type?: 'root' | 'workspace' | 'module'
} | null>(null)
const moduleForm = reactive({
  name: '',
})
const filter = ref<CaseClientFilter>({
  keyword: '',
  priority: '',
  reviewStatus: '',
  executionStatus: '',
  executorName: '',
  createdByName: '',
  workspaceCode: '',
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

const businessWorkspaceOptions = computed(() => workspaceOptions.value.filter(item => item.value !== 'ALL'))

const currentPageUserNames = computed(() => {
  const names = new Set<string>()
  currentPageCases.value.forEach((item) => {
    if (item.executorName) {
      names.add(item.executorName)
    }
    if (item.createdByName) {
      names.add(item.createdByName)
    }
  })
  return [...names]
})

const executorOptions = computed(() => currentPageUserNames.value)
const creatorOptions = computed(() => currentPageUserNames.value)
const moduleDialogTitle = computed(() => (moduleDialogMode.value === 'create' ? '新建子模块' : '重命名子模块'))
const moduleSubmitDisabled = computed(() => !moduleForm.name.trim() || moduleSaving.value)

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

async function loadDirectories() {
  directoriesLoading.value = true
  directoriesErrorMessage.value = ''
  try {
    const items = await caseApi.getCaseDirectories(workspaceCode.value)
    directories.value = Array.isArray(items) ? items : []
  } catch (error) {
    directoriesErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    directoriesLoading.value = false
  }
}

function handleDirectorySelect(payload: { nodeId: string; workspaceCode: string; directoryId: number | null }) {
  const workspaceChanged = payload.workspaceCode !== workspaceCode.value
  selectedNodeId.value = payload.nodeId
  workspaceCode.value = payload.workspaceCode
  workspaceSelectorCode.value = payload.workspaceCode
  selectedDirectoryId.value = payload.directoryId
  if (workspaceChanged) {
    void loadDirectories()
  }
}

function handleWorkspaceChange(value: string) {
  workspaceCode.value = value
  selectedNodeId.value = 'root'
  selectedDirectoryId.value = null
  void loadDirectories()
}

function resetFilters() {
  filter.value = {
    keyword: '',
    priority: '',
    reviewStatus: '',
    executionStatus: '',
    executorName: '',
    createdByName: '',
    workspaceCode: '',
  }
}

function openCreateCase() {
  caseListRef.value?.openCreateDialog()
}

function openCreateModule(payload: { nodeId: string; workspaceCode: string; directoryId: number | null; label: string; type: 'root' | 'workspace' | 'module' }) {
  activeDirectoryNode.value = payload
  selectedNodeId.value = payload.nodeId
  moduleDialogMode.value = 'create'
  moduleForm.name = ''
  moduleDialogVisible.value = true
}

function openRenameModule(payload: { nodeId: string; workspaceCode: string; directoryId: number; label: string }) {
  activeDirectoryNode.value = {
    ...payload,
    type: 'module',
  }
  selectedNodeId.value = payload.nodeId
  moduleDialogMode.value = 'rename'
  moduleForm.name = payload.label
  moduleDialogVisible.value = true
}

async function refreshCasesAfterDirectoryChange() {
  await loadDirectories()
  caseListRef.value?.reload()
}

async function submitModule() {
  const node = activeDirectoryNode.value
  if (!node || moduleSubmitDisabled.value) {
    return
  }

  moduleSaving.value = true
  try {
    if (moduleDialogMode.value === 'rename') {
      if (node.directoryId === null) {
        return
      }
      await caseApi.renameCaseDirectory(node.directoryId, node.workspaceCode, {
        name: moduleForm.name.trim(),
      })
      ElMessage.success('目录已重命名')
    } else {
      await caseApi.createCaseDirectory(node.workspaceCode, {
        workspaceCode: workspaceCode.value === 'ALL' ? node.workspaceCode : undefined,
        parentId: node.type === 'workspace' ? null : node.directoryId,
        name: moduleForm.name.trim(),
      })
      ElMessage.success('子模块已创建')
    }
    moduleDialogVisible.value = false
    await refreshCasesAfterDirectoryChange()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    moduleSaving.value = false
  }
}

async function deleteModule(payload: { nodeId: string; workspaceCode: string; directoryId: number; label: string }) {
  try {
    await ElMessageBox.confirm(`确认删除模块“${payload.label}”吗？`, '删除模块', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await caseApi.deleteCaseDirectory(payload.directoryId, payload.workspaceCode)
    if (selectedNodeId.value === payload.nodeId) {
      selectedNodeId.value = `workspace:${payload.workspaceCode}`
      selectedDirectoryId.value = null
    }
    ElMessage.success('子模块已删除')
    await refreshCasesAfterDirectoryChange()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

onMounted(() => {
  void (async () => {
    await loadWorkspaces()
    await loadDirectories()
  })()
})
</script>

<template>
  <AppPage
    title="用例中心"
    description=""
  >
    <template #actions>
      <div class="cases-workspace-select">
        <span class="cases-workspace-select__label">工作空间</span>
        <el-select
          v-model="workspaceSelectorCode"
          class="cases-workspace-select__control"
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
        <span v-if="workspaceErrorMessage" class="cases-workspace-select__error">
          {{ workspaceErrorMessage }}
        </span>
      </div>
    </template>

    <div class="cases-page">
      <CaseDirectoryTree
        :directories="directories"
        :loading="directoriesLoading"
        :selected-node-id="selectedNodeId"
        :current-workspace-code="workspaceCode"
        @select="handleDirectorySelect"
        @create-child="openCreateModule"
        @rename="openRenameModule"
        @delete="deleteModule"
      />

      <main class="cases-page__content">
        <AppEmptyState
          v-if="directoriesErrorMessage && !directories.length"
          title="用例目录加载失败"
          :description="directoriesErrorMessage"
        >
          <template #actions>
            <AppButton :icon="RefreshRight" @click="loadDirectories">重试</AppButton>
          </template>
        </AppEmptyState>

        <div v-else class="cases-page__stack">
          <div v-if="directoriesErrorMessage" class="cases-page__inline-error">
            {{ directoriesErrorMessage }}
            <AppButton size="small" :icon="RefreshRight" @click="loadDirectories">重试</AppButton>
          </div>

          <section class="cases-page__workbench">
            <header class="cases-page__toolbar">
              <CaseFilterPanel
                v-model="filter"
                :executor-options="executorOptions"
                :creator-options="creatorOptions"
                :workspace-options="businessWorkspaceOptions"
                :show-workspace-filter="workspaceCode === 'ALL'"
                @reset="resetFilters"
              />
              <AppButton :icon="Plus" type="primary" class="cases-page__create-button" @click="openCreateCase">
                新建用例
              </AppButton>
            </header>

            <CaseListPanel
              ref="caseListRef"
              :workspace-code="workspaceCode"
              :directory-id="selectedDirectoryId"
              :filter="filter"
              :directories="directories"
              :show-toolbar="false"
              @loaded="currentPageCases = $event"
              @reload-directories="loadDirectories"
            />
          </section>
        </div>
      </main>
    </div>

    <el-dialog
      v-model="moduleDialogVisible"
      :title="moduleDialogTitle"
      width="420px"
      append-to-body
    >
      <div class="case-module-dialog">
        <div class="case-module-dialog__meta">
          所属位置：{{ activeDirectoryNode?.label || '-' }}
        </div>
        <label class="case-module-dialog__field">
          <span>模块名称</span>
          <el-input
            v-model="moduleForm.name"
            maxlength="30"
            show-word-limit
            placeholder="请输入模块名称"
            @keydown.enter.prevent="submitModule"
          />
        </label>
      </div>

      <template #footer>
        <AppButton :disabled="moduleSaving" @click="moduleDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="moduleSaving" :disabled="moduleSubmitDisabled" @click="submitModule">
          {{ moduleDialogMode === 'create' ? '创建' : '保存' }}
        </AppButton>
      </template>
    </el-dialog>
  </AppPage>
</template>

<style scoped>
.cases-page {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
}

.cases-page__content {
  min-width: 0;
  flex: 1;
}

.cases-page__stack {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.cases-page__workbench {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
}

.cases-page__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  min-height: 84px;
  padding: var(--app-space-5) var(--app-space-6) var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.cases-page__create-button {
  flex: 0 0 auto;
}

.cases-page__inline-error {
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

.cases-workspace-select {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
}

.cases-workspace-select__label {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.cases-workspace-select__control {
  width: 192px;
}

.cases-workspace-select__error {
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

.case-module-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.case-module-dialog__meta {
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.case-module-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.case-module-dialog__field span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

@media (max-width: 900px) {
  .cases-page {
    flex-direction: column;
  }

  .cases-page__content {
    width: 100%;
  }
}

@media (max-width: 1200px) {
  .cases-workspace-select__control {
    width: 168px;
  }
}

@media (max-width: 720px) {
  .cases-workspace-select {
    flex-wrap: wrap;
  }

  .cases-workspace-select__control {
    width: min(240px, 100%);
  }
}

</style>

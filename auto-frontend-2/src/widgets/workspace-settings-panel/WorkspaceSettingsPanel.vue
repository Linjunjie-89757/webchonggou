<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Edit, Plus, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import { workspaceApi, type SaveWorkspacePayload, type WorkspaceItem } from '@/entities/workspace'
import {
  formatUserWorkspaceNames,
  getUserDisplayName,
  getUserRoleLabel,
  getUserStatusMeta,
  type UserItem,
  userApi,
} from '@/entities/user'
import { WorkspaceCreateEditDialog, type WorkspaceDialogMode } from '@/features/workspace-create-edit'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppStatusBadge from '@/shared/ui/app-status-badge/AppStatusBadge.vue'

const workspaces = ref<WorkspaceItem[]>([])
const users = ref<UserItem[]>([])
const workspaceLoading = ref(false)
const userLoading = ref(false)
const savingWorkspace = ref(false)
const workspaceErrorMessage = ref('')
const userErrorMessage = ref('')
const workspaceDialogVisible = ref(false)
const workspaceDialogMode = ref<WorkspaceDialogMode>('create')
const editingWorkspace = ref<WorkspaceItem | null>(null)

const businessWorkspaces = computed(() => workspaces.value.filter((item) => !item.allScope && item.workspaceCode !== 'ALL'))

const workspaceStats = computed(() => [
  { label: '空间总数', value: businessWorkspaces.value.length },
  { label: '启用空间', value: businessWorkspaces.value.filter((item) => Number(item.status) !== 0).length },
  { label: '用户总数', value: users.value.length },
  { label: '启用用户', value: users.value.filter((item) => Number(item.status) === 1).length },
])

function getWorkspaceStatusMeta(status?: number | string | null) {
  if (Number(status) === 0) {
    return { label: '停用', tone: 'danger' as const }
  }
  return { label: '启用', tone: 'success' as const }
}

function formatDateTime(value?: string | null) {
  return value ? value.replace('T', ' ').slice(0, 16) : '-'
}

async function loadWorkspaces() {
  workspaceLoading.value = true
  workspaceErrorMessage.value = ''
  try {
    workspaces.value = await workspaceApi.getWorkspaces()
  } catch (error) {
    workspaceErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    workspaceLoading.value = false
  }
}

async function loadUsers() {
  userLoading.value = true
  userErrorMessage.value = ''
  try {
    users.value = await userApi.getUsers()
  } catch (error) {
    userErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    userLoading.value = false
  }
}

function reloadAll() {
  void loadWorkspaces()
  void loadUsers()
}

function openCreateWorkspaceDialog() {
  workspaceDialogMode.value = 'create'
  editingWorkspace.value = null
  workspaceDialogVisible.value = true
}

function openEditWorkspaceDialog(workspace: WorkspaceItem) {
  workspaceDialogMode.value = 'edit'
  editingWorkspace.value = workspace
  workspaceDialogVisible.value = true
}

async function submitWorkspace(payload: SaveWorkspacePayload) {
  savingWorkspace.value = true
  try {
    if (workspaceDialogMode.value === 'edit' && editingWorkspace.value) {
      await workspaceApi.updateWorkspace(editingWorkspace.value.workspaceCode, payload)
      ElMessage.success('工作空间已更新')
    } else {
      await workspaceApi.createWorkspace(payload)
      ElMessage.success('工作空间已创建')
    }
    workspaceDialogVisible.value = false
    await loadWorkspaces()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingWorkspace.value = false
  }
}

onMounted(() => {
  reloadAll()
})
</script>

<template>
  <section class="workspace-settings-panel">
    <header class="settings-panel-header">
      <div>
        <h2>工作空间设置</h2>
        <p>查看平台工作空间和用户账号概览，成员管理写操作后续单独接入。</p>
      </div>
      <div class="settings-panel-header__actions">
        <AppButton
          :icon="RefreshRight"
          :loading="workspaceLoading || userLoading"
          @click="reloadAll"
        >
          刷新
        </AppButton>
        <AppButton type="primary" :icon="Plus" @click="openCreateWorkspaceDialog">新增空间</AppButton>
      </div>
    </header>

    <div class="settings-stat-grid">
      <div v-for="item in workspaceStats" :key="item.label" class="settings-stat">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <div class="settings-panel-block">
      <div class="settings-panel-block__header">
        <h3>工作空间</h3>
        <div class="settings-panel-block__actions">
          <span v-if="workspaceErrorMessage && businessWorkspaces.length > 0" class="settings-inline-error">
            {{ workspaceErrorMessage }}
          </span>
          <AppButton size="small" type="primary" :icon="Plus" @click="openCreateWorkspaceDialog">新增空间</AppButton>
        </div>
      </div>

      <AppLoadingState v-if="workspaceLoading && businessWorkspaces.length === 0" text="正在加载工作空间" />

      <AppEmptyState
        v-else-if="workspaceErrorMessage && businessWorkspaces.length === 0"
        title="工作空间加载失败"
        :description="workspaceErrorMessage"
      >
        <template #actions>
          <AppButton :icon="RefreshRight" @click="loadWorkspaces">重试</AppButton>
        </template>
      </AppEmptyState>

      <AppEmptyState
        v-else-if="businessWorkspaces.length === 0"
        title="暂无工作空间"
        description="当前平台暂无可展示的业务工作空间。"
      >
        <template #actions>
          <AppButton type="primary" :icon="Plus" @click="openCreateWorkspaceDialog">新增空间</AppButton>
        </template>
      </AppEmptyState>

      <el-table v-else v-loading="workspaceLoading" :data="businessWorkspaces" class="settings-table" row-key="workspaceCode">
        <el-table-column prop="workspaceName" label="空间名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="workspaceCode" label="空间编码" min-width="130" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }: { row: WorkspaceItem }">
            <AppStatusBadge
              :label="getWorkspaceStatusMeta(row.status).label"
              :tone="getWorkspaceStatusMeta(row.status).tone"
            />
          </template>
        </el-table-column>
        <el-table-column prop="ownerName" label="负责人" min-width="120" show-overflow-tooltip>
          <template #default="{ row }: { row: WorkspaceItem }">
            {{ row.ownerName || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="workspaceType" label="类型" min-width="110" show-overflow-tooltip>
          <template #default="{ row }: { row: WorkspaceItem }">
            {{ row.workspaceType || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip>
          <template #default="{ row }: { row: WorkspaceItem }">
            {{ row.description || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="150">
          <template #default="{ row }: { row: WorkspaceItem }">
            {{ formatDateTime(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="88" fixed="right">
          <template #default="{ row }: { row: WorkspaceItem }">
            <button
              type="button"
              class="workspace-action-button"
              aria-label="编辑空间"
              @click="openEditWorkspaceDialog(row)"
            >
              <el-icon><Edit /></el-icon>
              <span>编辑</span>
            </button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="settings-panel-block">
      <div class="settings-panel-block__header">
        <h3>用户账号</h3>
        <span v-if="userErrorMessage && users.length > 0" class="settings-inline-error">
          {{ userErrorMessage }}
        </span>
      </div>

      <AppLoadingState v-if="userLoading && users.length === 0" text="正在加载用户账号" />

      <AppEmptyState
        v-else-if="userErrorMessage && users.length === 0"
        title="用户账号加载失败"
        :description="userErrorMessage"
      >
        <template #actions>
          <AppButton :icon="RefreshRight" @click="loadUsers">重试</AppButton>
        </template>
      </AppEmptyState>

      <AppEmptyState
        v-else-if="users.length === 0"
        title="暂无用户账号"
        description="当前平台暂无可展示的用户账号。"
      />

      <el-table v-else v-loading="userLoading" :data="users" class="settings-table" row-key="id">
        <el-table-column label="姓名" min-width="140" show-overflow-tooltip>
          <template #default="{ row }: { row: UserItem }">
            {{ getUserDisplayName(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="username" label="账号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column label="角色" min-width="120">
          <template #default="{ row }: { row: UserItem }">
            {{ getUserRoleLabel(row.roleCode) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }: { row: UserItem }">
            <AppStatusBadge
              :label="getUserStatusMeta(row.status).label"
              :tone="getUserStatusMeta(row.status).tone"
            />
          </template>
        </el-table-column>
        <el-table-column label="所属空间" min-width="180" show-overflow-tooltip>
          <template #default="{ row }: { row: UserItem }">
            {{ formatUserWorkspaceNames(row.workspaceNames) }}
          </template>
        </el-table-column>
      </el-table>
    </div>

    <WorkspaceCreateEditDialog
      v-model="workspaceDialogVisible"
      :mode="workspaceDialogMode"
      :workspace="editingWorkspace"
      :saving="savingWorkspace"
      @submit="submitWorkspace"
    />
  </section>
</template>

<style scoped>
.workspace-settings-panel {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
}

.settings-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.settings-panel-header__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.settings-panel-header h2 {
  margin: 0;
  font-size: var(--app-font-size-xl);
  line-height: 26px;
}

.settings-panel-header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.settings-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.settings-stat {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-1);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.settings-stat span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.settings-stat strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
  line-height: 26px;
}

.settings-panel-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
}

.settings-panel-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.settings-panel-block__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.settings-panel-block h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-lg);
}

.settings-inline-error {
  max-width: 360px;
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

.settings-table {
  width: 100%;
}

.workspace-action-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 0 var(--app-space-2);
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  transition: background-color 160ms ease;
}

.workspace-action-button:hover {
  background: var(--app-primary-soft);
}

@media (max-width: 960px) {
  .settings-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .settings-panel-header,
  .settings-panel-block__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .settings-panel-header__actions,
  .settings-panel-block__actions {
    justify-content: flex-start;
  }

  .settings-stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>

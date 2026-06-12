<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Delete, Edit, Plus, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  workspaceApi,
  type CreateWorkspaceMemberPayload,
  type SaveWorkspacePayload,
  type UpdateWorkspaceMemberPayload,
  type WorkspaceItem,
  type WorkspaceMemberItem,
} from '@/entities/workspace'
import {
  formatUserWorkspaceNames,
  getUserDisplayName,
  getUserRoleLabel,
  getUserStatusMeta,
  type UpdateUserPayload,
  type UserItem,
  userApi,
} from '@/entities/user'
import { useSession } from '@/entities/session'
import { WorkspaceCreateEditDialog, type WorkspaceDialogMode } from '@/features/workspace-create-edit'
import {
  deleteWorkspaceMember,
  getWorkspaceMemberRoleLabel,
  WorkspaceMemberDialog,
  type WorkspaceMemberDialogMode,
} from '@/features/workspace-member-manage'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppStatusBadge from '@/shared/ui/app-status-badge/AppStatusBadge.vue'

type PanelMode = 'workspace' | 'team'

interface UserEditForm {
  email: string
  displayName: string
  roleCode: string
  status: number
  workspaceCodesText: string
}

const props = withDefaults(
  defineProps<{
    mode?: PanelMode
  }>(),
  {
    mode: 'workspace',
  },
)

const { currentUser } = useSession()
const workspaces = ref<WorkspaceItem[]>([])
const users = ref<UserItem[]>([])
const members = ref<WorkspaceMemberItem[]>([])
const workspaceLoading = ref(false)
const userLoading = ref(false)
const memberLoading = ref(false)
const savingWorkspace = ref(false)
const savingMember = ref(false)
const workspaceErrorMessage = ref('')
const userErrorMessage = ref('')
const memberErrorMessage = ref('')
const workspaceDialogVisible = ref(false)
const workspaceDialogMode = ref<WorkspaceDialogMode>('create')
const editingWorkspace = ref<WorkspaceItem | null>(null)
const memberWorkspaceCode = ref('')
const memberDialogVisible = ref(false)
const memberDialogMode = ref<WorkspaceMemberDialogMode>('create')
const editingMember = ref<WorkspaceMemberItem | null>(null)
const userDialogVisible = ref(false)
const editingUser = ref<UserItem | null>(null)
const savingUser = ref(false)
const mutatingUserIds = ref<Set<number>>(new Set())
const deletingMemberIds = ref<Set<number>>(new Set())
const userForm = ref<UserEditForm>({
  email: '',
  displayName: '',
  roleCode: 'MEMBER',
  status: 1,
  workspaceCodesText: '',
})

const businessWorkspaces = computed(() => workspaces.value.filter((item) => !item.allScope && item.workspaceCode !== 'ALL'))
const memberWorkspaceOptions = computed(() => businessWorkspaces.value.map((item) => ({
  label: item.workspaceName || item.workspaceCode,
  value: item.workspaceCode,
})))

const workspaceStats = computed(() => [
  { label: '空间总数', value: businessWorkspaces.value.length },
  { label: '启用空间', value: businessWorkspaces.value.filter((item) => Number(item.status) !== 0).length },
  { label: '用户总数', value: users.value.length },
  { label: '启用用户', value: users.value.filter((item) => Number(item.status) === 1).length },
])

const teamStats = computed(() => [
  { label: '用户总数', value: users.value.length },
  { label: '启用用户', value: users.value.filter((item) => Number(item.status) === 1).length },
  { label: '业务空间', value: businessWorkspaces.value.length },
  { label: '当前空间成员', value: members.value.length },
])
const isTeamMode = computed(() => props.mode === 'team')
const canManageUsers = computed(() => {
  const roleCode = String(currentUser.value?.roleCode || '').toUpperCase()
  return ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN'].includes(roleCode)
})
const isCurrentSuperAdmin = computed(() => String(currentUser.value?.roleCode || '').toUpperCase() === 'SUPER_ADMIN')
const panelTitle = computed(() => (isTeamMode.value ? '用户管理' : '工作空间设置'))
const panelDescription = computed(() => (
  isTeamMode.value
    ? '以用户账号为主线查看平台用户、空间成员与工作空间关联。'
    : '以工作空间为主线查看和维护平台空间、空间成员与用户概览。'
))
const visibleStats = computed(() => (isTeamMode.value ? teamStats.value : workspaceStats.value))

const userKeyword = ref('')
const userRoleFilter = ref('')
const userStatusFilter = ref('')
const userRoleOptions = computed(() => Array.from(new Set(users.value.map((user) => user.roleCode).filter(Boolean))).map((roleCode) => ({
  label: getUserRoleLabel(roleCode),
  value: roleCode,
})))
const userStatusOptions = computed(() => Array.from(new Set(users.value.map((user) => String(Number(user.status))).filter((status) => status === '0' || status === '1'))).map((status) => ({
  label: getUserStatusMeta(status).label,
  value: status,
})))
const filteredUsers = computed(() => {
  const keyword = userKeyword.value.trim().toLowerCase()
  const role = userRoleFilter.value
  const status = userStatusFilter.value

  return users.value.filter((user) => {
    const searchable = [
      getUserDisplayName(user),
      user.username,
      user.email,
      user.roleCode,
      getUserRoleLabel(user.roleCode),
      formatUserWorkspaceNames(user.workspaceNames),
    ].join(' ').toLowerCase()
    const matchesKeyword = !keyword || searchable.includes(keyword)
    const matchesRole = !role || user.roleCode === role
    const matchesStatus = !status || String(Number(user.status)) === status
    return matchesKeyword && matchesRole && matchesStatus
  })
})

function resetUserFilters() {
  userKeyword.value = ''
  userRoleFilter.value = ''
  userStatusFilter.value = ''
}

function workspaceDisplayName(workspace: WorkspaceItem) {
  return workspace.workspaceName || workspace.name || workspace.workspaceCode || workspace.code || '-'
}

function workspaceDisplayCode(workspace: WorkspaceItem) {
  return workspace.workspaceCode || workspace.code || '-'
}

function normalizeWorkspaceType(workspace: WorkspaceItem) {
  const type = String(workspace.workspaceType || '').toLowerCase()
  if (type.includes('team')) {
    return 'team'
  }
  if (type.includes('product')) {
    return 'product'
  }
  return 'project'
}

function getWorkspaceTypeLabel(workspace: WorkspaceItem) {
  const type = normalizeWorkspaceType(workspace)
  if (type === 'team') {
    return '团队空间'
  }
  if (type === 'product') {
    return '产品空间'
  }
  return '项目空间'
}

function getWorkspaceOwnerLabel(workspace: WorkspaceItem) {
  return workspace.ownerName || '未设置负责人'
}

function getUserInitial(user: UserItem | WorkspaceMemberItem) {
  const name = 'displayName' in user ? user.displayName : ''
  return (name || user.username || '-').slice(0, 1).toUpperCase()
}

function getWorkspaceStatusMeta(status?: number | string | null) {
  if (Number(status) === 0) {
    return { label: '停用', tone: 'danger' as const }
  }
  return { label: '启用', tone: 'success' as const }
}

function getUserRoleClass(roleCode?: string | null) {
  const normalizedRole = String(roleCode || '').toUpperCase()
  if (normalizedRole.includes('SUPER') || normalizedRole.includes('ADMIN')) {
    return 'is-admin'
  }
  if (normalizedRole.includes('MEMBER')) {
    return 'is-member'
  }
  return 'is-viewer'
}

function getUserStatusClass(status?: number | string | null) {
  return Number(status) === 1 ? '' : 'is-disabled'
}

function getUserMutableReason(user: UserItem) {
  if (!canManageUsers.value) {
    return '当前账号无用户维护权限'
  }
  if (String(user.roleCode || '').toUpperCase() === 'SUPER_ADMIN') {
    return '超级管理员账号不可在用户管理中维护'
  }
  return ''
}

function canMutateUser(user: UserItem) {
  return !getUserMutableReason(user)
}

function setMutatingUser(userId: number, mutating: boolean) {
  const nextIds = new Set(mutatingUserIds.value)
  if (mutating) {
    nextIds.add(userId)
  } else {
    nextIds.delete(userId)
  }
  mutatingUserIds.value = nextIds
}

function isUserMutating(userId: number) {
  return mutatingUserIds.value.has(userId)
}

function parseWorkspaceCodes(value: string) {
  return Array.from(new Set(value
    .split(/[\n,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)))
}

function buildUserUpdatePayload(user: UserItem, overrides: Partial<UpdateUserPayload> = {}): UpdateUserPayload {
  return {
    email: user.email,
    displayName: getUserDisplayName(user),
    roleCode: user.roleCode,
    status: Number(user.status),
    workspaceCodes: user.workspaceCodes ?? [],
    ...overrides,
  }
}

function openUserEdit(row: UserItem) {
  if (!canMutateUser(row)) {
    ElMessage.warning(getUserMutableReason(row))
    return
  }

  editingUser.value = row
  userForm.value = {
    email: row.email || '',
    displayName: getUserDisplayName(row) === '-' ? '' : getUserDisplayName(row),
    roleCode: row.roleCode || 'MEMBER',
    status: Number(row.status) === 0 ? 0 : 1,
    workspaceCodesText: (row.workspaceCodes ?? []).join(', '),
  }
  userDialogVisible.value = true
}

async function submitUserEdit() {
  if (!editingUser.value) {
    return
  }

  if (!userForm.value.email.trim()) {
    ElMessage.error('请填写邮箱')
    return
  }
  if (!userForm.value.displayName.trim()) {
    ElMessage.error('请填写姓名')
    return
  }
  if (!userForm.value.roleCode) {
    ElMessage.error('请选择角色')
    return
  }

  savingUser.value = true
  try {
    await userApi.updateUser(editingUser.value.id, buildUserUpdatePayload(editingUser.value, {
      email: userForm.value.email.trim(),
      displayName: userForm.value.displayName.trim(),
      roleCode: userForm.value.roleCode,
      status: userForm.value.status,
      workspaceCodes: parseWorkspaceCodes(userForm.value.workspaceCodesText),
    }))
    ElMessage.success('用户信息已更新')
    userDialogVisible.value = false
    await loadUsers()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingUser.value = false
  }
}

async function toggleUserStatus(row: UserItem) {
  const reason = getUserMutableReason(row)
  if (reason) {
    ElMessage.warning(reason)
    return
  }

  const nextStatus = Number(row.status) === 1 ? 0 : 1
  const actionText = nextStatus === 1 ? '启用' : '停用'

  setMutatingUser(row.id, true)
  try {
    await ElMessageBox.confirm(
      `确定${actionText}用户“${getUserDisplayName(row)}”吗？`,
      `${actionText}用户`,
      {
        confirmButtonText: actionText,
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: nextStatus === 0 ? 'el-button--danger' : undefined,
      },
    )
    await userApi.updateUser(row.id, buildUserUpdatePayload(row, { status: nextStatus }))
    ElMessage.success(`用户已${actionText}`)
    await loadUsers()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    setMutatingUser(row.id, false)
  }
}

async function resetUserPassword(row: UserItem) {
  const reason = getUserMutableReason(row)
  if (reason) {
    ElMessage.warning(reason)
    return
  }

  setMutatingUser(row.id, true)
  try {
    await ElMessageBox.confirm(
      `确定重置用户“${getUserDisplayName(row)}”的密码吗？`,
      '重置密码',
      {
        confirmButtonText: '重置',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    )
    const response = await userApi.resetUserPassword(row.id)
    ElMessage.success(`密码已重置为 ${response.defaultPassword}`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    setMutatingUser(row.id, false)
  }
}

function formatDateTime(value?: string | null) {
  return value ? value.replace('T', ' ').slice(0, 16) : '-'
}

async function loadWorkspaces() {
  workspaceLoading.value = true
  workspaceErrorMessage.value = ''
  try {
    const items = await workspaceApi.getWorkspaces()
    workspaces.value = items
    const nextBusinessWorkspaces = items.filter((item) => !item.allScope && item.workspaceCode !== 'ALL')
    if (!nextBusinessWorkspaces.some((item) => item.workspaceCode === memberWorkspaceCode.value)) {
      memberWorkspaceCode.value = nextBusinessWorkspaces[0]?.workspaceCode || ''
    } else {
      void loadMembers()
    }
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

async function loadMembers() {
  if (!memberWorkspaceCode.value) {
    members.value = []
    memberErrorMessage.value = ''
    return
  }

  memberLoading.value = true
  memberErrorMessage.value = ''
  try {
    members.value = await workspaceApi.getWorkspaceMembers(memberWorkspaceCode.value)
  } catch (error) {
    memberErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    memberLoading.value = false
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

function openCreateMemberDialog() {
  memberDialogMode.value = 'create'
  editingMember.value = null
  memberDialogVisible.value = true
}

function openEditMemberDialog(member: WorkspaceMemberItem) {
  memberDialogMode.value = 'edit'
  editingMember.value = member
  memberDialogVisible.value = true
}

function setDeletingMember(id: number, value: boolean) {
  const nextIds = new Set(deletingMemberIds.value)
  if (value) {
    nextIds.add(id)
  } else {
    nextIds.delete(id)
  }
  deletingMemberIds.value = nextIds
}

function isMemberDeleting(id: number) {
  return deletingMemberIds.value.has(id)
}

async function submitCreateMember(payload: CreateWorkspaceMemberPayload) {
  if (!memberWorkspaceCode.value) {
    return
  }

  savingMember.value = true
  try {
    await workspaceApi.createWorkspaceMember(memberWorkspaceCode.value, payload)
    ElMessage.success('成员已添加')
    memberDialogVisible.value = false
    await loadMembers()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingMember.value = false
  }
}

async function submitUpdateMember(payload: UpdateWorkspaceMemberPayload) {
  if (!memberWorkspaceCode.value || !editingMember.value) {
    return
  }

  savingMember.value = true
  try {
    await workspaceApi.updateWorkspaceMember(memberWorkspaceCode.value, editingMember.value.id, payload)
    ElMessage.success('成员角色已更新')
    memberDialogVisible.value = false
    await loadMembers()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingMember.value = false
  }
}

async function removeMember(member: WorkspaceMemberItem) {
  if (!memberWorkspaceCode.value) {
    return
  }

  setDeletingMember(member.id, true)
  try {
    await deleteWorkspaceMember(memberWorkspaceCode.value, member)
    ElMessage.success('成员已移除')
    await loadMembers()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    setDeletingMember(member.id, false)
  }
}

onMounted(() => {
  reloadAll()
})

watch(memberWorkspaceCode, () => {
  void loadMembers()
})
</script>

<template>
  <section class="workspace-settings-panel" :class="`is-${mode}-mode`">
    <header class="settings-panel-header">
      <div>
        <h2>{{ panelTitle }}</h2>
        <p>{{ panelDescription }}</p>
      </div>
      <div class="settings-panel-header__actions">
        <AppButton
          :icon="RefreshRight"
          :loading="workspaceLoading || userLoading"
          @click="reloadAll"
        >
          刷新
        </AppButton>
        <AppButton
          v-if="isTeamMode"
          type="primary"
          :icon="Plus"
          :disabled="!memberWorkspaceCode"
          @click="openCreateMemberDialog"
        >
          添加成员
        </AppButton>
        <AppButton v-else type="primary" :icon="Plus" @click="openCreateWorkspaceDialog">新增空间</AppButton>
      </div>
    </header>

    <div class="settings-stat-grid">
      <div v-for="item in visibleStats" :key="item.label" class="settings-stat">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <div class="settings-panel-block settings-panel-block--workspaces">
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

      <div v-else-if="!isTeamMode" class="workspace-card-grid">
        <article
          v-for="workspace in businessWorkspaces"
          :key="workspaceDisplayCode(workspace)"
          class="workspace-config-card"
          :class="[{ 'is-disabled': Number(workspace.status) === 0 }, `is-${normalizeWorkspaceType(workspace)}`]"
        >
          <div class="workspace-card-main">
            <div class="workspace-card-head">
              <div class="workspace-card-icon">
                {{ workspaceDisplayName(workspace).slice(0, 1).toUpperCase() }}
              </div>
              <div class="workspace-card-title">
                <div class="workspace-card-name-row">
                  <h3>{{ workspaceDisplayName(workspace) }}</h3>
                  <AppStatusBadge
                    :label="getWorkspaceStatusMeta(workspace.status).label"
                    :tone="getWorkspaceStatusMeta(workspace.status).tone"
                  />
                </div>
                <p>{{ workspace.description || '暂无空间说明' }}</p>
              </div>
            </div>
            <div class="workspace-card-actions">
              <button
                type="button"
                aria-label="编辑空间"
                @click="openEditWorkspaceDialog(workspace)"
              >
                <el-icon><Edit /></el-icon>
              </button>
            </div>
          </div>

          <footer class="workspace-card-meta">
            <span class="workspace-type-badge" :class="`is-${normalizeWorkspaceType(workspace)}`">
              {{ getWorkspaceTypeLabel(workspace) }}
            </span>
            <span>{{ getWorkspaceOwnerLabel(workspace) }}</span>
            <span>{{ workspaceDisplayCode(workspace) }}</span>
          </footer>
        </article>
      </div>

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

    <div class="settings-panel-block settings-panel-block--members">
      <div class="settings-panel-block__header">
        <div>
          <h3>成员管理</h3>
          <p class="settings-panel-block__description">选择工作空间后查看和维护成员角色。</p>
        </div>
        <div class="settings-panel-block__actions">
          <el-select
            v-model="memberWorkspaceCode"
            class="workspace-member-select"
            placeholder="选择工作空间"
            :disabled="workspaceLoading || memberWorkspaceOptions.length === 0"
          >
            <el-option
              v-for="item in memberWorkspaceOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <span v-if="memberErrorMessage && members.length > 0" class="settings-inline-error">
            {{ memberErrorMessage }}
          </span>
          <AppButton
            size="small"
            type="primary"
            :icon="Plus"
            :disabled="!memberWorkspaceCode"
            @click="openCreateMemberDialog"
          >
            添加成员
          </AppButton>
        </div>
      </div>

      <AppLoadingState v-if="memberLoading && members.length === 0" text="正在加载空间成员" />

      <AppEmptyState
        v-else-if="!memberWorkspaceCode"
        title="请选择工作空间"
        description="选择一个工作空间后查看成员列表。"
      />

      <AppEmptyState
        v-else-if="memberErrorMessage && members.length === 0"
        title="成员列表加载失败"
        :description="memberErrorMessage"
      >
        <template #actions>
          <AppButton :icon="RefreshRight" @click="loadMembers">重试</AppButton>
        </template>
      </AppEmptyState>

      <AppEmptyState
        v-else-if="members.length === 0"
        title="暂无空间成员"
        description="当前工作空间暂无可展示的成员。"
      >
        <template #actions>
          <AppButton type="primary" :icon="Plus" @click="openCreateMemberDialog">添加成员</AppButton>
        </template>
      </AppEmptyState>

      <el-table v-else v-loading="memberLoading" :data="members" class="settings-table" row-key="id">
        <el-table-column label="姓名" min-width="140" show-overflow-tooltip>
          <template #default="{ row }: { row: WorkspaceMemberItem }">
            <div class="team-member-cell">
              <div class="team-avatar">{{ getUserInitial(row) }}</div>
              <div>
                <strong>{{ row.displayName || row.username || '-' }}</strong>
                <p>{{ row.username }} · {{ row.email || '-' }}</p>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="账号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column label="角色" min-width="110">
          <template #default="{ row }: { row: WorkspaceMemberItem }">
            {{ getWorkspaceMemberRoleLabel(row.roleCode) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }: { row: WorkspaceMemberItem }">
            <AppStatusBadge
              :label="getUserStatusMeta(row.status).label"
              :tone="getUserStatusMeta(row.status).tone"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="146" fixed="right">
          <template #default="{ row }: { row: WorkspaceMemberItem }">
            <div class="workspace-member-actions">
              <button
                type="button"
                class="workspace-action-button"
                :disabled="isMemberDeleting(row.id)"
                aria-label="编辑成员"
                @click="openEditMemberDialog(row)"
              >
                <el-icon><Edit /></el-icon>
                <span>编辑</span>
              </button>
              <button
                type="button"
                class="workspace-action-button is-danger"
                :disabled="isMemberDeleting(row.id)"
                aria-label="移除成员"
                @click="removeMember(row)"
              >
                <el-icon><Delete /></el-icon>
                <span>{{ isMemberDeleting(row.id) ? '移除中' : '移除' }}</span>
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="settings-panel-block settings-panel-block--users">
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

      <div v-else-if="users.length === 0" class="team-empty-state">
        <div class="team-empty-state__icon" aria-hidden="true">
          <span>U</span>
        </div>
        <strong>暂无用户账号</strong>
        <p>当前平台暂无可展示的用户账号。</p>
      </div>

      <template v-else>
        <section class="team-filter-card">
          <label class="team-filter-field is-keyword">
            <span>关键词</span>
            <input v-model="userKeyword" type="search" placeholder="搜索姓名、账号、邮箱或空间" />
          </label>
          <label class="team-filter-field">
            <span>平台角色</span>
            <select v-model="userRoleFilter">
              <option value="">全部角色</option>
              <option v-for="option in userRoleOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <label class="team-filter-field">
            <span>状态</span>
            <select v-model="userStatusFilter">
              <option value="">全部状态</option>
              <option v-for="option in userStatusOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <button type="button" class="team-reset-button" @click="resetUserFilters">重置</button>
        </section>

        <div v-if="filteredUsers.length === 0" class="team-empty-state">
          <div class="team-empty-state__icon" aria-hidden="true">
            <span>U</span>
          </div>
          <strong>暂无匹配账号</strong>
          <p>调整筛选条件后再查看用户账号。</p>
        </div>

        <el-table v-else v-loading="userLoading" :data="filteredUsers" class="settings-table settings-table--users" row-key="id">
        <el-table-column label="姓名" min-width="140" show-overflow-tooltip>
          <template #default="{ row }: { row: UserItem }">
            <div class="team-member-cell">
              <div class="team-avatar">{{ getUserInitial(row) }}</div>
              <div>
                <strong>{{ getUserDisplayName(row) }}</strong>
                <p>{{ row.username }} · {{ row.email || '-' }}</p>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="账号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column label="角色" min-width="120">
          <template #default="{ row }: { row: UserItem }">
            <span class="team-role-badge" :class="getUserRoleClass(row.roleCode)">
              {{ getUserRoleLabel(row.roleCode) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }: { row: UserItem }">
            <span class="team-status-badge" :class="getUserStatusClass(row.status)">
              {{ getUserStatusMeta(row.status).label }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="所属空间" min-width="180" show-overflow-tooltip>
          <template #default="{ row }: { row: UserItem }">
            <span class="team-workspace-text">{{ formatUserWorkspaceNames(row.workspaceNames) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="184" fixed="right">
          <template #default="{ row }: { row: UserItem }">
            <div class="team-row-actions">
              <button
                type="button"
                :disabled="!canMutateUser(row) || isUserMutating(row.id)"
                :title="getUserMutableReason(row) || '编辑用户'"
                @click="openUserEdit(row)"
              >
                编辑
              </button>
              <button
                type="button"
                :class="{ 'is-danger': Number(row.status) === 1 }"
                :disabled="!canMutateUser(row) || isUserMutating(row.id)"
                :title="getUserMutableReason(row) || (Number(row.status) === 1 ? '停用用户' : '启用用户')"
                @click="toggleUserStatus(row)"
              >
                {{ Number(row.status) === 1 ? '停用' : '启用' }}
              </button>
              <button
                type="button"
                class="is-danger"
                :disabled="!canMutateUser(row) || isUserMutating(row.id)"
                :title="getUserMutableReason(row) || '重置密码'"
                @click="resetUserPassword(row)"
              >
                {{ isUserMutating(row.id) ? '处理中' : '重置密码' }}
              </button>
            </div>
          </template>
        </el-table-column>
        </el-table>
      </template>
    </div>

    <WorkspaceCreateEditDialog
      v-model="workspaceDialogVisible"
      :mode="workspaceDialogMode"
      :workspace="editingWorkspace"
      :saving="savingWorkspace"
      @submit="submitWorkspace"
    />

    <AppDialog
      v-model="userDialogVisible"
      title="编辑用户"
      width="560px"
    >
      <div class="user-edit-dialog">
        <label class="user-edit-dialog__field">
          <span>姓名 *</span>
          <el-input v-model="userForm.displayName" placeholder="请输入姓名" />
        </label>
        <label class="user-edit-dialog__field">
          <span>邮箱 *</span>
          <el-input v-model="userForm.email" placeholder="请输入邮箱" />
        </label>
        <label class="user-edit-dialog__field">
          <span>角色</span>
          <select v-model="userForm.roleCode" class="user-edit-dialog__select">
            <option value="MEMBER">成员</option>
            <option v-if="isCurrentSuperAdmin" value="ADMIN">管理员</option>
            <option v-if="isCurrentSuperAdmin" value="PLATFORM_ADMIN">平台管理员</option>
          </select>
        </label>
        <label class="user-edit-dialog__field">
          <span>状态</span>
          <select v-model.number="userForm.status" class="user-edit-dialog__select">
            <option :value="1">启用</option>
            <option :value="0">停用</option>
          </select>
        </label>
        <label class="user-edit-dialog__field is-full">
          <span>可访问空间</span>
          <el-input
            v-model="userForm.workspaceCodesText"
            type="textarea"
            :rows="3"
            placeholder="多个空间编码可用逗号、空格或换行分隔"
          />
        </label>
      </div>

      <template #footer>
        <AppButton :disabled="savingUser" @click="userDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="savingUser" @click="submitUserEdit">保存</AppButton>
      </template>
    </AppDialog>

    <WorkspaceMemberDialog
      v-model="memberDialogVisible"
      :mode="memberDialogMode"
      :member="editingMember"
      :saving="savingMember"
      @create="submitCreateMember"
      @update="submitUpdateMember"
    />
  </section>
</template>

<style scoped>
.workspace-settings-panel {
  display: flex;
  min-height: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 28px;
}

.settings-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.settings-panel-header__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.settings-panel-header__actions :deep(.el-button) {
  min-height: 42px;
  padding: 0 16px;
  border-radius: 12px;
}

.settings-panel-header h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  font-weight: 600;
  line-height: 24px;
}

.settings-panel-header p {
  max-width: 720px;
  margin: 2px 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
}

.settings-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.settings-stat {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  padding: 16px 20px;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-bg-panel);
}

.settings-stat span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.35;
}

.settings-stat span::after {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  border-radius: 6px;
  background: var(--app-primary-soft);
  content: "";
}

.settings-stat:nth-child(2) span::after {
  background: var(--app-success-soft);
}

.settings-stat:nth-child(3) span::after {
  background: var(--app-purple-soft);
}

.settings-stat:nth-child(4) span::after {
  background: var(--app-warning-soft);
}

.settings-stat strong {
  color: var(--app-text-primary);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

.settings-stat:nth-child(1) strong {
  color: var(--app-primary);
}

.settings-stat:nth-child(2) strong {
  color: var(--app-success);
}

.settings-stat:nth-child(3) strong {
  color: var(--app-purple);
}

.settings-stat:nth-child(4) strong {
  color: var(--app-warning);
}

.settings-panel-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
  order: 2;
  gap: 16px;
  padding: 0;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-bg-panel);
  overflow: hidden;
}

.settings-panel-block > :not(.settings-panel-block__header) {
  margin: 0 20px 20px;
}

.workspace-settings-panel.is-workspace-mode .settings-panel-block--workspaces,
.workspace-settings-panel.is-team-mode .settings-panel-block--users {
  order: 1;
}

.workspace-settings-panel.is-team-mode .settings-panel-block--members {
  order: 2;
}

.workspace-settings-panel.is-workspace-mode .settings-panel-block--members,
.workspace-settings-panel.is-team-mode .settings-panel-block--workspaces {
  order: 3;
}

.settings-panel-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 58px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--app-border-soft);
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
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
}

.settings-panel-block__description {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
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
  border: 1px solid var(--app-border-soft);
  border-radius: 16px;
  overflow: hidden;
}

.settings-table :deep(.el-table__header th) {
  height: 44px;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.settings-table :deep(.el-table__header th .cell) {
  line-height: 1.35;
  white-space: nowrap;
}

.settings-table :deep(.el-table__row) {
  height: 56px;
}

.settings-table :deep(.el-table__row:hover > td.el-table__cell) {
  background: var(--app-bg-subtle);
}

.settings-table :deep(.el-table__cell) {
  padding: 12px 0;
  color: var(--app-text-primary);
  font-size: 14px;
}

.settings-table :deep(.el-table__cell .cell) {
  line-height: 1.35;
}

.settings-table--users :deep(.el-table__fixed-right) {
  box-shadow: -8px 0 16px rgb(15 23 42 / 0.04);
}

.settings-panel-block--members :deep(.app-empty-state),
.settings-panel-block--users :deep(.app-empty-state),
.settings-panel-block--members :deep(.app-loading-state),
.settings-panel-block--users :deep(.app-loading-state) {
  min-height: 180px;
  border: 1px solid var(--app-border-soft);
  border-radius: 16px;
  background: var(--app-bg-subtle);
}

.team-filter-card {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(160px, 180px) minmax(140px, 160px) auto;
  align-items: end;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 16px;
  background: var(--app-bg-panel);
}

.team-filter-field {
  display: grid;
  min-width: 0;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}

.team-filter-field input,
.team-filter-field select {
  width: 100%;
  height: 38px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  outline: none;
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  font: inherit;
  font-size: 13px;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.team-filter-field input::placeholder {
  color: var(--app-text-muted);
}

.team-filter-field input:focus,
.team-filter-field select:focus {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px var(--app-primary-soft);
}

.team-reset-button {
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-bg-subtle);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
}

.team-reset-button:hover {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.team-empty-state {
  display: grid;
  min-height: 220px;
  place-items: center;
  gap: 8px;
  padding: 48px 20px;
  border: 1px solid var(--app-border-soft);
  border-radius: 16px;
  background: var(--app-bg-subtle);
  text-align: center;
}

.team-empty-state__icon {
  display: inline-flex;
  width: 52px;
  height: 52px;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--app-primary-soft), var(--app-purple-soft));
  color: var(--app-primary);
}

.team-empty-state__icon span {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--app-bg-panel);
  font-size: 14px;
  font-weight: 700;
}

.team-empty-state strong {
  color: var(--app-text-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.team-empty-state p {
  max-width: 360px;
  margin: 0;
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 1.55;
}

.workspace-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.workspace-config-card {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-bg-panel);
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.workspace-config-card:hover {
  border-color: var(--app-border-strong);
  box-shadow: var(--app-shadow-card-hover);
  transform: translateY(-1px);
}

.workspace-config-card.is-disabled {
  opacity: 0.68;
}

.workspace-card-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.workspace-card-head {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: flex-start;
  gap: 12px;
}

.workspace-card-icon {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6, var(--app-primary));
  color: var(--app-text-inverse);
  font-size: 15px;
  font-weight: 700;
}

.workspace-config-card.is-team .workspace-card-icon {
  background: linear-gradient(135deg, #22c55e, var(--app-success));
}

.workspace-config-card.is-product .workspace-card-icon {
  background: linear-gradient(135deg, #a855f7, var(--app-purple));
}

.workspace-card-title {
  min-width: 0;
  flex: 1;
}

.workspace-card-name-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.workspace-card-name-row h3 {
  min-width: 0;
  margin: 0;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-card-title p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.workspace-card-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 180ms ease;
}

.workspace-config-card:hover .workspace-card-actions {
  opacity: 1;
}

.workspace-card-actions button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
}

.workspace-card-actions button:hover {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.workspace-card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

.workspace-card-meta span {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.35;
}

.workspace-type-badge {
  padding: 4px 8px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: var(--app-primary-soft);
  color: var(--app-primary-hover) !important;
}

.workspace-type-badge.is-team {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
  color: var(--app-success) !important;
}

.workspace-type-badge.is-product {
  border-color: #e9d5ff;
  background: var(--app-purple-soft);
  color: var(--app-purple) !important;
}

.team-member-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.team-avatar {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-size: 14px;
  font-weight: 700;
}

.team-role-badge,
.team-status-badge {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.team-role-badge.is-admin {
  background: var(--app-purple-soft);
  color: var(--app-purple);
}

.team-role-badge.is-member {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.team-role-badge.is-viewer {
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
}

.team-status-badge {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.team-status-badge.is-disabled {
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
}

.team-workspace-text {
  display: inline-block;
  max-width: 260px;
  overflow: hidden;
  color: var(--app-text-primary);
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.team-member-cell strong {
  display: block;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-member-cell p {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-row-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.team-row-actions button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 13px;
  line-height: 1.35;
  transition: color 160ms ease;
}

.team-row-actions button:hover:not(:disabled) {
  color: var(--app-primary-hover);
}

.team-row-actions button.is-danger:hover:not(:disabled) {
  color: var(--app-danger);
}

.team-row-actions button:disabled {
  color: var(--app-text-muted);
  cursor: not-allowed;
  opacity: 0.56;
}

.user-edit-dialog {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.user-edit-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.user-edit-dialog__field.is-full {
  grid-column: 1 / -1;
}

.user-edit-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.user-edit-dialog__select {
  width: 100%;
  height: var(--app-control-height-md);
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  outline: none;
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  font: inherit;
}

.user-edit-dialog__select:focus {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px var(--app-primary-soft);
}

.workspace-member-select {
  width: 220px;
}

.workspace-member-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: var(--app-space-1);
}

.workspace-action-button {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
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

.workspace-action-button.is-danger {
  color: var(--app-danger);
}

.workspace-action-button.is-danger:hover {
  background: var(--app-danger-soft);
}

.workspace-action-button:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

@media (max-width: 960px) {
  .settings-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .team-filter-card {
    grid-template-columns: minmax(0, 1fr) minmax(140px, 180px);
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

  .workspace-member-select {
    width: min(260px, 100%);
  }

  .settings-stat-grid {
    grid-template-columns: 1fr;
  }

  .team-filter-card {
    grid-template-columns: 1fr;
  }

  .team-reset-button {
    width: 100%;
  }

  .user-edit-dialog {
    grid-template-columns: 1fr;
  }
}
</style>

import type {
  CreateWorkspaceMemberPayload,
  UpdateWorkspaceMemberPayload,
  WorkspaceMemberItem,
} from '@/entities/workspace'

export type WorkspaceMemberDialogMode = 'create' | 'edit'

export interface WorkspaceMemberForm {
  userIds: number[]
  roleCode: string
}

export const workspaceMemberRoleOptions = [
  { value: 'ADMIN', label: '管理员' },
  { value: 'MEMBER', label: '普通成员' },
] as const

export function createDefaultWorkspaceMemberForm(): WorkspaceMemberForm {
  return {
    userIds: [],
    roleCode: 'MEMBER',
  }
}

export function createWorkspaceMemberFormFromItem(item: WorkspaceMemberItem): WorkspaceMemberForm {
  return {
    userIds: [item.userId],
    roleCode: item.roleCode || 'MEMBER',
  }
}

export function buildCreateWorkspaceMemberPayload(form: WorkspaceMemberForm): CreateWorkspaceMemberPayload[] {
  return form.userIds.map((userId) => ({
    userId: Number(userId),
    roleCode: form.roleCode,
  }))
}

export function buildUpdateWorkspaceMemberPayload(form: WorkspaceMemberForm): UpdateWorkspaceMemberPayload {
  return {
    roleCode: form.roleCode,
  }
}

export function validateWorkspaceMemberForm(form: WorkspaceMemberForm, mode: WorkspaceMemberDialogMode) {
  if (mode === 'create' && form.userIds.length === 0) {
    return '请选择用户'
  }
  if (!form.roleCode) {
    return '请选择成员角色'
  }
  return ''
}

export function getWorkspaceMemberRoleLabel(roleCode?: string | null) {
  return workspaceMemberRoleOptions.find((item) => item.value === roleCode)?.label || roleCode || '-'
}

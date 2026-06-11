import type {
  CreateWorkspaceMemberPayload,
  UpdateWorkspaceMemberPayload,
  WorkspaceMemberItem,
} from '@/entities/workspace'

export type WorkspaceMemberDialogMode = 'create' | 'edit'

export interface WorkspaceMemberForm {
  userId: number | null
  roleCode: string
}

export const workspaceMemberRoleOptions = [
  { value: 'ADMIN', label: '管理员' },
  { value: 'MEMBER', label: '成员' },
] as const

export function createDefaultWorkspaceMemberForm(): WorkspaceMemberForm {
  return {
    userId: null,
    roleCode: 'MEMBER',
  }
}

export function createWorkspaceMemberFormFromItem(item: WorkspaceMemberItem): WorkspaceMemberForm {
  return {
    userId: item.userId,
    roleCode: item.roleCode || 'MEMBER',
  }
}

export function buildCreateWorkspaceMemberPayload(form: WorkspaceMemberForm): CreateWorkspaceMemberPayload {
  return {
    userId: Number(form.userId),
    roleCode: form.roleCode,
  }
}

export function buildUpdateWorkspaceMemberPayload(form: WorkspaceMemberForm): UpdateWorkspaceMemberPayload {
  return {
    roleCode: form.roleCode,
  }
}

export function validateWorkspaceMemberForm(form: WorkspaceMemberForm, mode: WorkspaceMemberDialogMode) {
  if (mode === 'create' && (!form.userId || form.userId <= 0)) {
    return '请输入有效的用户 ID'
  }
  if (!form.roleCode) {
    return '请选择成员角色'
  }
  return ''
}

export function getWorkspaceMemberRoleLabel(roleCode?: string | null) {
  return workspaceMemberRoleOptions.find((item) => item.value === roleCode)?.label || roleCode || '-'
}

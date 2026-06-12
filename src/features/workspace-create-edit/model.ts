import type { SaveWorkspacePayload, WorkspaceItem } from '@/entities/workspace'

export type WorkspaceDialogMode = 'create' | 'edit'

export interface WorkspaceForm {
  workspaceCode: string
  workspaceName: string
  description: string
  workspaceType: string
  ownerUserId: number | null
  status: number
}

export const workspaceTypeOptions = [
  { value: 'PROJECT', label: '项目空间', description: '项目专用', icon: 'package' },
  { value: 'TEAM', label: '团队空间', description: '团队协作', icon: 'users' },
  { value: 'PRODUCT', label: '产品空间', description: '产品测试', icon: 'target' },
] as const

export const workspaceStatusOptions = [
  { value: 1, label: '启用' },
  { value: 0, label: '禁用' },
] as const

export function createDefaultWorkspaceForm(): WorkspaceForm {
  return {
    workspaceCode: '',
    workspaceName: '',
    description: '',
    workspaceType: 'PROJECT',
    ownerUserId: null,
    status: 1,
  }
}

export function createWorkspaceFormFromItem(item: WorkspaceItem): WorkspaceForm {
  return {
    workspaceCode: item.workspaceCode || item.code || '',
    workspaceName: item.workspaceName || item.name || '',
    description: item.description || '',
    workspaceType: item.workspaceType || 'PROJECT',
    ownerUserId: item.ownerUserId ?? null,
    status: Number(item.status) === 0 ? 0 : 1,
  }
}

export function buildSaveWorkspacePayload(form: WorkspaceForm): SaveWorkspacePayload {
  return {
    workspaceCode: form.workspaceCode.trim(),
    workspaceName: form.workspaceName.trim(),
    description: form.description.trim() || null,
    workspaceType: form.workspaceType.trim() || 'PROJECT',
    ownerUserId: form.ownerUserId,
    status: form.status,
  }
}

export function validateWorkspaceForm(form: WorkspaceForm, mode: WorkspaceDialogMode) {
  if (mode === 'create' && !form.workspaceCode.trim()) {
    return '请输入空间编码'
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(form.workspaceCode.trim())) {
    return '空间编码只能包含字母、数字、下划线和短横线'
  }
  if (!form.workspaceName.trim()) {
    return '请输入空间名称'
  }
  return ''
}

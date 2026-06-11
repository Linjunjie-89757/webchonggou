import { defectApi, type AssignDefectPayload, type DefectSummaryItem } from '@/entities/defect'

export interface DefectAssignForm {
  assigneeId: string
}

export function createDefaultAssignForm(): DefectAssignForm {
  return {
    assigneeId: '',
  }
}

export function validateAssignForm(form: DefectAssignForm) {
  if (!form.assigneeId.trim()) {
    return '请输入处理人 ID'
  }
  if (!Number.isFinite(Number(form.assigneeId))) {
    return '处理人 ID 必须是数字'
  }
  return ''
}

export function buildAssignPayload(form: DefectAssignForm, workspaceCode = 'ALL'): AssignDefectPayload {
  return {
    workspaceCode: workspaceCode === 'ALL' ? undefined : workspaceCode,
    assigneeId: Number(form.assigneeId.trim()),
  }
}

export async function assignDefect(item: DefectSummaryItem, workspaceCode = 'ALL', payload: AssignDefectPayload) {
  return defectApi.assignDefect(workspaceCode, item.id, payload)
}

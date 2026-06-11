import type { DefectDetail, DefectPriority, DefectSeverity, DefectSummaryItem, SaveDefectPayload } from '@/entities/defect'

export type DefectDialogMode = 'create' | 'edit'

export interface DefectForm {
  workspaceCode: string
  title: string
  description: string
  priority: DefectPriority
  severity: DefectSeverity
  assigneeId: string
  relatedCaseId: string
  tagsText: string
}

export function createDefaultDefectForm(workspaceCode = 'ALL'): DefectForm {
  return {
    workspaceCode,
    title: '',
    description: '',
    priority: 'P1',
    severity: 'MEDIUM',
    assigneeId: '',
    relatedCaseId: '',
    tagsText: '',
  }
}

export function createDefectFormFromDetail(item: DefectDetail): DefectForm {
  return {
    workspaceCode: item.workspaceCode || 'ALL',
    title: item.title || '',
    description: item.description || '',
    priority: (item.priority || 'P1') as DefectPriority,
    severity: (item.severity || 'MEDIUM') as DefectSeverity,
    assigneeId: item.assigneeId ? String(item.assigneeId) : '',
    relatedCaseId: item.relatedCaseId ? String(item.relatedCaseId) : '',
    tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
  }
}

export function createDefectFormFromSummary(item: DefectSummaryItem, fallbackWorkspaceCode = 'ALL'): DefectForm {
  return {
    workspaceCode: item.workspaceCode || fallbackWorkspaceCode,
    title: item.title || '',
    description: '',
    priority: (item.priority || 'P1') as DefectPriority,
    severity: (item.severity || 'MEDIUM') as DefectSeverity,
    assigneeId: '',
    relatedCaseId: item.relatedCaseId ? String(item.relatedCaseId) : '',
    tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
  }
}

function parseOptionalId(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const id = Number(trimmed)
  return Number.isFinite(id) ? id : null
}

function parseTags(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function buildSaveDefectPayload(form: DefectForm): SaveDefectPayload {
  return {
    workspaceCode: form.workspaceCode === 'ALL' ? undefined : form.workspaceCode,
    title: form.title.trim(),
    description: form.description.trim(),
    priority: form.priority,
    severity: form.severity,
    assigneeId: parseOptionalId(form.assigneeId),
    relatedCaseId: parseOptionalId(form.relatedCaseId),
    tags: parseTags(form.tagsText),
  }
}

export function validateDefectForm(form: DefectForm) {
  if (!form.title.trim()) {
    return '请输入缺陷标题'
  }
  if (!form.description.trim()) {
    return '请输入缺陷描述'
  }
  if (!form.priority) {
    return '请选择优先级'
  }
  if (!form.severity) {
    return '请选择严重级别'
  }
  if (!form.assigneeId.trim()) {
    return '请输入处理人 ID'
  }
  if (!Number.isFinite(Number(form.assigneeId))) {
    return '处理人 ID 必须是数字'
  }
  if (form.relatedCaseId.trim() && !Number.isFinite(Number(form.relatedCaseId))) {
    return '关联用例 ID 必须是数字'
  }
  return ''
}

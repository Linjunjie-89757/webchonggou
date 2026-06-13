import { defectApi, defectStatusOptions, type DefectSummaryItem, type TransitionDefectPayload } from '@/entities/defect'

export interface DefectTransitionForm {
  assigneeId: string
  toStatus: string
  actionComment: string
}

export function createDefaultTransitionForm(item?: DefectSummaryItem | null): DefectTransitionForm {
  const currentStatus = item?.status
  const firstTargetStatus = defectStatusOptions.find((option) => option.value !== currentStatus)?.value || 'IN_PROGRESS'

  return {
    assigneeId: '',
    toStatus: firstTargetStatus,
    actionComment: '',
  }
}

export function validateTransitionForm(form: DefectTransitionForm) {
  if (form.assigneeId.trim() && !Number.isFinite(Number(form.assigneeId))) {
    return '处理人数据异常，请重新选择'
  }
  if (!form.toStatus) {
    return '请选择目标状态'
  }
  return ''
}

export function buildTransitionPayload(
  form: DefectTransitionForm,
  workspaceCode = 'ALL',
): TransitionDefectPayload {
  return {
    workspaceCode: workspaceCode === 'ALL' ? undefined : workspaceCode,
    toStatus: form.toStatus,
    actionComment: form.actionComment.trim() || undefined,
  }
}

export async function transitionDefect(
  item: DefectSummaryItem,
  workspaceCode = 'ALL',
  payload: TransitionDefectPayload,
) {
  return defectApi.transitionDefect(workspaceCode, item.id, payload)
}

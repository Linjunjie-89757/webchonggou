import { defectApi, type DefectSummaryItem, type TransitionDefectPayload } from '@/entities/defect'

export interface DefectTransitionForm {
  toStatus: string
  actionComment: string
}

export function createDefaultTransitionForm(item?: DefectSummaryItem | null): DefectTransitionForm {
  return {
    toStatus: item?.status === 'CLOSED' ? 'IN_PROGRESS' : 'IN_PROGRESS',
    actionComment: '',
  }
}

export function validateTransitionForm(form: DefectTransitionForm) {
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

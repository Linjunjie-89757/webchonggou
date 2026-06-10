import { caseApi, type BatchUpdateCasesPayload } from '@/entities/case'

export interface BatchUpdateCaseForm {
  priority: string
  reviewStatus: string
  executionStatus: string
}

export function createDefaultBatchUpdateCaseForm(): BatchUpdateCaseForm {
  return {
    priority: '',
    reviewStatus: '',
    executionStatus: '',
  }
}

export function buildBatchUpdateCasesPayload(caseIds: number[], form: BatchUpdateCaseForm): BatchUpdateCasesPayload {
  return {
    caseIds,
    priority: form.priority || undefined,
    reviewStatus: form.reviewStatus || undefined,
    executionStatus: form.executionStatus || undefined,
  }
}

export function validateBatchUpdateCaseForm(form: BatchUpdateCaseForm) {
  if (!form.priority && !form.reviewStatus && !form.executionStatus) {
    return '至少选择一个要修改的字段'
  }

  return ''
}

export async function batchUpdateCases(workspaceCode = 'ALL', payload: BatchUpdateCasesPayload) {
  return caseApi.batchUpdateCases(workspaceCode, payload)
}

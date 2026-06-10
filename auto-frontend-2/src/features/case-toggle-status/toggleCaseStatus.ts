import { caseApi, type CaseDetail, type CaseSummaryItem, type SaveCasePayload } from '@/entities/case'

export function getNextCaseStatus(status: string) {
  return status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED'
}

export function getCaseStatusActionText(status: string) {
  return status === 'ARCHIVED' ? '启用' : '归档'
}

function buildStatusPayload(detail: CaseDetail, status: string): SaveCasePayload {
  return {
    workspaceCode: detail.workspaceCode || undefined,
    directoryId: detail.directoryId,
    title: detail.title,
    caseType: detail.caseType,
    priority: detail.priority,
    sourceType: detail.sourceType,
    caseStatus: status,
    ownerId: detail.ownerId,
    precondition: detail.precondition || '',
    steps: detail.steps || '',
    expectedResult: detail.expectedResult || '',
  }
}

export async function toggleCaseStatus(item: CaseSummaryItem, workspaceCode = 'ALL') {
  const detail = await caseApi.getCaseDetail(item.id, workspaceCode)
  const nextStatus = getNextCaseStatus(detail.status || item.status)

  await caseApi.updateCaseStatus(item.id, workspaceCode, buildStatusPayload(detail, nextStatus))
}

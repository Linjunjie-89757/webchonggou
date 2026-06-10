import { caseApi, type CaseSummaryItem, type RunCasePayload } from '@/entities/case'

export function buildQuickRunPayload(item: CaseSummaryItem): RunCasePayload {
  return {
    executionStatus: 'PASSED',
    executionComment: `${item.caseNo} 快速执行通过`,
  }
}

export async function runCase(item: CaseSummaryItem, workspaceCode = 'ALL') {
  return caseApi.runCase(item.id, workspaceCode, buildQuickRunPayload(item))
}

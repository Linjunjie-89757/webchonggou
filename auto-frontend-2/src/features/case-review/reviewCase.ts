import { caseApi, type CaseSummaryItem, type ReviewCasePayload } from '@/entities/case'

export function createDefaultReviewPayload(item: CaseSummaryItem): ReviewCasePayload {
  return {
    reviewStatus: item.reviewStatus === 'REJECTED' ? 'REJECTED' : 'PASSED',
    reviewComment: item.reviewComment || '',
  }
}

export function buildReviewPayload(payload: ReviewCasePayload): ReviewCasePayload {
  return {
    reviewStatus: payload.reviewStatus,
    reviewComment: payload.reviewComment?.trim() || undefined,
  }
}

export async function reviewCase(item: CaseSummaryItem, workspaceCode = 'ALL', payload: ReviewCasePayload) {
  return caseApi.reviewCase(item.id, workspaceCode, buildReviewPayload(payload))
}

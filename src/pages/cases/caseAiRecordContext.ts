export interface CaseAiRecordListContext {
  workspaceCode: string
  statusFilter: string
  pageNo: number
  pageSize: number
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  scrollTop?: number
}

const STORAGE_KEY = 'case-ai-record-list-context-v1'

export function loadCaseAiRecordListContext(): CaseAiRecordListContext | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as CaseAiRecordListContext
  } catch {
    return null
  }
}

export function saveCaseAiRecordListContext(context: CaseAiRecordListContext) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context))
}

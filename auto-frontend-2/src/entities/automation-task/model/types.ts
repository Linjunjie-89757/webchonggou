export type AutomationTaskStatus = 'READY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELED'

export type AutomationTaskEngineType = 'API' | 'WEB' | 'APP'

export interface AutomationTaskSummaryItem {
  id: number
  taskName: string
  engineType: AutomationTaskEngineType | string
  status: AutomationTaskStatus | string
  summary: string | null
  workspaceCode: string
  workspaceName: string
}

export interface AutomationTaskListResponse {
  items: AutomationTaskSummaryItem[]
  total: number
  pageNo?: number
  pageSize?: number
  totalPages?: number
}

export interface AutomationTaskClientFilter {
  keyword: string
  status: string
}

export interface AutomationTaskListQuery {
  keyword?: string
  status?: string
  engineType?: string
  pageNo?: number
  pageSize?: number
}

export interface AutomationTaskStat {
  label: string
  value: number
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}

export type DefectStatus =
  | 'TODO'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'PENDING_VERIFY'
  | 'CLOSED'
  | 'REJECTED'

export type DefectSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export type DefectPriority = 'P0' | 'P1' | 'P2' | 'P3'

export interface DefectSummaryItem {
  id: number
  bugNo: string
  title: string
  tags: string[]
  priority: DefectPriority | string
  severity: DefectSeverity | string
  status: DefectStatus | string
  assigneeName: string | null
  reporterName: string | null
  createdAt: string | null
  updatedByName: string | null
  updatedAt: string | null
  relatedCaseId: number | null
  relatedCaseCount: number
  workspaceCode: string
  workspaceName: string
}

export interface DefectDetail extends DefectSummaryItem {
  description: string
  sourceType: string | null
  assigneeId: number | null
  reporterId: number | null
  relatedReportId: number | null
  relatedTaskId: number | null
  createdAt: string | null
  attachments?: unknown[]
  sourceContext?: unknown
  activities?: unknown[]
  flows?: unknown[]
  comments?: unknown[]
}

export interface SaveDefectPayload {
  workspaceCode?: string
  title: string
  description: string
  priority: string
  severity: string
  assigneeId: number | null
  relatedCaseId: number | null
  tags: string[]
}

export interface DefectStatistics {
  total: number
  todo: number
  assigned: number
  inProgress: number
  pendingVerify: number
  closed: number
  rejected: number
}

export interface DefectListResponse {
  items: DefectSummaryItem[]
  total: number
  pageNo: number
  pageSize: number
  totalPages: number
}

export interface DefectClientFilter {
  keyword: string
  status: string
  priority: string
  severity: string
}

export interface DefectListQuery {
  keyword?: string
  status?: string
  priority?: string
  severity?: string
  pageNo?: number
  pageSize?: number
}

export interface DefectStat {
  label: string
  value: number
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'
}

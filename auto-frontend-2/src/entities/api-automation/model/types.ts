export interface PageResponse<T> {
  items: T[]
  total: number
  pageNo: number
  pageSize: number
  totalPages: number
}

export interface ApiDefinitionItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  method: string
  path: string
  directoryName: string | null
  description: string | null
  tags: string[]
  lastRunResult: string | null
  lastRunAt: string | null
  updatedAt: string | null
}

export interface ApiDefinitionModuleItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  parentId: number | null
  name: string
  fullPath: string | null
  sortOrder: number | null
  definitionCount: number
  children: ApiDefinitionModuleItem[]
}

export interface ApiDefinitionCaseItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  definitionId: number
  definitionName: string
  name: string
  method: string
  path: string
  description: string | null
  tags: string[]
  lastRunResult: string | null
  lastRunAt: string | null
  updatedAt: string | null
}

export interface ApiDefinitionListQuery {
  keyword?: string
  moduleId?: number | null
  pageNo?: number
  pageSize?: number
}

export interface ApiCaseListQuery {
  definitionId?: number | null
  keyword?: string
  pageNo?: number
  pageSize?: number
}

export interface ApiAutomationClientFilter {
  keyword: string
}

export interface ApiAutomationStat {
  label: string
  value: number
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'
}

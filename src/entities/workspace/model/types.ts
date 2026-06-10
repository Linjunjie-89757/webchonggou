export interface WorkspaceItem {
  workspaceCode: string
  workspaceName: string
  code?: string
  name?: string
  allScope?: boolean
  status?: number | string
  role?: string
  current?: boolean
  default?: boolean
  isCurrent?: boolean
  isDefault?: boolean
}

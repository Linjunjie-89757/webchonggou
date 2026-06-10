export interface WorkspaceItem {
  workspaceCode: string
  workspaceName: string
  status?: number | string
  role?: string
  current?: boolean
  default?: boolean
  isCurrent?: boolean
  isDefault?: boolean
}

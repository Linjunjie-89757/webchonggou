export interface WorkspaceItem {
  workspaceCode: string
  workspaceName: string
  code?: string
  name?: string
  description?: string | null
  allScope?: boolean
  workspaceType?: string | null
  ownerUserId?: number | null
  ownerName?: string | null
  status?: number | string
  role?: string
  current?: boolean
  default?: boolean
  isCurrent?: boolean
  isDefault?: boolean
  createdAt?: string | null
  updatedAt?: string | null
}

export interface SaveWorkspacePayload {
  workspaceCode?: string
  workspaceName: string
  description?: string | null
  workspaceType?: string | null
  ownerUserId?: number | null
  status?: number | null
}

export interface WorkspaceMemberItem {
  id: number
  userId: number
  username: string
  email: string
  displayName: string
  roleCode: string
  status: number | null
}

export interface CreateWorkspaceMemberPayload {
  userId: number
  roleCode?: string | null
}

export interface UpdateWorkspaceMemberPayload {
  roleCode: string
}

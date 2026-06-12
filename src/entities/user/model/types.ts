export type UserStatus = 0 | 1

export interface UserItem {
  id: number
  username: string
  email: string
  displayName: string
  roleCode: string
  status: UserStatus | number
  workspaceCodes: string[]
  workspaceNames: string[]
}

export interface UpdateUserPayload {
  email: string
  displayName: string
  roleCode: string
  status: UserStatus | number
  workspaceCodes: string[]
}

export interface ResetUserPasswordResponse {
  userId: number
  username: string
  defaultPassword: string
}

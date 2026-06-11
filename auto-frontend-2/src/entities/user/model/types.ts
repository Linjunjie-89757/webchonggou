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

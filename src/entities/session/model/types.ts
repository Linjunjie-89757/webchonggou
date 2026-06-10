export interface CurrentUser {
  id: number
  username: string
  displayName?: string
  roleCode?: string
  workspaceCodes?: string[]
}

export interface LoginPayload {
  username: string
  password: string
}

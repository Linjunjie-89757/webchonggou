import { userRoleLabels, userStatusLabels } from '../model/options'
import type { UserItem } from '../model/types'

export function getUserDisplayName(user: Pick<UserItem, 'displayName' | 'username'>) {
  return user.displayName || user.username || '-'
}

export function getUserRoleLabel(roleCode?: string | null) {
  return roleCode ? userRoleLabels[roleCode] ?? roleCode : '-'
}

export function getUserStatusMeta(status?: number | string | null) {
  const normalizedStatus = Number(status)
  if (normalizedStatus === 1) {
    return { label: userStatusLabels[1], tone: 'success' as const }
  }
  if (normalizedStatus === 0) {
    return { label: userStatusLabels[0], tone: 'danger' as const }
  }
  return { label: '-', tone: 'default' as const }
}

export function formatUserWorkspaceNames(workspaceNames?: string[] | null) {
  const uniqueNames = Array.from(new Set((workspaceNames ?? []).filter(Boolean)))
  return uniqueNames.length ? uniqueNames.join('、') : '-'
}

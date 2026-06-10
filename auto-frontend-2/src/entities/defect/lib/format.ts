import {
  defectSeverityOptions,
  defectStatusOptions,
} from '../model/options'
import type { DefectClientFilter, DefectSummaryItem } from '../model/types'

export function formatDefectDateTime(value: string | null | undefined) {
  if (!value) {
    return '-'
  }

  return value.replace('T', ' ').slice(0, 16)
}

export function getDefectPriorityTone(priority: string) {
  if (priority === 'P0') {
    return 'danger'
  }
  if (priority === 'P1') {
    return 'warning'
  }
  if (priority === 'P2') {
    return 'primary'
  }
  return 'default'
}

export function getDefectStatusMeta(status: string) {
  const option = defectStatusOptions.find((item) => item.value === status)

  if (status === 'CLOSED') {
    return { label: option?.label || status || '-', tone: 'success' as const }
  }
  if (status === 'REJECTED') {
    return { label: option?.label || status || '-', tone: 'danger' as const }
  }
  if (status === 'IN_PROGRESS' || status === 'PENDING_VERIFY') {
    return { label: option?.label || status || '-', tone: 'warning' as const }
  }
  if (status === 'ASSIGNED') {
    return { label: option?.label || status || '-', tone: 'primary' as const }
  }

  return { label: option?.label || status || '-', tone: 'default' as const }
}

export function getDefectSeverityMeta(severity: string) {
  const option = defectSeverityOptions.find((item) => item.value === severity)

  if (severity === 'CRITICAL') {
    return { label: option?.label || severity || '-', tone: 'danger' as const }
  }
  if (severity === 'HIGH') {
    return { label: option?.label || severity || '-', tone: 'warning' as const }
  }
  if (severity === 'MEDIUM') {
    return { label: option?.label || severity || '-', tone: 'primary' as const }
  }

  return { label: option?.label || severity || '-', tone: 'default' as const }
}

export function formatDefectTags(tags: string[] | null | undefined) {
  return Array.isArray(tags) && tags.length ? tags.join(' / ') : '-'
}

export function matchesDefectClientFilter(item: DefectSummaryItem, filter: DefectClientFilter) {
  const keyword = filter.keyword.trim().toLowerCase()
  if (keyword) {
    const haystack = [
      item.bugNo,
      item.title,
      item.assigneeName,
      item.reporterName,
      item.workspaceName,
      ...(Array.isArray(item.tags) ? item.tags : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    if (!haystack.includes(keyword)) {
      return false
    }
  }

  if (filter.status && item.status !== filter.status) {
    return false
  }
  if (filter.priority && item.priority !== filter.priority) {
    return false
  }
  if (filter.severity && item.severity !== filter.severity) {
    return false
  }

  return true
}

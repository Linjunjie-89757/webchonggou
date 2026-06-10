import type { DefectPriority, DefectSeverity, DefectStatus } from './types'

export const defectStatusOptions: Array<{ label: string; value: DefectStatus }> = [
  { label: '待指派', value: 'TODO' },
  { label: '已指派', value: 'ASSIGNED' },
  { label: '处理中', value: 'IN_PROGRESS' },
  { label: '待验证', value: 'PENDING_VERIFY' },
  { label: '已关闭', value: 'CLOSED' },
  { label: '已拒绝', value: 'REJECTED' },
]

export const defectSeverityOptions: Array<{ label: string; value: DefectSeverity }> = [
  { label: '致命', value: 'CRITICAL' },
  { label: '高', value: 'HIGH' },
  { label: '中', value: 'MEDIUM' },
  { label: '低', value: 'LOW' },
]

export const defectPriorityOptions: Array<{ label: DefectPriority; value: DefectPriority }> = [
  { label: 'P0', value: 'P0' },
  { label: 'P1', value: 'P1' },
  { label: 'P2', value: 'P2' },
  { label: 'P3', value: 'P3' },
]

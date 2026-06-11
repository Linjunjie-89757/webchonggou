import type { AutomationTaskEngineType, AutomationTaskStatus } from './types'

export const AUTOMATION_TASK_STATUS_OPTIONS: Array<{
  label: string
  value: AutomationTaskStatus
  tone: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}> = [
  { label: '待执行', value: 'READY', tone: 'default' },
  { label: '执行中', value: 'RUNNING', tone: 'primary' },
  { label: '成功', value: 'SUCCESS', tone: 'success' },
  { label: '失败', value: 'FAILED', tone: 'danger' },
  { label: '已取消', value: 'CANCELED', tone: 'warning' },
]

export const AUTOMATION_TASK_ENGINE_OPTIONS: Array<{
  label: string
  value: AutomationTaskEngineType
}> = [
  { label: '接口', value: 'API' },
  { label: 'Web UI', value: 'WEB' },
  { label: 'APP', value: 'APP' },
]

export function getAutomationTaskStatusOption(status?: string | null) {
  return AUTOMATION_TASK_STATUS_OPTIONS.find((item) => item.value === status)
}

export function getAutomationTaskEngineOption(engineType?: string | null) {
  return AUTOMATION_TASK_ENGINE_OPTIONS.find((item) => item.value === engineType)
}

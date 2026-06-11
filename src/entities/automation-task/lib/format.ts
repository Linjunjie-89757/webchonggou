import { getAutomationTaskEngineOption, getAutomationTaskStatusOption } from '../model/options'

export function formatAutomationTaskStatus(status?: string | null) {
  return getAutomationTaskStatusOption(status)?.label || status || '-'
}

export function formatAutomationTaskEngine(engineType?: string | null) {
  return getAutomationTaskEngineOption(engineType)?.label || engineType || '-'
}

export function formatAutomationTaskSummary(summary?: string | null) {
  const value = summary?.trim()
  return value || '-'
}

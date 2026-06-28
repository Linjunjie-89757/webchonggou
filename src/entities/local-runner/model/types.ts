export interface RunnerNodeSummary {
  runnerId: string
  runnerName: string | null
  status: string | null
  runnerVersion: string | null
  protocolVersion: string | null
  capabilities: string[]
  resource: Record<string, unknown>
  browser: Record<string, unknown>
  session: Record<string, unknown>
  lastHeartbeatAt: string | null
  secondsSinceHeartbeat: number | null
  offline: boolean
  activeTasks: RunnerActiveTaskSummary[]
}

export interface RunnerActiveTaskSummary {
  runId: string
  taskType: string | null
  status: string | null
  currentStage: string | null
  progressPercent: number | null
  resourceCost: number | null
  assignedAt: string | null
  startedAt: string | null
  lastReportedAt: string | null
  runningSeconds: number | null
}

export interface RunnerOfflineScanResult {
  changedTasks: number
}

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
}

export interface RunnerOfflineScanResult {
  changedTasks: number
}

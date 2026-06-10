export type ConfigCenterTab = 'env' | 'param' | 'dbConnection' | 'aiProvider'

export type ConfigStatus = 0 | 1

export interface EnvConfigItem {
  id: number
  workspaceCode: string
  workspaceName: string
  envType: string
  envName: string
  baseUrl: string
  configJson: string
  status: ConfigStatus
}

export interface CreateEnvPayload {
  workspaceCode?: string
  envType: string
  envName: string
  baseUrl: string
  configJson: string
  status?: ConfigStatus
}

export interface ParamSetItem {
  id: number
  workspaceCode: string
  workspaceName: string
  paramType: string
  paramName: string
  contentJson: string
  status: ConfigStatus
}

export interface CreateParamPayload {
  workspaceCode?: string
  paramType: string
  paramName: string
  contentJson: string
  status?: ConfigStatus
}

export interface DbConnectionItem {
  id: number
  workspaceCode: string
  workspaceName: string
  connectionName: string
  dbType: string
  driverClassName: string | null
  jdbcUrl: string
  username: string | null
  passwordConfigured: boolean
  poolMax: number
  timeoutMs: number
  description: string | null
  status: ConfigStatus
}

export interface CreateDbConnectionPayload {
  workspaceCode?: string
  connectionName: string
  dbType: string
  driverClassName?: string | null
  jdbcUrl: string
  username?: string | null
  password?: string | null
  poolMax?: number
  timeoutMs?: number
  description?: string | null
  status?: ConfigStatus
}

export interface DbConnectionTestResult {
  success?: boolean
  message?: string
  elapsedMs?: number
}

export interface DbConnectionTestPayload {
  id: number
}

export interface UpdateDbConnectionStatusPayload {
  status: ConfigStatus
}

export interface ConfigStat {
  label: string
  value: number | string
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'
}

import { configApi, type ConfigStatus, type DbConnectionItem } from '@/entities/config'

export async function toggleConfigDbConnectionStatus(dbConnection: DbConnectionItem, workspaceCode = 'ALL') {
  const nextStatus: ConfigStatus = dbConnection.status === 1 ? 0 : 1
  await configApi.updateSettingsDbConnectionStatus(workspaceCode, dbConnection.id, nextStatus)
  return nextStatus
}

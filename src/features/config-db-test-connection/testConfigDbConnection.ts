import { configApi, type DbConnectionItem } from '@/entities/config'

export async function testConfigDbConnection(dbConnection: DbConnectionItem, workspaceCode = 'ALL') {
  return configApi.testSettingsDbConnection(workspaceCode, dbConnection.id)
}

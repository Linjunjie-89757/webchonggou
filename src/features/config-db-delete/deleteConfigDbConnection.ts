import { ElMessageBox } from 'element-plus'

import { configApi, type DbConnectionItem } from '@/entities/config'

export async function deleteConfigDbConnection(dbConnection: DbConnectionItem, workspaceCode = 'ALL') {
  await ElMessageBox.confirm(
    `确认删除数据库连接“${dbConnection.connectionName}”吗？删除后不可恢复。`,
    '删除数据库连接',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    },
  )

  await configApi.deleteSettingsDbConnection(workspaceCode, dbConnection.id)
}

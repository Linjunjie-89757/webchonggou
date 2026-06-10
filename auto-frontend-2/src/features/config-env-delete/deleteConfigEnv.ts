import { ElMessageBox } from 'element-plus'

import { configApi, type EnvConfigItem } from '@/entities/config'

export async function deleteConfigEnv(env: EnvConfigItem, workspaceCode = 'ALL') {
  await ElMessageBox.confirm(
    `确认删除环境“${env.envName}”吗？删除后不可恢复。`,
    '删除环境',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    },
  )

  await configApi.deleteSettingsEnv(workspaceCode, env.id)
}

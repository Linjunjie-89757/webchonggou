import { ElMessageBox } from 'element-plus'

import { configApi, type ParamSetItem } from '@/entities/config'

export async function deleteConfigParam(param: ParamSetItem, workspaceCode = 'ALL') {
  await ElMessageBox.confirm(
    `确认删除参数“${param.paramName}”吗？删除后不可恢复。`,
    '删除参数',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    },
  )

  await configApi.deleteSettingsParam(workspaceCode, param.id)
}

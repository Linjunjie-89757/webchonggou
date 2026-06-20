import { ElMessage, ElMessageBox } from 'element-plus'

import { webUiAutomationApi, type WebUiCaseItem } from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'

export async function deleteWebUiCase(caseItem: WebUiCaseItem, workspaceCode = 'ALL') {
  try {
    await ElMessageBox.confirm(
      `确认删除用例 "${caseItem.name}" 吗？删除后不可恢复。`,
      '删除 Web UI 用例',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    )
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return false
    }
    throw error
  }

  try {
    await webUiAutomationApi.deleteCase(workspaceCode, caseItem.id)
    ElMessage.success('Web UI 用例已删除')
    return true
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
    throw error
  }
}

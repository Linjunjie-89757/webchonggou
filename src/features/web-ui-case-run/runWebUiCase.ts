import { ElMessage } from 'element-plus'

import { webUiAutomationApi, type WebUiCaseItem, type WebUiRunResponse } from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'

export async function runWebUiCase(caseItem: WebUiCaseItem, workspaceCode = 'ALL'): Promise<WebUiRunResponse | null> {
  try {
    const result = await webUiAutomationApi.runCase(workspaceCode, caseItem.id, {})
    ElMessage.success(result.status === 'SUCCESS' ? '执行成功' : '执行完成，请查看报告')
    return result
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
    return null
  }
}

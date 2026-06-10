import { ElMessageBox } from 'element-plus'

import { caseApi, type CaseSummaryItem } from '@/entities/case'

export async function deleteCase(item: CaseSummaryItem, workspaceCode = 'ALL') {
  await ElMessageBox.confirm(
    `确定删除用例「${item.title || item.caseNo}」吗？`,
    '删除用例',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    },
  )

  await caseApi.deleteCase(item.id, workspaceCode)
}

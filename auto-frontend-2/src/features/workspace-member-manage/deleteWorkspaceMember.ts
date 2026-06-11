import { ElMessageBox } from 'element-plus'

import { workspaceApi, type WorkspaceMemberItem } from '@/entities/workspace'

export async function deleteWorkspaceMember(workspaceCode: string, member: WorkspaceMemberItem) {
  const displayName = member.displayName || member.username || String(member.userId)

  await ElMessageBox.confirm(
    `确定将“${displayName}”移出当前工作空间吗？`,
    '移除空间成员',
    {
      confirmButtonText: '移除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    },
  )

  return workspaceApi.deleteWorkspaceMember(workspaceCode, member.id)
}

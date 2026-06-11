import { ElMessageBox } from 'element-plus'

import { aiProviderApi, type AiProviderConnectionItem } from '@/entities/ai-provider'

export async function deleteAiConnection(provider: AiProviderConnectionItem, workspaceCode = 'ALL') {
  await ElMessageBox.confirm(
    `确定删除 AI 连接“${provider.connectionName}”吗？删除后相关模型缓存也会被移除。`,
    '删除 AI 连接',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    },
  )

  return aiProviderApi.deleteProviderConnection(workspaceCode, provider.id)
}

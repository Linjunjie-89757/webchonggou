<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Connection, Delete, Edit, Loading, Plus, RefreshRight, Tickets } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  aiProviderApi,
  formatAiProviderDate,
  getAiProviderEndpointSummary,
  getAiProviderProtocolLabel,
  getAiProviderStatusMeta,
  type AiProviderConnectionItem,
  type SaveAiProviderConnectionPayload,
} from '@/entities/ai-provider'
import { AiConnectionCreateEditDialog, type AiConnectionDialogMode } from '@/features/ai-connection-create-edit'
import { deleteAiConnection } from '@/features/ai-connection-delete'
import { testAiConnection } from '@/features/ai-connection-test'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppStatusBadge from '@/shared/ui/app-status-badge/AppStatusBadge.vue'
import { AiConnectionModelsDrawer } from '@/widgets/ai-connection-models-drawer'

const providers = ref<AiProviderConnectionItem[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const dialogVisible = ref(false)
const dialogMode = ref<AiConnectionDialogMode>('create')
const editingProvider = ref<AiProviderConnectionItem | null>(null)
const testingProviderIds = ref<Set<number>>(new Set())
const deletingProviderIds = ref<Set<number>>(new Set())
const modelsDrawerVisible = ref(false)
const modelsProvider = ref<AiProviderConnectionItem | null>(null)

const stats = computed(() => [
  { label: '连接总数', value: providers.value.length },
  { label: '已验证', value: providers.value.filter((item) => item.status === 1 && item.lastVerifiedAt).length },
  { label: '异常连接', value: providers.value.filter((item) => item.status === 0).length },
  { label: '模型总数', value: providers.value.reduce((total, item) => total + (item.modelCount ?? 0), 0) },
])

async function loadProviders() {
  loading.value = true
  errorMessage.value = ''
  try {
    const items = await aiProviderApi.getProviderConnections('ALL')
    providers.value = Array.isArray(items) ? items : []
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  dialogMode.value = 'create'
  editingProvider.value = null
  dialogVisible.value = true
}

function openEditDialog(provider: AiProviderConnectionItem) {
  dialogMode.value = 'edit'
  editingProvider.value = provider
  dialogVisible.value = true
}

function setTestingProvider(id: number, value: boolean) {
  const nextIds = new Set(testingProviderIds.value)
  if (value) {
    nextIds.add(id)
  } else {
    nextIds.delete(id)
  }
  testingProviderIds.value = nextIds
}

function setDeletingProvider(id: number, value: boolean) {
  const nextIds = new Set(deletingProviderIds.value)
  if (value) {
    nextIds.add(id)
  } else {
    nextIds.delete(id)
  }
  deletingProviderIds.value = nextIds
}

function isProviderTesting(id: number) {
  return testingProviderIds.value.has(id)
}

function isProviderDeleting(id: number) {
  return deletingProviderIds.value.has(id)
}

function isProviderBusy(id: number) {
  return isProviderTesting(id) || isProviderDeleting(id)
}

function openModelsDrawer(provider: AiProviderConnectionItem) {
  modelsProvider.value = provider
  modelsDrawerVisible.value = true
}

async function submitProvider(payload: SaveAiProviderConnectionPayload) {
  saving.value = true
  try {
    if (dialogMode.value === 'edit' && editingProvider.value) {
      await aiProviderApi.updateProviderConnection('ALL', editingProvider.value.id, payload)
      ElMessage.success('AI 连接已更新')
    } else {
      await aiProviderApi.createProviderConnection('ALL', payload)
      ElMessage.success('AI 连接已创建')
    }
    dialogVisible.value = false
    await loadProviders()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function testProvider(provider: AiProviderConnectionItem) {
  setTestingProvider(provider.id, true)
  try {
    const result = await testAiConnection(provider, 'ALL')
    if (result.success) {
      ElMessage.success(result.message || 'AI 连接测试成功')
    } else {
      ElMessage.warning(result.message || 'AI 连接测试未通过')
    }
    await loadProviders()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    setTestingProvider(provider.id, false)
  }
}

async function deleteProvider(provider: AiProviderConnectionItem) {
  setDeletingProvider(provider.id, true)
  try {
    await deleteAiConnection(provider, 'ALL')
    ElMessage.success('AI 连接已删除')
    if (modelsProvider.value?.id === provider.id) {
      modelsDrawerVisible.value = false
      modelsProvider.value = null
    }
    await loadProviders()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    setDeletingProvider(provider.id, false)
  }
}

onMounted(() => {
  void loadProviders()
})
</script>

<template>
  <section class="ai-connection-pool">
    <header class="settings-panel-header">
      <div>
        <h2>AI 连接池</h2>
        <p>按平台视角管理大模型服务连接，当前阶段支持新增、编辑和测试连接。</p>
      </div>
      <div class="settings-panel-header__actions">
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadProviders">刷新</AppButton>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增连接</AppButton>
      </div>
    </header>

    <div class="settings-stat-grid">
      <div v-for="item in stats" :key="item.label" class="settings-stat">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <AppLoadingState v-if="loading && providers.length === 0" text="正在加载 AI 连接池" />

    <div v-else-if="errorMessage && providers.length > 0" class="settings-inline-error">
      <span>{{ errorMessage }}</span>
      <AppButton size="small" :icon="RefreshRight" @click="loadProviders">重试</AppButton>
    </div>

    <AppEmptyState
      v-else-if="errorMessage"
      title="AI 连接池加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadProviders">重试</AppButton>
      </template>
    </AppEmptyState>

    <AppEmptyState
      v-else-if="providers.length === 0"
      title="暂无 AI 连接"
      description="当前平台视角下还没有可展示的 AI 连接。"
    >
      <template #actions>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增连接</AppButton>
      </template>
    </AppEmptyState>

    <el-table v-else v-loading="loading" :data="providers" class="settings-table" row-key="id">
      <el-table-column prop="connectionName" label="连接名称" min-width="180" show-overflow-tooltip />
      <el-table-column label="状态" width="110">
        <template #default="{ row }: { row: AiProviderConnectionItem }">
          <AppStatusBadge
            :label="getAiProviderStatusMeta(row).label"
            :tone="getAiProviderStatusMeta(row).tone"
          />
        </template>
      </el-table-column>
      <el-table-column label="协议" min-width="150">
        <template #default="{ row }: { row: AiProviderConnectionItem }">
          {{ getAiProviderProtocolLabel(row.protocolType) }}
        </template>
      </el-table-column>
      <el-table-column prop="modelName" label="默认模型" min-width="150" show-overflow-tooltip>
        <template #default="{ row }: { row: AiProviderConnectionItem }">
          {{ row.modelName || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="模型数" width="90">
        <template #default="{ row }: { row: AiProviderConnectionItem }">
          {{ row.modelCount ?? 0 }}
        </template>
      </el-table-column>
      <el-table-column label="服务地址" min-width="180" show-overflow-tooltip>
        <template #default="{ row }: { row: AiProviderConnectionItem }">
          {{ getAiProviderEndpointSummary(row.baseUrl) }}
        </template>
      </el-table-column>
      <el-table-column prop="workspaceName" label="所属空间" min-width="140" show-overflow-tooltip>
        <template #default="{ row }: { row: AiProviderConnectionItem }">
          {{ row.workspaceName || row.workspaceCode || 'ALL' }}
        </template>
      </el-table-column>
      <el-table-column label="最近验证" min-width="150">
        <template #default="{ row }: { row: AiProviderConnectionItem }">
          {{ formatAiProviderDate(row.lastVerifiedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="224" fixed="right">
        <template #default="{ row }: { row: AiProviderConnectionItem }">
          <div class="ai-connection-actions">
            <button
              type="button"
              class="ai-connection-actions__button"
              :class="{ 'is-loading': isProviderTesting(row.id) }"
              :disabled="isProviderBusy(row.id)"
              aria-label="测试连接"
              @click="testProvider(row)"
            >
              <el-icon>
                <Loading v-if="isProviderTesting(row.id)" />
                <Connection v-else />
              </el-icon>
              <span>测试</span>
            </button>
            <button
              type="button"
              class="ai-connection-actions__button"
              aria-label="编辑连接"
              :disabled="isProviderBusy(row.id)"
              @click="openEditDialog(row)"
            >
              <el-icon><Edit /></el-icon>
              <span>编辑</span>
            </button>
            <button
              type="button"
              class="ai-connection-actions__button"
              aria-label="查看模型"
              :disabled="isProviderBusy(row.id)"
              @click="openModelsDrawer(row)"
            >
              <el-icon><Tickets /></el-icon>
              <span>模型</span>
            </button>
            <button
              type="button"
              class="ai-connection-actions__button is-danger"
              :class="{ 'is-loading': isProviderDeleting(row.id) }"
              :disabled="isProviderBusy(row.id)"
              aria-label="删除连接"
              @click="deleteProvider(row)"
            >
              <el-icon>
                <Loading v-if="isProviderDeleting(row.id)" />
                <Delete v-else />
              </el-icon>
              <span>删除</span>
            </button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <AiConnectionCreateEditDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :provider="editingProvider"
      :saving="saving"
      default-workspace-code="ALL"
      @submit="submitProvider"
    />

    <AiConnectionModelsDrawer
      v-model="modelsDrawerVisible"
      :provider="modelsProvider"
      workspace-code="ALL"
    />
  </section>
</template>

<style scoped>
.ai-connection-pool {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
}

.settings-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.settings-panel-header__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.settings-panel-header h2 {
  margin: 0;
  font-size: var(--app-font-size-xl);
  line-height: 26px;
}

.settings-panel-header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.settings-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.settings-stat {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-1);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.settings-stat span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.settings-stat strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
  line-height: 26px;
}

.settings-inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.settings-table {
  width: 100%;
}

.ai-connection-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: var(--app-space-1);
}

.ai-connection-actions__button {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 4px;
  min-height: 28px;
  padding: 0 var(--app-space-2);
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.ai-connection-actions__button:hover {
  background: var(--app-primary-soft);
}

.ai-connection-actions__button.is-danger {
  color: var(--app-danger);
}

.ai-connection-actions__button.is-danger:hover {
  background: var(--app-danger-soft);
}

.ai-connection-actions__button:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.ai-connection-actions__button.is-loading .el-icon {
  animation: ai-connection-spin 1s linear infinite;
}

@keyframes ai-connection-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 960px) {
  .settings-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .settings-panel-header {
    flex-direction: column;
  }

  .settings-panel-header__actions {
    justify-content: flex-start;
  }

  .settings-stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>

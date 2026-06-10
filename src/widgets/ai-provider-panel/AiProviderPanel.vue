<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { CirclePlus, Connection, Loading, MoreFilled, RefreshRight, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  aiProviderApi,
  formatAiProviderDate,
  getAiProviderEndpointSummary,
  getAiProviderProtocolLabel,
  getAiProviderStatusMeta,
  type AiProviderConnectionItem,
  type AiProviderStat,
  type SaveAiProviderConnectionPayload,
} from '@/entities/ai-provider'
import { ConfigStatCard, ConfigTypeBadge } from '@/entities/config'
import { deleteAiProviderConnection } from '@/features/ai-provider-delete'
import { AiProviderDialog, type AiProviderDialogMode } from '@/features/ai-provider-create-edit'
import { syncAiProviderModels } from '@/features/ai-provider-sync-models'
import { testAiProviderConnection } from '@/features/ai-provider-test-connection'
import { toggleAiProviderStatus } from '@/features/ai-provider-toggle-status'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
  }>(),
  {
    workspaceCode: 'ALL',
  },
)

const providers = ref<AiProviderConnectionItem[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const dialogVisible = ref(false)
const dialogMode = ref<AiProviderDialogMode>('create')
const editingProvider = ref<AiProviderConnectionItem | null>(null)
const testingProviderIds = ref<Set<number>>(new Set())
const syncingProviderIds = ref<Set<number>>(new Set())
const deletingProviderIds = ref<Set<number>>(new Set())
const togglingProviderIds = ref<Set<number>>(new Set())

const stats = computed<AiProviderStat[]>(() => [
  { label: '连接总数', value: providers.value.length, tone: 'primary' },
  {
    label: '已连接',
    value: providers.value.filter((item) => item.status === 1 && item.lastVerifiedAt).length,
    tone: 'success',
  },
  { label: '异常连接', value: providers.value.filter((item) => item.status === 0).length, tone: 'danger' },
  {
    label: '模型总数',
    value: providers.value.reduce((total, item) => total + (item.modelCount ?? 0), 0),
    tone: 'purple',
  },
])

async function loadProviders() {
  loading.value = true
  errorMessage.value = ''
  try {
    const items = await aiProviderApi.getProviderConnections(props.workspaceCode)
    providers.value = Array.isArray(items) ? items : []
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
    providers.value = []
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

async function submitProvider(payload: SaveAiProviderConnectionPayload) {
  saving.value = true
  try {
    if (dialogMode.value === 'edit' && editingProvider.value) {
      await aiProviderApi.updateProviderConnection(props.workspaceCode, editingProvider.value.id, payload)
      ElMessage.success('AI 连接已更新')
    } else {
      await aiProviderApi.createProviderConnection(props.workspaceCode, payload)
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

function setProviderLoading(target: typeof testingProviderIds | typeof syncingProviderIds, id: number, value: boolean) {
  const nextIds = new Set(target.value)
  if (value) {
    nextIds.add(id)
  } else {
    nextIds.delete(id)
  }
  target.value = nextIds
}

function isProviderTesting(id: number) {
  return testingProviderIds.value.has(id)
}

function isProviderSyncing(id: number) {
  return syncingProviderIds.value.has(id)
}

function isProviderDeleting(id: number) {
  return deletingProviderIds.value.has(id)
}

function isProviderToggling(id: number) {
  return togglingProviderIds.value.has(id)
}

function isProviderBusy(id: number) {
  return (
    isProviderTesting(id) ||
    isProviderSyncing(id) ||
    isProviderDeleting(id) ||
    isProviderToggling(id)
  )
}

async function testProvider(provider: AiProviderConnectionItem) {
  setProviderLoading(testingProviderIds, provider.id, true)
  try {
    const result = await testAiProviderConnection(provider, props.workspaceCode)
    ElMessage.success(result.message || 'AI 连接测试成功')
    await loadProviders()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    setProviderLoading(testingProviderIds, provider.id, false)
  }
}

async function syncModels(provider: AiProviderConnectionItem) {
  setProviderLoading(syncingProviderIds, provider.id, true)
  try {
    const result = await syncAiProviderModels(provider, props.workspaceCode)
    ElMessage.success(result.message || `模型同步完成，共 ${result.models.length} 个模型`)
    await loadProviders()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    setProviderLoading(syncingProviderIds, provider.id, false)
  }
}

async function deleteProvider(provider: AiProviderConnectionItem) {
  setProviderLoading(deletingProviderIds, provider.id, true)
  try {
    await deleteAiProviderConnection(provider, props.workspaceCode)
    ElMessage.success('AI 连接已删除')
    await loadProviders()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    setProviderLoading(deletingProviderIds, provider.id, false)
  }
}

async function toggleProviderStatus(provider: AiProviderConnectionItem) {
  setProviderLoading(togglingProviderIds, provider.id, true)
  try {
    const result = await toggleAiProviderStatus(provider, props.workspaceCode)
    ElMessage.success(result.status === 1 ? 'AI 连接已启用' : 'AI 连接已禁用')
    await loadProviders()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    setProviderLoading(togglingProviderIds, provider.id, false)
  }
}

onMounted(() => {
  void loadProviders()
})

watch(
  () => props.workspaceCode,
  () => {
    void loadProviders()
  },
)
</script>

<template>
  <section class="ai-provider-panel">
    <header class="ai-provider-panel__header">
      <div>
        <h2>AI 连接池</h2>
        <p>查看当前空间可用的 AI 服务商连接。</p>
      </div>
      <div class="ai-provider-panel__actions">
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadProviders">刷新</AppButton>
        <AppButton type="primary" :icon="CirclePlus" @click="openCreateDialog">新增连接</AppButton>
      </div>
    </header>

    <div class="ai-provider-panel__stats">
      <ConfigStatCard v-for="stat in stats" :key="stat.label" :stat="stat" />
    </div>

    <AppLoadingState v-if="loading && !providers.length" text="正在加载 AI 连接池..." />

    <AppEmptyState
      v-else-if="errorMessage"
      title="AI 连接池加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadProviders">重试</AppButton>
      </template>
    </AppEmptyState>

    <div v-else-if="providers.length" class="ai-provider-list">
      <article v-for="provider in providers" :key="provider.id" class="ai-provider-card">
        <div class="ai-provider-card__main">
          <div class="ai-provider-card__title">
            <div class="ai-provider-card__name-row">
              <h3>{{ provider.connectionName }}</h3>
              <ConfigTypeBadge
                :label="getAiProviderStatusMeta(provider).label"
                :tone="getAiProviderStatusMeta(provider).tone"
              />
            </div>
            <div class="ai-provider-card__meta-row">
              <ConfigTypeBadge :label="getAiProviderProtocolLabel(provider.protocolType)" tone="primary" />
              <span>{{ provider.modelName || '未选择模型' }}</span>
              <span>模型数：{{ provider.modelCount ?? 0 }}</span>
            </div>
            <p>{{ getAiProviderEndpointSummary(provider.baseUrl) }}</p>
          </div>
          <div class="ai-provider-card__actions">
            <button
              type="button"
              class="ai-provider-card__icon-button"
              :class="{ 'is-loading': isProviderTesting(provider.id) }"
              aria-label="测试连接"
              :disabled="isProviderBusy(provider.id)"
              @click="testProvider(provider)"
            >
              <el-icon>
                <Loading v-if="isProviderTesting(provider.id)" />
                <Connection v-else />
              </el-icon>
            </button>
            <button
              type="button"
              class="ai-provider-card__icon-button"
              :class="{ 'is-loading': isProviderSyncing(provider.id) }"
              aria-label="同步模型"
              :disabled="isProviderBusy(provider.id)"
              @click="syncModels(provider)"
            >
              <el-icon>
                <Loading v-if="isProviderSyncing(provider.id)" />
                <RefreshRight v-else />
              </el-icon>
            </button>
            <button
              type="button"
              class="ai-provider-card__icon-button"
              aria-label="配置连接"
              :disabled="isProviderBusy(provider.id)"
              @click="openEditDialog(provider)"
            >
              <el-icon><Setting /></el-icon>
            </button>
            <el-dropdown trigger="click" :disabled="isProviderBusy(provider.id)">
              <button
                type="button"
                class="ai-provider-card__icon-button"
                :class="{ 'is-loading': isProviderDeleting(provider.id) || isProviderToggling(provider.id) }"
                aria-label="更多操作"
              >
                <el-icon>
                  <Loading v-if="isProviderDeleting(provider.id) || isProviderToggling(provider.id)" />
                  <MoreFilled v-else />
                </el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="toggleProviderStatus(provider)">
                    {{ provider.status === 1 ? '禁用连接' : '启用连接' }}
                  </el-dropdown-item>
                  <el-dropdown-item class="ai-provider-card__danger-action" @click="deleteProvider(provider)">
                    删除连接
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <div class="ai-provider-card__footer">
          <span>所属空间：{{ provider.workspaceName || provider.workspaceCode }}</span>
          <span>最近验证：{{ formatAiProviderDate(provider.lastVerifiedAt) }}</span>
          <span>模型同步：{{ formatAiProviderDate(provider.lastFetchModelsAt) }}</span>
        </div>
      </article>
    </div>

    <AppEmptyState
      v-else
      title="暂无 AI 连接"
      description="当前空间还没有 AI 服务商连接。"
    >
      <template #actions>
        <AppButton type="primary" :icon="CirclePlus" @click="openCreateDialog">新增连接</AppButton>
      </template>
    </AppEmptyState>

    <AiProviderDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :provider="editingProvider"
      :saving="saving"
      :default-workspace-code="workspaceCode"
      @submit="submitProvider"
    />
  </section>
</template>

<style scoped>
.ai-provider-panel {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
}

.ai-provider-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.ai-provider-panel__header h2 {
  margin: 0;
  font-size: var(--app-font-size-xl);
  line-height: 26px;
}

.ai-provider-panel__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
}

.ai-provider-panel__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.ai-provider-panel__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-4);
}

.ai-provider-list {
  display: grid;
  gap: var(--app-space-4);
}

.ai-provider-card {
  padding: var(--app-space-5);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-xl);
  background: var(--app-bg-panel);
  transition: box-shadow 160ms ease;
}

.ai-provider-card:hover {
  box-shadow: var(--app-shadow-card-hover);
}

.ai-provider-card__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.ai-provider-card__title {
  min-width: 0;
}

.ai-provider-card__name-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
}

.ai-provider-card h3 {
  overflow: hidden;
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-provider-card__meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  margin-top: var(--app-space-3);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.ai-provider-card p {
  overflow: hidden;
  margin: var(--app-space-2) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-provider-card__actions {
  display: flex;
  flex: 0 0 auto;
  gap: var(--app-space-1);
}

.ai-provider-card__icon-button {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.ai-provider-card__icon-button:hover {
  background: var(--app-border-soft);
  color: var(--app-text-main);
}

.ai-provider-card__icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.ai-provider-card__icon-button.is-loading .el-icon {
  animation: ai-provider-spin 1s linear infinite;
}

.ai-provider-card__danger-action {
  color: var(--app-danger);
}

.ai-provider-card__footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-3);
  margin-top: var(--app-space-4);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

@keyframes ai-provider-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1100px) {
  .ai-provider-panel__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .ai-provider-panel__stats {
    grid-template-columns: 1fr;
  }

  .ai-provider-panel__header,
  .ai-provider-card__main {
    flex-direction: column;
  }

  .ai-provider-panel__actions {
    justify-content: flex-start;
  }
}
</style>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Connection, Delete, Edit, Loading, Plus, RefreshRight, Tickets } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  aiProviderApi,
  aiProviderBrands,
  formatAiProviderDate,
  getAiProviderBrandInitial,
  getAiProviderEndpointSummary,
  getAiProviderProtocolLabel,
  getAiProviderStatusMeta,
  hasAiProviderBrandConnection,
  inferAiProviderBrand,
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
import AppProviderBadge from '@/shared/ui/app-provider-badge/AppProviderBadge.vue'
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
  { label: '正常连接', value: providers.value.filter((item) => item.status === 1 && item.lastVerifiedAt).length },
  { label: '异常连接', value: providers.value.filter((item) => item.status === 0).length },
  { label: '可用供应商', value: aiProviderBrands.length },
])

const providerCardItems = computed(() => providers.value)

function getProviderBrand(provider: AiProviderConnectionItem) {
  return inferAiProviderBrand(provider)
}

function providerHasBrandConnection(brandId: string) {
  const brand = aiProviderBrands.find((item) => item.id === brandId)
  return brand ? hasAiProviderBrandConnection(brand, providers.value) : false
}

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
      <div
        v-for="(item, index) in stats"
        :key="item.label"
        class="settings-stat"
        :class="`settings-stat--tone-${index}`"
      >
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

    <section v-else class="ai-connection-card-grid" v-loading="loading">
      <article v-for="provider in providerCardItems" :key="provider.id" class="ai-connection-card">
        <div
          class="ai-connection-brand"
          :class="`ai-connection-brand--${getProviderBrand(provider).tone}`"
          aria-hidden="true"
        >
          <span>{{ getProviderBrand(provider).id === 'custom' ? getAiProviderBrandInitial(provider) : getProviderBrand(provider).mark }}</span>
        </div>

        <div class="ai-connection-card__main">
          <div class="ai-connection-card__title-row">
            <h3>{{ provider.connectionName }}</h3>
            <AppStatusBadge
              :label="getAiProviderStatusMeta(provider).label"
              :tone="getAiProviderStatusMeta(provider).tone"
            />
          </div>

          <div class="ai-connection-card__tags">
            <AppProviderBadge
              :label="getProviderBrand(provider).shortName"
              :tone="getProviderBrand(provider).tone"
            />
            <span class="ai-connection-model-chip">{{ provider.modelName || '-' }}</span>
          </div>

          <dl class="ai-connection-meta">
            <div>
              <dt>协议</dt>
              <dd>{{ getAiProviderProtocolLabel(provider.protocolType) }}</dd>
            </div>
            <div>
              <dt>服务地址</dt>
              <dd>{{ getAiProviderEndpointSummary(provider.baseUrl) }}</dd>
            </div>
            <div>
              <dt>所属空间</dt>
              <dd>{{ provider.workspaceName || provider.workspaceCode || 'ALL' }}</dd>
            </div>
            <div>
              <dt>最近验证</dt>
              <dd>{{ formatAiProviderDate(provider.lastVerifiedAt) }}</dd>
            </div>
          </dl>
        </div>

        <div class="ai-connection-actions">
            <button
              type="button"
              class="ai-connection-actions__button"
              :class="{ 'is-loading': isProviderTesting(provider.id) }"
              :disabled="isProviderBusy(provider.id)"
              aria-label="测试连接"
              @click="testProvider(provider)"
            >
              <el-icon>
                <Loading v-if="isProviderTesting(provider.id)" />
                <Connection v-else />
              </el-icon>
              <span>测试</span>
            </button>
            <button
              type="button"
              class="ai-connection-actions__button"
              aria-label="编辑连接"
              :disabled="isProviderBusy(provider.id)"
              @click="openEditDialog(provider)"
            >
              <el-icon><Edit /></el-icon>
              <span>编辑</span>
            </button>
            <button
              type="button"
              class="ai-connection-actions__button"
              aria-label="查看模型"
              :disabled="isProviderBusy(provider.id)"
              @click="openModelsDrawer(provider)"
            >
              <el-icon><Tickets /></el-icon>
              <span>模型</span>
            </button>
            <button
              type="button"
              class="ai-connection-actions__button is-danger"
              :class="{ 'is-loading': isProviderDeleting(provider.id) }"
              :disabled="isProviderBusy(provider.id)"
              aria-label="删除连接"
              @click="deleteProvider(provider)"
            >
              <el-icon>
                <Loading v-if="isProviderDeleting(provider.id)" />
                <Delete v-else />
              </el-icon>
              <span>删除</span>
            </button>
          </div>
      </article>
    </section>

    <section class="supported-providers">
      <h3>支持的供应商</h3>
      <div class="supported-provider-grid">
        <div
          v-for="brand in aiProviderBrands"
          :key="brand.id"
          class="supported-provider-card"
          :class="[
            `supported-provider-card--${brand.tone}`,
            { 'has-connection': providerHasBrandConnection(brand.id) },
          ]"
        >
          <div class="ai-connection-brand ai-connection-brand--small" :class="`ai-connection-brand--${brand.tone}`">
            <span>{{ brand.mark }}</span>
          </div>
          <span>{{ brand.shortName }}</span>
          <i v-if="providerHasBrandConnection(brand.id)" aria-hidden="true" />
        </div>
      </div>
    </section>

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
  padding-bottom: var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
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
  line-height: var(--app-line-height-md);
}

.settings-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.settings-stat {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 92px;
  flex-direction: column;
  gap: var(--app-space-1);
  justify-content: space-between;
  overflow: hidden;
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.settings-stat::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--app-primary);
  content: "";
}

.settings-stat:hover {
  border-color: var(--app-border-strong);
  box-shadow: var(--app-shadow-card);
  transform: translateY(-1px);
}

.settings-stat--tone-1::before {
  background: var(--app-success);
}

.settings-stat--tone-2::before {
  background: var(--app-danger);
}

.settings-stat--tone-3::before {
  background: var(--app-purple);
}

.settings-stat span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: var(--app-line-height-xs);
}

.settings-stat strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-page-title);
  line-height: 28px;
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

.ai-connection-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.ai-connection-card {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 148px;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--app-space-4);
  padding: var(--app-space-5);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.ai-connection-card:hover {
  border-color: var(--app-border-strong);
  box-shadow: var(--app-shadow-card-hover);
  transform: translateY(-1px);
}

.ai-connection-card__main {
  min-width: 0;
}

.ai-connection-card__title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
}

.ai-connection-card__title-row h3 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  font-weight: 700;
  line-height: var(--app-line-height-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-connection-card__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  margin-top: var(--app-space-2);
}

.ai-connection-model-chip {
  display: inline-flex;
  max-width: 220px;
  min-height: 26px;
  align-items: center;
  overflow: hidden;
  padding: 0 var(--app-space-2);
  border: 1px solid var(--app-border-soft);
  border-radius: 999px;
  background: var(--app-bg-subtle);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-connection-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-2) var(--app-space-4);
  margin: var(--app-space-3) 0 0;
}

.ai-connection-meta div {
  min-width: 0;
}

.ai-connection-meta dt {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.ai-connection-meta dd {
  min-width: 0;
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-connection-brand {
  display: inline-flex;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--app-border);
  border-radius: 14px;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-lg);
  font-weight: 800;
  line-height: 1;
}

.ai-connection-brand--small {
  width: 40px;
  height: 40px;
  flex-basis: 40px;
  border-radius: 12px;
  font-size: var(--app-font-size-sm);
}

.ai-connection-brand--primary {
  border-color: #bfdbfe;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.ai-connection-brand--success {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
  color: var(--app-success);
}

.ai-connection-brand--warning {
  border-color: #fed7aa;
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.ai-connection-brand--danger {
  border-color: #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.ai-connection-brand--purple {
  border-color: #e9d5ff;
  background: var(--app-purple-soft);
  color: var(--app-purple);
}

.ai-connection-actions {
  position: absolute;
  right: var(--app-space-4);
  bottom: var(--app-space-4);
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
}

.ai-connection-actions__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  gap: 4px;
  min-width: 44px;
  min-height: var(--app-control-height-sm);
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.ai-connection-actions__button:hover:not(:disabled) {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.ai-connection-actions__button:focus-visible {
  outline: 2px solid var(--app-primary);
  outline-offset: 2px;
}

.ai-connection-actions__button.is-danger {
  color: var(--app-danger);
}

.ai-connection-actions__button.is-danger:hover:not(:disabled) {
  border-color: var(--app-danger);
  background: var(--app-danger-soft);
}

.ai-connection-actions__button:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.ai-connection-actions__button.is-loading .el-icon {
  animation: ai-connection-spin 1s linear infinite;
}

.supported-providers {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.supported-providers h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
}

.supported-provider-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.supported-provider-card {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 104px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-align: center;
  transition: border-color 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
}

.supported-provider-card:not(.has-connection) .ai-connection-brand {
  opacity: 0.42;
}

.supported-provider-card.has-connection {
  border-color: var(--app-border-strong);
  color: var(--app-text-secondary);
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}

.supported-provider-card.has-connection i {
  position: absolute;
  bottom: var(--app-space-3);
  left: 50%;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--app-success);
  transform: translateX(-50%);
}

@keyframes ai-connection-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-connection-card,
  .settings-stat,
  .ai-connection-actions__button {
    transition: none;
  }

  .ai-connection-card:hover,
  .settings-stat:hover {
    transform: none;
  }
}

@media (max-width: 1280px) {
  .supported-provider-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .ai-connection-card-grid,
  .settings-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ai-connection-card {
    grid-template-columns: 1fr;
  }

  .ai-connection-actions {
    position: static;
    margin-top: var(--app-space-4);
  }
}

@media (max-width: 640px) {
  .settings-panel-header {
    flex-direction: column;
  }

  .settings-panel-header__actions {
    justify-content: flex-start;
  }

  .settings-panel-header__actions,
  .settings-panel-header__actions :deep(.app-button) {
    width: 100%;
  }

  .settings-stat-grid {
    grid-template-columns: 1fr;
  }

  .ai-connection-card-grid,
  .ai-connection-meta {
    grid-template-columns: 1fr;
  }

  .ai-connection-card {
    padding: var(--app-space-4);
  }

  .ai-connection-card__title-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .ai-connection-actions {
    flex-wrap: wrap;
  }

  .supported-provider-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

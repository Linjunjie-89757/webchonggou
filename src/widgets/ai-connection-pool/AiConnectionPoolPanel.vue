<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus, RefreshRight } from '@element-plus/icons-vue'
import { Edit2, Trash2, Wifi } from '@lucide/vue'
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
import AppStatusBadge from '@/shared/ui/app-status-badge/AppStatusBadge.vue'

const providers = ref<AiProviderConnectionItem[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const dialogVisible = ref(false)
const dialogMode = ref<AiConnectionDialogMode>('create')
const editingProvider = ref<AiProviderConnectionItem | null>(null)
const testingProviderIds = ref<Set<number>>(new Set())
const deletingProviderIds = ref<Set<number>>(new Set())

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
          class="ai-provider-logo"
          :class="[
            getProviderBrand(provider).logoClass,
            { 'has-logo-image': getProviderBrand(provider).logoSrc, 'is-custom': getProviderBrand(provider).id === 'custom' },
          ]"
          aria-hidden="true"
        >
          <img
            v-if="getProviderBrand(provider).id !== 'custom' && getProviderBrand(provider).logoSrc"
            :src="getProviderBrand(provider).logoSrc"
            :alt="getProviderBrand(provider).name"
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
            <span
              class="ai-provider-chip"
              :style="{ backgroundColor: getProviderBrand(provider).bg, color: getProviderBrand(provider).text }"
            >
              {{ getProviderBrand(provider).shortName }}
            </span>
            <span class="ai-connection-model-chip">{{ provider.modelName || '-' }}</span>
          </div>

          <div class="ai-connection-url">{{ getAiProviderEndpointSummary(provider.baseUrl) }}</div>
          <div class="ai-connection-date">
            <span>{{ getAiProviderProtocolLabel(provider.protocolType) }}</span>
            <span>最近验证 {{ formatAiProviderDate(provider.lastVerifiedAt) }}</span>
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
              title="测试连接"
              @click="testProvider(provider)"
            >
              <Wifi :size="16" :class="{ 'is-pulsing': isProviderTesting(provider.id) }" />
              <span>测试</span>
            </button>
            <button
              type="button"
              class="ai-connection-actions__button"
              aria-label="编辑连接"
              title="编辑连接"
              :disabled="isProviderBusy(provider.id)"
              @click="openEditDialog(provider)"
            >
              <Edit2 :size="16" />
              <span>编辑</span>
            </button>
            <button
              type="button"
              class="ai-connection-actions__button is-danger"
              :class="{ 'is-loading': isProviderDeleting(provider.id) }"
              :disabled="isProviderBusy(provider.id)"
              aria-label="删除连接"
              title="删除连接"
              @click="deleteProvider(provider)"
            >
              <Trash2 :size="16" :class="{ 'is-pulsing': isProviderDeleting(provider.id) }" />
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
          <div
            class="ai-provider-logo ai-provider-logo--small"
            :class="[brand.logoClass, { 'has-logo-image': brand.logoSrc, 'is-custom': brand.id === 'custom' }]"
            aria-hidden="true"
          >
            <img v-if="brand.id !== 'custom' && brand.logoSrc" :src="brand.logoSrc" :alt="brand.name">
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

  </section>
</template>

<style scoped>
.ai-connection-pool {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-6);
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
  gap: var(--app-space-4);
}

.settings-stat {
  display: flex;
  min-width: 0;
  min-height: 86px;
  flex-direction: column;
  gap: var(--app-space-1);
  justify-content: space-between;
  padding: 17px var(--app-space-5);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-xl);
  background: var(--app-bg-panel);
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.settings-stat:hover {
  border-color: var(--app-border-strong);
  box-shadow: var(--app-shadow-card);
}

.settings-stat--tone-0 strong {
  color: var(--app-primary);
}

.settings-stat--tone-1 strong {
  color: var(--app-success);
}

.settings-stat--tone-2 strong {
  color: var(--app-danger);
}

.settings-stat--tone-3 strong {
  color: var(--app-purple);
}

.settings-stat span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: var(--app-line-height-xs);
}

.settings-stat strong {
  font-size: 28px;
  line-height: 1.1;
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
  gap: 13px;
}

.ai-connection-card {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 129px;
  align-items: flex-start;
  gap: var(--app-space-4);
  padding: var(--app-space-5);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-xl);
  background: var(--app-bg-panel);
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.ai-connection-card:hover {
  border-color: var(--app-border-strong);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.ai-connection-card:hover .ai-connection-actions,
.ai-connection-card:focus-within .ai-connection-actions {
  opacity: 1;
}

.ai-connection-card__main {
  min-width: 0;
  flex: 1;
}

.ai-connection-card__title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
  flex-wrap: wrap;
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

.ai-provider-chip {
  display: inline-flex;
  min-height: 22px;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: 16px;
}

.ai-connection-model-chip {
  display: inline-flex;
  max-width: 220px;
  min-height: 22px;
  align-items: center;
  overflow: hidden;
  padding: 3px 9px;
  border: 0;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-connection-url {
  max-width: 520px;
  margin-top: 10px;
  overflow: hidden;
  color: var(--app-text-muted);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-connection-date {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
  margin-top: 6px;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.ai-connection-meta {
  display: none;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-2) var(--app-space-4);
  margin: var(--app-space-3) 0 0;
}

.ai-provider-logo {
  display: inline-flex;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 0;
  border-radius: 14px;
  background: var(--app-bg-muted);
  color: #fff;
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  box-shadow: 0 2px 7px rgba(15, 23, 42, 0.12);
}

.ai-provider-logo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.ai-provider-logo img + span {
  display: none;
}

.ai-provider-logo.has-logo-image {
  background: transparent;
  color: inherit;
  box-shadow: none;
}

.ai-provider-logo.is-custom {
  border: 1px solid var(--app-border);
  background: var(--app-bg-muted);
  color: var(--app-text-subtle);
  box-shadow: none;
}

.ai-provider-logo--small {
  width: 40px;
  height: 40px;
  flex-basis: 40px;
  border-radius: 12px;
  font-size: 16px;
}

.provider-logo-openai {
  background: #000;
}

.provider-logo-anthropic {
  background: #c68642;
  font-family: Georgia, serif;
  font-size: 28px;
}

.provider-logo-google {
  background: #fff;
}

.provider-logo-deepseek {
  background: #1c3ef0;
}

.provider-logo-qwen,
.provider-logo-xiaomi {
  background: #ffc29b;
}

.provider-logo-azure {
  background: #9fc9ea;
}

.provider-logo-zhipu {
  background: #c7d2fe;
}

.provider-logo-kimi {
  background: #9ca3af;
}

.provider-logo-kimi.has-logo-image {
  padding: 9px;
  background: #000;
  box-shadow: 0 2px 7px rgba(15, 23, 42, 0.12);
}

.provider-logo-minimax {
  background: #f3a6a6;
}

.provider-logo-ollama {
  background: #a3a3a3;
}

.provider-logo-custom {
  background: #f1f5f9;
  color: #cbd5e1;
}

.ai-connection-actions {
  position: absolute;
  z-index: 2;
  right: var(--app-space-4);
  top: var(--app-space-4);
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  opacity: 0;
  transition: opacity 180ms ease;
}

.ai-connection-actions__button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  transition: background-color 180ms ease, color 180ms ease, opacity 180ms ease;
}

.ai-connection-actions__button span {
  display: none;
}

.ai-connection-actions__button:hover:not(:disabled) {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.ai-connection-actions__button:focus-visible {
  outline: 2px solid var(--app-primary);
  outline-offset: 2px;
}

.ai-connection-actions__button.is-danger {
  color: var(--app-danger);
}

.ai-connection-actions__button.is-danger:hover:not(:disabled) {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.ai-connection-actions__button:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.ai-connection-actions__button .is-pulsing {
  animation: ai-connection-pulse 1s ease-in-out infinite;
}

.supported-providers {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  margin-top: 7px;
}

.supported-providers h3 {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
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
  min-height: 103px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  background: var(--app-bg-page);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-align: center;
  transition: border-color 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
}

.supported-provider-card:not(.has-connection) .ai-provider-logo {
  opacity: 0.35;
}

.supported-provider-card.has-connection {
  border-color: var(--app-border-strong);
  color: var(--app-text-secondary);
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}

.supported-provider-card.has-connection i {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--app-success);
}

@keyframes ai-connection-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.62;
    transform: scale(0.92);
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

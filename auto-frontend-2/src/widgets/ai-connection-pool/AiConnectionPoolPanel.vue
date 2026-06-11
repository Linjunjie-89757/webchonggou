<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'

import {
  aiProviderApi,
  formatAiProviderDate,
  getAiProviderEndpointSummary,
  getAiProviderProtocolLabel,
  getAiProviderStatusMeta,
  type AiProviderConnectionItem,
} from '@/entities/ai-provider'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppStatusBadge from '@/shared/ui/app-status-badge/AppStatusBadge.vue'

const providers = ref<AiProviderConnectionItem[]>([])
const loading = ref(false)
const errorMessage = ref('')

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

onMounted(() => {
  void loadProviders()
})
</script>

<template>
  <section class="ai-connection-pool">
    <header class="settings-panel-header">
      <div>
        <h2>AI 连接池</h2>
        <p>按平台视角查看已配置的大模型服务连接，当前阶段只读展示。</p>
      </div>
      <AppButton :icon="RefreshRight" :loading="loading" @click="loadProviders">刷新</AppButton>
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
    />

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
    </el-table>
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

@media (max-width: 960px) {
  .settings-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .settings-panel-header {
    flex-direction: column;
  }

  .settings-stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>

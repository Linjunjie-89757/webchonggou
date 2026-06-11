<script setup lang="ts">
import { watch, ref } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'

import { aiProviderApi, formatAiProviderDate, type AiProviderConnectionItem, type AiProviderModelItem } from '@/entities/ai-provider'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppStatusBadge from '@/shared/ui/app-status-badge/AppStatusBadge.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    provider?: AiProviderConnectionItem | null
    workspaceCode?: string
  }>(),
  {
    provider: null,
    workspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const models = ref<AiProviderModelItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
let requestSeq = 0

function formatCapabilities(value: unknown) {
  if (!value) {
    return '-'
  }
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

async function loadModels() {
  if (!props.provider) {
    return
  }

  const currentSeq = ++requestSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const items = await aiProviderApi.getProviderModels(props.workspaceCode, props.provider.id)
    if (currentSeq === requestSeq) {
      models.value = Array.isArray(items) ? items : []
    }
  } catch (error) {
    if (currentSeq === requestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (currentSeq === requestSeq) {
      loading.value = false
    }
  }
}

watch(
  () => [props.modelValue, props.provider?.id] as const,
  ([visible]) => {
    if (visible) {
      models.value = []
      void loadModels()
    }
  },
)
</script>

<template>
  <AppDrawer
    :model-value="modelValue"
    :title="provider ? `${provider.connectionName} 的模型` : 'AI 模型列表'"
    size="560px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="ai-connection-models-drawer">
      <header class="ai-connection-models-drawer__header">
        <div>
          <h3>模型列表</h3>
          <p>读取当前连接已缓存的模型，不执行同步或探测。</p>
        </div>
        <AppButton size="small" :icon="RefreshRight" :loading="loading" @click="loadModels">刷新</AppButton>
      </header>

      <AppLoadingState v-if="loading && models.length === 0" text="正在加载模型列表" />

      <AppEmptyState
        v-else-if="errorMessage && models.length === 0"
        title="模型列表加载失败"
        :description="errorMessage"
      >
        <template #actions>
          <AppButton :icon="RefreshRight" @click="loadModels">重试</AppButton>
        </template>
      </AppEmptyState>

      <div v-else-if="errorMessage" class="ai-connection-models-drawer__inline-error">
        <span>{{ errorMessage }}</span>
        <AppButton size="small" :icon="RefreshRight" @click="loadModels">重试</AppButton>
      </div>

      <AppEmptyState
        v-else-if="models.length === 0"
        title="暂无模型缓存"
        description="当前连接还没有已读取的模型。模型同步会在后续目标接入。"
      />

      <div v-else class="ai-connection-models-drawer__list">
        <article v-for="model in models" :key="model.id" class="ai-connection-model">
          <div class="ai-connection-model__main">
            <div class="ai-connection-model__title">
              <h4>{{ model.displayName || model.modelName }}</h4>
              <p>{{ model.modelName }}</p>
            </div>
            <AppStatusBadge
              :label="model.selectable ? '可选' : '不可选'"
              :tone="model.selectable ? 'success' : 'warning'"
            />
          </div>
          <dl>
            <div>
              <dt>能力</dt>
              <dd>{{ formatCapabilities(model.detectedCapabilities) }}</dd>
            </div>
            <div>
              <dt>最近探测</dt>
              <dd>{{ formatAiProviderDate(model.lastProbedAt) }}</dd>
            </div>
          </dl>
        </article>
      </div>
    </div>
  </AppDrawer>
</template>

<style scoped>
.ai-connection-models-drawer {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-4);
}

.ai-connection-models-drawer__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.ai-connection-models-drawer__header h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-lg);
}

.ai-connection-models-drawer__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.ai-connection-models-drawer__inline-error {
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

.ai-connection-models-drawer__list {
  display: grid;
  gap: var(--app-space-3);
}

.ai-connection-model {
  min-width: 0;
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.ai-connection-model__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.ai-connection-model__title {
  min-width: 0;
}

.ai-connection-model h4 {
  overflow-wrap: anywhere;
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
}

.ai-connection-model p {
  overflow-wrap: anywhere;
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.ai-connection-model dl {
  display: grid;
  gap: var(--app-space-2);
  margin: var(--app-space-3) 0 0;
}

.ai-connection-model dl > div {
  min-width: 0;
}

.ai-connection-model dt {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
}

.ai-connection-model dd {
  overflow-wrap: anywhere;
  margin: 2px 0 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
}
</style>

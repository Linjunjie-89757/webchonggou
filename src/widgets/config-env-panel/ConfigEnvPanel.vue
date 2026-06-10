<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Delete, Edit, Plus, RefreshRight, Search, Switch } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import {
  ConfigStatCard,
  ConfigTypeBadge,
  configApi,
  configEnvTypeOptions,
  configStatusOptions,
  getEnvVisualMeta,
  isProductionEnv,
  type ConfigStat,
  type ConfigStatus,
  type CreateEnvPayload,
  type EnvConfigItem,
} from '@/entities/config'
import { ConfigEnvDialog, type ConfigEnvDialogMode } from '@/features/config-env-create-edit'
import { deleteConfigEnv } from '@/features/config-env-delete'
import { toggleConfigEnvStatus } from '@/features/config-env-toggle-status'
import { getRequestErrorMessage } from '@/shared/api/error'
import { debounce } from '@/shared/lib/debounce'
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

const envs = ref<EnvConfigItem[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const dialogVisible = ref(false)
const dialogMode = ref<ConfigEnvDialogMode>('create')
const editingEnv = ref<EnvConfigItem | null>(null)
const deletingEnvId = ref<number | null>(null)
const togglingEnvId = ref<number | null>(null)
const filterKeyword = ref('')
const filterEnvType = ref('')
const filterStatus = ref('')
let suppressFilterLoad = false

const stats = computed<ConfigStat[]>(() => [
  { label: '环境总数', value: envs.value.length, tone: 'primary' },
  { label: '启用环境', value: envs.value.filter((item) => item.status === 1).length, tone: 'success' },
  { label: '生产环境', value: envs.value.filter((item) => isProductionEnv(item)).length, tone: 'danger' },
])

const filteredEnvs = computed(() => {
  return envs.value
})

const envQuery = computed(() => ({
  keyword: filterKeyword.value.trim(),
  envType: filterEnvType.value,
  status: filterStatus.value === '' ? undefined : (Number(filterStatus.value) as ConfigStatus),
}))

const debouncedLoadEnvs = debounce(() => {
  void loadEnvs()
}, 300)

async function loadEnvs() {
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await configApi.getSettingsEnvs(props.workspaceCode, envQuery.value)
    envs.value = Array.isArray(page.items) ? page.items : []
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  suppressFilterLoad = true
  filterKeyword.value = ''
  filterEnvType.value = ''
  filterStatus.value = ''
  suppressFilterLoad = false
  void loadEnvs()
}

function openCreateDialog() {
  dialogMode.value = 'create'
  editingEnv.value = null
  dialogVisible.value = true
}

function openEditDialog(env: EnvConfigItem) {
  dialogMode.value = 'edit'
  editingEnv.value = env
  dialogVisible.value = true
}

async function submitEnv(payload: CreateEnvPayload) {
  saving.value = true
  try {
    if (dialogMode.value === 'edit' && editingEnv.value) {
      await configApi.updateSettingsEnv(props.workspaceCode, editingEnv.value.id, payload)
      ElMessage.success('环境配置已更新')
    } else {
      await configApi.createSettingsEnv(props.workspaceCode, payload)
      ElMessage.success('环境配置已创建')
    }
    dialogVisible.value = false
    await loadEnvs()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function removeEnv(env: EnvConfigItem) {
  deletingEnvId.value = env.id
  try {
    await deleteConfigEnv(env, props.workspaceCode)
    ElMessage.success('环境配置已删除')
    await loadEnvs()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    deletingEnvId.value = null
  }
}

async function switchEnvStatus(env: EnvConfigItem) {
  togglingEnvId.value = env.id
  try {
    const nextStatus = await toggleConfigEnvStatus(env, props.workspaceCode)
    ElMessage.success(nextStatus === 1 ? '环境已启用' : '环境已禁用')
    await loadEnvs()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    togglingEnvId.value = null
  }
}

function isEnvOperating(env: EnvConfigItem) {
  return deletingEnvId.value === env.id || togglingEnvId.value === env.id
}

onMounted(() => {
  void loadEnvs()
})

onBeforeUnmount(() => {
  debouncedLoadEnvs.cancel()
})

watch(
  () => props.workspaceCode,
  () => {
    debouncedLoadEnvs.cancel()
    void loadEnvs()
  },
)

watch([filterKeyword, filterEnvType, filterStatus], () => {
  if (suppressFilterLoad) {
    return
  }
  debouncedLoadEnvs()
}, { flush: 'sync' })
</script>

<template>
  <section class="config-panel">
    <header class="config-panel__header">
      <div>
        <h2>环境配置</h2>
        <p>管理不同测试环境的配置信息。</p>
      </div>
      <div class="config-panel__actions">
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadEnvs">刷新</AppButton>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增环境</AppButton>
      </div>
    </header>

    <div class="config-panel__stats config-panel__stats--three">
      <ConfigStatCard v-for="stat in stats" :key="stat.label" :stat="stat" />
    </div>

    <div v-if="!errorMessage" class="config-filter-toolbar">
      <el-input
        v-model="filterKeyword"
        class="config-filter-control config-filter-control--search"
        clearable
        placeholder="搜索环境名称 / Base URL"
        :prefix-icon="Search"
      />
      <el-select
        v-model="filterEnvType"
        class="config-filter-control"
        clearable
        placeholder="环境类型"
      >
        <el-option
          v-for="item in configEnvTypeOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-select
        v-model="filterStatus"
        class="config-filter-control"
        clearable
        placeholder="状态"
      >
        <el-option
          v-for="item in configStatusOptions"
          :key="item.value"
          :label="item.label"
          :value="String(item.value)"
        />
      </el-select>
      <AppButton :icon="RefreshRight" @click="resetFilters">重置</AppButton>
    </div>

    <div v-else-if="envs.length" class="config-inline-error">
      {{ errorMessage }}
      <AppButton size="small" :icon="RefreshRight" @click="loadEnvs">重试</AppButton>
    </div>

    <AppLoadingState v-if="loading && !envs.length" text="正在加载环境配置..." />

    <AppEmptyState
      v-else-if="errorMessage && !envs.length"
      title="环境配置加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadEnvs">重试</AppButton>
      </template>
    </AppEmptyState>

    <div v-else-if="filteredEnvs.length" class="config-env-grid">
      <article v-for="env in filteredEnvs" :key="env.id" class="config-env-card">
        <div class="config-env-card__main">
          <div class="config-env-card__title">
            <div class="config-env-card__name-row">
              <h3>{{ env.envName }}</h3>
              <ConfigTypeBadge
                :label="env.status === 1 ? '启用中' : '已停用'"
                :tone="env.status === 1 ? 'success' : 'default'"
              />
            </div>
            <p>{{ getEnvVisualMeta(env).description }}</p>
          </div>
          <div class="config-env-card__actions">
            <button
              type="button"
              class="config-env-card__icon-button"
              :aria-label="env.status === 1 ? '禁用环境' : '启用环境'"
              :disabled="isEnvOperating(env)"
              @click="switchEnvStatus(env)"
            >
              <el-icon><Switch /></el-icon>
            </button>
            <button
              type="button"
              class="config-env-card__icon-button"
              aria-label="编辑环境"
              :disabled="isEnvOperating(env)"
              @click="openEditDialog(env)"
            >
              <el-icon><Edit /></el-icon>
            </button>
            <button
              type="button"
              class="config-env-card__icon-button is-danger"
              aria-label="删除环境"
              :disabled="isEnvOperating(env)"
              @click="removeEnv(env)"
            >
              <el-icon><Delete /></el-icon>
            </button>
          </div>
        </div>
        <div class="config-env-card__body">
          <ConfigTypeBadge
            :label="getEnvVisualMeta(env).typeLabel"
            :tone="getEnvVisualMeta(env).tone"
          />
          <div class="config-code-box">{{ env.baseUrl }}</div>
          <div class="config-card-meta">
            所属空间：{{ env.workspaceName || env.workspaceCode }}
          </div>
        </div>
      </article>
    </div>

    <AppEmptyState
      v-else
      title="暂无环境配置"
      :description="envs.length ? '当前筛选条件下没有环境配置。' : '当前空间还没有环境配置。'"
    >
      <template #actions>
        <AppButton type="primary" :icon="Plus" @click="openCreateDialog">新增环境</AppButton>
      </template>
    </AppEmptyState>

    <ConfigEnvDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :env="editingEnv"
      :saving="saving"
      :default-workspace-code="workspaceCode"
      @submit="submitEnv"
    />
  </section>
</template>

<style scoped>
.config-panel {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
}

.config-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.config-panel__header h2 {
  margin: 0;
  font-size: var(--app-font-size-xl);
  line-height: 26px;
}

.config-panel__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
}

.config-panel__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.config-panel__stats {
  display: grid;
  gap: var(--app-space-4);
}

.config-panel__stats--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.config-filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-3);
}

.config-inline-error {
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

.config-filter-control {
  width: 156px;
}

.config-filter-control--search {
  width: min(320px, 100%);
}

.config-env-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-4);
}

.config-env-card {
  min-height: 188px;
  padding: var(--app-space-5);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  transition: box-shadow 160ms ease;
}

.config-env-card:hover {
  box-shadow: var(--app-shadow-card-hover);
}

.config-env-card__main {
  display: flex;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin-bottom: 18px;
}

.config-env-card__title {
  min-width: 0;
}

.config-env-card__name-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
  margin-bottom: 3px;
}

.config-env-card h3 {
  overflow: hidden;
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-env-card p {
  margin: 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.config-env-card__actions {
  display: flex;
  flex: 0 0 auto;
  gap: var(--app-space-1);
}

.config-env-card__icon-button {
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

.config-env-card__icon-button:hover {
  background: var(--app-border-soft);
  color: var(--app-text-main);
}

.config-env-card__icon-button.is-danger:hover {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.config-env-card__icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.config-env-card__body {
  display: grid;
  gap: var(--app-space-3);
}

.config-code-box {
  overflow: hidden;
  padding: var(--app-space-2) var(--app-space-3);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  color: var(--app-text-main);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-card-meta {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

@media (max-width: 900px) {
  .config-panel__stats--three,
  .config-env-grid {
    grid-template-columns: 1fr;
  }

  .config-panel__header {
    flex-direction: column;
  }

  .config-panel__actions {
    justify-content: flex-start;
  }

  .config-filter-toolbar,
  .config-filter-control,
  .config-filter-control--search {
    width: 100%;
  }
}
</style>
